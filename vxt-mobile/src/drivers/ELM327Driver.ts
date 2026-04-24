/**
 * ELM327Driver — OBD-II automotive telemetry via Bluetooth Classic SPP.
 *
 * ── Transport ─────────────────────────────────────────────────────────────
 *   Protocol  : Bluetooth Classic — Serial Port Profile (SPP / RFCOMM)
 *   Library   : react-native-bluetooth-classic v1.73.x
 *   Connection: RNBluetoothClassic.connectToDevice(macAddress)
 *               Returns a BluetoothDevice whose read/write methods map to
 *               the SPP RFCOMM socket opened on the device.
 *
 * ── ELM327 SPP communication rules ───────────────────────────────────────
 *   1. Commands are ASCII strings terminated with '\r' (carriage return).
 *   2. ELM327 echoes the command back (disabled with ATE0).
 *   3. Every response ends with the '>' prompt character.
 *      → You MUST read in a loop until '>' appears (NOT a single read()).
 *   4. ATZ (reset) takes ~1 000 ms before the device is ready.
 *   5. The adapter is half-duplex — never send a new command before the
 *      previous response ('>' prompt) has been received.
 *   6. react-native-bluetooth-classic read() returns a ReadEvent object
 *      with a .data string field (not a raw string).
 *
 * ── Architecture ─────────────────────────────────────────────────────────
 *
 *   TWO APIs — two different access patterns:
 *
 *   1. getLatest()  [synchronous / real-time]
 *        Always sends PID queries directly to the ELM327 device right now.
 *        Acquires the _polling mutex (waits up to 8 s if the background poller
 *        is mid-cycle) then queries all PIDs fresh from the car.
 *        Result is also pushed into the ring buffer so history is complete.
 *        Use this when the user asks "what is my RPM right now?".
 *
 *   2. getHistory(startMs, endMs)  [historical / read-only]
 *        Reads the in-memory ring buffer for the requested time window.
 *        Does NOT remove entries — the ring buffer is purely age-evicted
 *        (entries older than 5 minutes are dropped automatically).
 *        Returns all recorded samples inside [startMs, endMs].
 *
 *   BACKGROUND POLLER (3 s loop, "buffer filler"):
 *        Queries all 14 PIDs every 3 s and pushes to the ring buffer.
 *        3 s chosen because 14 PIDs × ~200 ms/PID ≈ 2.8 s per cycle.
 *        Also emits live TelemetryData events for KafkaTransport.
 *        The _polling mutex prevents concurrent SPP writes.
 *
 * ── OBD-II PID parsing ───────────────────────────────────────────────────
 *   Mode 01 (current data). Response "41 0C 1A F0\r>" decoded per SAE J1979.
 */

import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { BaseDriver } from '../core/BaseDriver';
import { DriverError } from '../core/types/TelemetryProvider';
import type {
  TelemetryData,
  DriverCapabilities,
  SnapshotMap,
  HistoryMap,
} from '../core/types';

// ---------------------------------------------------------------------------
// react-native-bluetooth-classic v1.x types
// ---------------------------------------------------------------------------

/**
 * react-native-bluetooth-classic v1.x read() returns this event object,
 * NOT a raw string. The actual data is in the `.data` field.
 */
interface BTReadEvent {
  device:    BTClassicDevice;
  data:      string;   // the received bytes decoded as a string
  timestamp: Date;
}

interface BTClassicDevice {
  id:        string;
  name:      string;
  address:   string;
  connected: boolean;
  /** Bytes available in the internal read buffer (non-blocking) */
  available(): Promise<number>;
  /** Drain / clear the internal read buffer */
  clear(): Promise<boolean>;
  /** Read one chunk from the buffer. Returns null if buffer is empty. */
  read(): Promise<BTReadEvent | null>;
  /** Write an ASCII string to the SPP socket */
  write(data: string, charset?: string): Promise<boolean>;
  /** Close the SPP socket */
  disconnect(graceful?: boolean): Promise<BTClassicDevice>;
  /** Check if the socket is still open */
  isConnected(): Promise<boolean>;
}

interface BTClassicModule {
  requestBluetoothEnabled(): Promise<boolean>;
  isBluetoothEnabled(): Promise<boolean>;
  getBondedDevices(): Promise<BTClassicDevice[]>;
  connectToDevice(address: string, options?: object): Promise<BTClassicDevice>;
}

function getBTModule(): BTClassicModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RNBluetooth = require('react-native-bluetooth-classic');
    const mod = RNBluetooth?.default ?? RNBluetooth;
    if (mod && typeof mod.getBondedDevices === 'function') {
      return mod as BTClassicModule;
    }
    const native = (NativeModules.RNBluetoothClassic as BTClassicModule | null | undefined) ?? null;
    return native;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PID definitions
// ---------------------------------------------------------------------------

/** OBD-II PID query and response decoder */
interface PIDDef {
  /** 4-char hex command sent to ELM327, e.g. "010C" */
  command: string;
  /** Human-readable name */
  name: string;
  /** Metric key used in SnapshotMap / HistoryMap (matches VitalsDefs key) */
  key: string;
  /** Decode raw response bytes (A, B, C, D) to numeric SI value */
  decode: (bytes: number[]) => number;
  /** Physical unit for display */
  unit: string;
}

/**
 * Core polling PIDs sent every 1-second cycle.
 * Response bytes A..D extracted after stripping the echo / mode byte.
 */
const POLLING_PIDS: PIDDef[] = [
  {
    command: '010C',
    name: 'Engine RPM',
    key: 'obd.engineRpm',
    unit: 'rpm',
    decode: ([A, B]) => ((A * 256 + B) / 4),
  },
  {
    command: '010D',
    name: 'Vehicle Speed',
    key: 'obd.vehicleSpeed',
    unit: 'km/h',
    decode: ([A]) => A,
  },
  {
    command: '0105',
    name: 'Engine Coolant Temperature',
    key: 'obd.coolantTemp',
    unit: '°C',
    decode: ([A]) => A - 40,
  },
  {
    command: '0111',
    name: 'Throttle Position',
    key: 'obd.throttlePos',
    unit: '%',
    decode: ([A]) => (A * 100) / 255,
  },
  {
    command: '012F',
    name: 'Fuel Tank Level Input',
    key: 'obd.fuelLevel',
    unit: '%',
    decode: ([A]) => (A * 100) / 255,
  },
  {
    command: '0110',
    name: 'Mass Air Flow Rate',
    key: 'obd.mafRate',
    unit: 'g/s',
    decode: ([A, B]) => (A * 256 + B) / 100,
  },
  {
    command: '0104',
    name: 'Calculated Engine Load',
    key: 'obd.engineLoad',
    unit: '%',
    decode: ([A]) => (A * 100) / 255,
  },
  {
    command: '010F',
    name: 'Intake Air Temperature',
    key: 'obd.intakeAirTemp',
    unit: '°C',
    decode: ([A]) => A - 40,
  },
  {
    command: '010B',
    name: 'Intake Manifold Absolute Pressure',
    key: 'obd.manifoldPressure',
    unit: 'kPa',
    decode: ([A]) => A,
  },
  {
    command: '010E',
    name: 'Timing Advance',
    key: 'obd.timingAdvance',
    unit: '°',
    decode: ([A]) => A / 2 - 64,
  },
  {
    command: '015C',
    name: 'Engine Oil Temperature',
    key: 'obd.oilTemp',
    unit: '°C',
    decode: ([A]) => A - 40,
  },
  {
    command: '0142',
    name: 'Control Module Voltage',
    key: 'obd.moduleVoltage',
    unit: 'V',
    decode: ([A, B]) => (A * 256 + B) / 1000,
  },
  {
    command: '015E',
    name: 'Engine Fuel Rate',
    key: 'obd.fuelRate',
    unit: 'L/h',
    decode: ([A, B]) => (A * 256 + B) / 20,
  },
  {
    command: '015A',
    name: 'Relative Accelerator Pedal Position',
    key: 'obd.accelPedalPos',
    unit: '%',
    decode: ([A]) => (A * 100) / 255,
  },
];

// ---------------------------------------------------------------------------
// Buffer entry type
// ---------------------------------------------------------------------------
interface BufferEntry {
  ts: number;
  measurements: Record<string, number>;
}

// ---------------------------------------------------------------------------
// ELM327Driver
// ---------------------------------------------------------------------------

export class ELM327Driver extends BaseDriver {
  readonly id = 'ELM327' as const;
  readonly displayName = 'ELM327 OBD-II (Bluetooth Classic SPP)';
  readonly platform = 'android' as const;
  readonly capabilities: DriverCapabilities = {
    realtime: true,
    requiresHealthPermissions: false,
    requiresBackgroundExecution: true,
  };

  /**
   * In-memory ring buffer — keeps 5 minutes of history.
   * At 3 s poll interval: 5 min × 60 s / 3 s = 100 entries/cycle.
   * 300 cap gives headroom for extra getLatest() calls.
   */
  private buffer: BufferEntry[] = [];
  private readonly BUFFER_MAX_ENTRIES = 300;
  private readonly BUFFER_MAX_AGE_MS  = 300_000; // 5 minutes

  /**
   * Poll interval in ms. 14 PIDs × ~200 ms/PID ≈ 2.8 s per full cycle.
   * Using 1 s would cause new writes to overlap with pending reads on the
   * half-duplex SPP socket, corrupting responses.
   */
  private readonly POLL_INTERVAL_MS = 3_000;

  /** Prevents concurrent poll cycles (half-duplex SPP socket guard) */
  private _polling = false;

  /** setInterval handle */
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** Open SPP socket (null = not connected) */
  private btDevice: BTClassicDevice | null = null;

  /** Only true after a successful BT connect + AT init */
  private _initialized = false;

  constructor(
    private entityId: string = '',
    private btDeviceAddress: string = '',
  ) {
    super();
  }

  setUserId(id: string): void {
    this.entityId = id;
  }

  getUserId(): string {
    return this.entityId;
  }

  /** Update BT device address at runtime (called from DriverSelectorScreen) */
  setBtAddress(address: string): void {
    this.btDeviceAddress = address;
    console.log(`[ELM327] BT address set to: ${address}`);
  }

  /** Expose currently paired ELM327 device addresses for UI picker */
  async getAvailableDevices(): Promise<Array<{ address: string; name: string }>> {
    // Ensure runtime BT permissions before any native BT call (Android 12+)
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);
      } catch (e) {
        console.warn('[ELM327] BT permission request failed:', e);
      }
    }
    const bt = getBTModule();
    if (!bt) {
      console.warn('[ELM327] BT module not available for device scan');
      return [];
    }
    try {
      console.log('[ELM327] Scanning bonded devices…');
      const bonded = await bt.getBondedDevices();
      console.log(`[ELM327] Found ${bonded.length} bonded devices`);
      // Return ALL bonded devices so the user can identify and select theirs
      return bonded.map(d => {
        console.log(`[ELM327]   Device: ${d.name} (${d.address})`);
        return { address: d.address, name: d.name };
      });
    } catch (err) {
      console.error(`[ELM327] Device scan failed: ${err}`);
      return [];
    }
  }

  /**
   * Resolve a device name or MAC address to a valid MAC address.
   * If input looks like a MAC address (contains colons), use it as-is.
   * Otherwise, try to match it to a bonded device name.
   */
  private async _resolveDeviceAddress(input: string): Promise<string | null> {
    if (!input) return null;

    // If it looks like a MAC address, use it directly
    if (input.includes(':') && /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i.test(input)) {
      console.log(`[ELM327] Using MAC address: ${input}`);
      return input;
    }

    // Try to match device name against ALL bonded devices
    const bt = getBTModule();
    if (!bt) return null;
    try {
      const bonded = await bt.getBondedDevices();
      console.log(`[ELM327] Resolving "${input}" across ${bonded.length} bonded devices:`);
      for (const d of bonded) {
        console.log(`[ELM327]   - "${d.name}" (${d.address})`);
      }
      const match = bonded.find(
        d => d.name?.toLowerCase() === input.toLowerCase() ||
             d.name?.toUpperCase().includes(input.toUpperCase()) ||
             d.address?.toLowerCase() === input.toLowerCase()
      );
      if (match?.address) {
        console.log(`[ELM327] ✓ Resolved "${input}" → ${match.address} (${match.name})`);
        return match.address;
      }
      console.warn(`[ELM327] ✗ No bonded device matched "${input}"`);
      return null;
    } catch (err) {
      console.error(`[ELM327] _resolveDeviceAddress error: ${err}`);
      return null;
    }
  }

  // ─── Availability & Permissions ──────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    const bt = getBTModule();
    if (!bt) return false;
    try {
      return await bt.isBluetoothEnabled();
    } catch {
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> { return true; }

  async requestPermissions(): Promise<boolean> {
    const bt = getBTModule();
    if (!bt) return true;
    try {
      // Android 12+ (API 31+) requires runtime grants for BT_CONNECT and BT_SCAN
      if (Platform.OS === 'android' && Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);
        const allGranted = Object.values(granted).every(
          v => v === PermissionsAndroid.RESULTS.GRANTED
        );
        if (!allGranted) {
          console.warn('[ELM327] Bluetooth runtime permissions not fully granted');
        }
      }
      await bt.requestBluetoothEnabled();
      return true;
    } catch (e) {
      console.warn('[ELM327] requestPermissions error:', e);
      return true;
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) {
      console.log('[ELM327] Already initialized — skipping re-init');
      return;
    }

    // Request runtime permissions first (needed on Android 12+)
    await this.requestPermissions();

    const bt = getBTModule();
    if (!bt) {
      console.warn('[ELM327] BT module not available — driver will not produce data');
      return; // _initialized stays false so retrying after address is saved will work
    }

    if (!this.btDeviceAddress) {
      console.warn('[ELM327] No BT device address configured — driver will not produce data');
      return; // _initialized stays false
    }

    try {
      // Resolve device name/alias to MAC address if needed
      const resolvedAddress = await this._resolveDeviceAddress(this.btDeviceAddress);
      if (!resolvedAddress) {
        console.warn('[ELM327] Could not resolve device address — driver will not produce data');
        return;
      }

      console.log(`[ELM327] Connecting to ${resolvedAddress}…`);
      const connectPromise = bt.connectToDevice(resolvedAddress);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('BT connection timeout (15s)')), 15_000)
      );

      this.btDevice = await Promise.race([connectPromise, timeoutPromise]);
      console.log('[ELM327] BT socket open, running AT init sequence…');

      // ── ELM327 AT initialisation ────────────────────────────────────────
      // ATZ  — soft reset; takes ~1 000 ms (handled inside _sendCommandWithPrompt)
      // ATE0 — disable echo (so responses don't repeat the command)
      // ATL0 — disable linefeeds (cleaner to parse)
      // ATS0 — disable spaces in data bytes (faster, easier to parse hex)
      // ATH0 — disable OBD header bytes (Mode-01 responses only)
      // ATSP0 — auto-detect protocol (works with virtually every car)
      const initCmds: [string, number][] = [
        ['ATZ',   2_000],
        ['ATE0',  1_000],
        ['ATL0',  1_000],
        ['ATS0',  1_000],
        ['ATH0',  1_000],
        ['ATSP0', 2_000],
      ];
      for (const [cmd, timeout] of initCmds) {
        const resp = await this._sendCommandWithPrompt(cmd, timeout);
        console.log(`[ELM327] ${cmd} → ${resp.replace(/[\r\n]/g, ' ').trim()}`);
      }

      this._initialized = true; // only mark initialized on successful BT connection
      console.log('[ELM327] ✓ Connected and initialized');
    } catch (err) {
      console.warn(`[ELM327] Initialization failed: ${err} — will retry on next start`);
      this.btDevice = null;
      // _initialized stays false so next start attempt will try again
    }
  }

  protected async doStart(): Promise<void> {
    if (!this.btDevice) {
      console.warn('[ELM327] doStart called but no BT connection — nothing to poll');
      return;
    }
    console.log('[ELM327] Starting 3-second poll loop…');
    // Immediate first poll
    await this._pollAndBuffer();
    this.pollTimer = setInterval(() => {
      void this._pollAndBuffer();
    }, this.POLL_INTERVAL_MS);
    console.log('[ELM327] ✓ Polling loop started');
  }

  protected async doStop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.btDevice) {
      try { await this.btDevice.disconnect(); } catch { /* ignore */ }
    }
    this.btDevice = null;
    this._initialized = false;
    this._polling = false;
  }

  // ─── Core 1-second poll → buffer ─────────────────────────────────────────

  private async _pollAndBuffer(): Promise<void> {
    // Half-duplex guard: skip if previous cycle hasn't finished
    if (this._polling) {
      console.warn('[ELM327] Previous poll still running — skipping cycle');
      return;
    }
    if (!this.btDevice) return;

    this._polling = true;
    try {
      const measurements = await this._queryAllPIDs();

      if (Object.keys(measurements).length === 0) {
        console.warn('[ELM327] Poll cycle returned 0 measurements');
        return;
      }

      const now = Date.now();
      this._evictOld(now);
      if (this.buffer.length >= this.BUFFER_MAX_ENTRIES) this.buffer.shift();
      this.buffer.push({ ts: now, measurements });

      this.emit({
        timestamp:    new Date(now).toISOString(),
        sourceDriver: 'ELM327',
        entityId:     this.entityId,
        measurements,
        metadata:     { protocol: 'SARJ1979' },
      });
    } catch (err) {
      this.emitError(new DriverError(this.displayName, 'PARSE_ERROR', String(err), err));
    } finally {
      this._polling = false;
    }
  }

  private _evictOld(now: number): void {
    const cutoff = now - this.BUFFER_MAX_AGE_MS;
    while (this.buffer.length > 0 && this.buffer[0].ts < cutoff) this.buffer.shift();
  }

  // ─── SPP communication (Bluetooth Classic) ────────────────────────────────
  //
  //  react-native-bluetooth-classic v1.x read() API:
  //    - Returns: BTReadEvent | null   (NOT a raw string)
  //    - BTReadEvent.data contains the received ASCII string chunk
  //    - read() is non-blocking — returns null if the internal buffer is empty
  //    - Multiple read() calls may be needed to accumulate a full response
  //
  //  ELM327 SPP protocol:
  //    - Send:    "${command}\r"
  //    - Receive: response bytes followed by '\r>' (CR + prompt)
  //    - MUST read in a loop until '>' is seen (response is complete)
  //    - ATZ reset takes ~1000 ms before '>' appears

  /**
   * Send one AT/PID command and return the complete response string.
   * Reads in a loop until the '>' prompt is received or timeout.
   */
  private async _sendCommandWithPrompt(
    cmd: string,
    timeoutMs = 2_500,
  ): Promise<string> {
    if (!this.btDevice) return '';
    try {
      // Drain any stale bytes left in the adapter's output buffer
      try { await this.btDevice.clear(); } catch { /* not all firmware supports it */ }

      // Send command — ELM327 expects ASCII + carriage-return terminator
      const ok = await this.btDevice.write(`${cmd}\r`);
      if (!ok) {
        console.warn(`[ELM327] write("${cmd}") returned false`);
        return '';
      }

      // ATZ resets the ELM327 chip — need ~1 s before it's ready
      if (cmd.toUpperCase() === 'ATZ') {
        await new Promise(r => setTimeout(r, 1_000));
      }

      // Read loop: accumulate chunks until '>' prompt is received
      const deadline = Date.now() + timeoutMs;
      let accumulated = '';

      while (Date.now() < deadline) {
        const event = await this.btDevice.read();
        if (event !== null) {
          // v1.x returns BTReadEvent; guard for hypothetical string response too
          const chunk: string =
            typeof event === 'string'
              ? event
              : (event as BTReadEvent).data ?? '';
          accumulated += chunk;
          if (accumulated.includes('>')) break; // full response received
        }
        // Small yield to avoid busy-spin; ELM327 typically responds in 50–200 ms
        await new Promise(r => setTimeout(r, 20));
      }

      return accumulated;
    } catch (err) {
      console.warn(`[ELM327] _sendCommandWithPrompt("${cmd}") error: ${err}`);
      return '';
    }
  }

  private async _queryAllPIDs(): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const pid of POLLING_PIDS) {
      // Use 2.5 s timeout per PID — slow adapters on older CAN buses can take ~500 ms
      const raw = await this._sendCommandWithPrompt(pid.command, 2_500);
      const value = _parseELMResponse(pid, raw);
      if (value !== null) {
        result[pid.key] = value;
      }
    }
    return result;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * getLatest — SYNCHRONOUS / REAL-TIME path.
   *
   * Always queries the ELM327 device directly for fresh current values.
   * This ensures HealthVitalsScreen always shows the actual car state,
   * not a cached value that could be seconds old.
   *
   * If the background poller is mid-cycle (half-duplex SPP is busy), we
   * wait for it to complete before sending our own commands (up to 8 s).
   * If the socket is still busy after 8 s we fall back to the latest
   * buffered value rather than block the UI indefinitely.
   *
   * The fresh reading is also pushed into the ring buffer so that
   * getHistory() sees it.
   */
  async getLatest(): Promise<SnapshotMap | null> {
    if (!this.btDevice) return null; // not connected yet

    // ── Wait for the background poller to finish its current cycle ──────
    // (SPP is half-duplex — only one command train at a time)
    const waitDeadline = Date.now() + 8_000;
    while (this._polling && Date.now() < waitDeadline) {
      await new Promise(r => setTimeout(r, 50));
    }

    if (this._polling) {
      // Still busy after 8 s — return the freshest buffered reading instead
      console.warn('[ELM327] getLatest: SPP still busy after 8 s — returning latest buffer entry');
      return this._latestFromBuffer();
    }

    // ── Acquire mutex and query the device directly ───────────────────────
    this._polling = true;
    try {
      const measurements = await this._queryAllPIDs();
      if (Object.keys(measurements).length === 0) {
        console.warn('[ELM327] getLatest: PID query returned 0 values');
        return this._latestFromBuffer(); // fall back to cache
      }

      const now = Date.now();
      this._evictOld(now);
      if (this.buffer.length >= this.BUFFER_MAX_ENTRIES) this.buffer.shift();
      this.buffer.push({ ts: now, measurements }); // feed the history ring buffer too

      const snapshot: SnapshotMap = {};
      for (const [key, value] of Object.entries(measurements)) {
        snapshot[key] = { value, ts: now };
      }
      return snapshot;
    } finally {
      this._polling = false;
    }
  }

  /** Return the most recent entry in the ring buffer as a SnapshotMap, or null. */
  private _latestFromBuffer(): SnapshotMap | null {
    if (this.buffer.length === 0) return null;
    const latest = this.buffer[this.buffer.length - 1];
    const snapshot: SnapshotMap = {};
    for (const [key, value] of Object.entries(latest.measurements)) {
      snapshot[key] = { value, ts: latest.ts };
    }
    return snapshot;
  }

  /**
   * getHistory — READ-ONLY historical query against the 5-minute ring buffer.
   *
   * Returns all recorded samples in [fromMs, toMs] without removing them
   * from the buffer.  The buffer is age-evicted automatically (_evictOld)
   * so entries older than 5 minutes disappear on the next poller cycle.
   *
   * Callers (GatewayService, chart screens) may call this as many times as
   * they like for the same window — they will always get the same data until
   * it ages out.
   *
   * Returns HistoryMap keyed by PID code:
   *   { "obd.engineRpm": [{ v: 800, ts: 1714000000000 }, ...], ... }
   */
  async getHistory(fromMs: number, toMs: number): Promise<HistoryMap> {
    // Evict anything older than 5 minutes first
    this._evictOld(Date.now());

    const inRange = this.buffer.filter(e => e.ts >= fromMs && e.ts <= toMs);

    if (inRange.length === 0) {
      console.log(
        `[ELM327] getHistory [${new Date(fromMs).toISOString()} → ${new Date(toMs).toISOString()}]: no entries in range (buffer has ${this.buffer.length} total)`,
      );
      return {};
    }

    // Build HistoryMap: { metricKey: [{ v, ts }, ...] }
    const result: HistoryMap = {};
    for (const entry of inRange) {
      for (const [pid, value] of Object.entries(entry.measurements)) {
        if (!result[pid]) result[pid] = [];
        result[pid].push({ v: value, ts: entry.ts });
      }
    }

    console.log(
      `[ELM327] getHistory [${new Date(fromMs).toISOString()} → ${new Date(toMs).toISOString()}] ` +
      `found=${inRange.length} frames, pids=${Object.keys(result).length}, buffer total=${this.buffer.length}`,
    );

    return result;
  }
}

// ---------------------------------------------------------------------------
// ELM327 response parser
// ---------------------------------------------------------------------------

/**
 * Parse a raw ELM327 AT response string.
 * Input:  "41 0C 1A F0\r\n>"  or  "410C1AF0\r>"
 * Output: decoded numeric value, or null if parse fails.
 */
function _parseELMResponse(pid: PIDDef, raw: string): number | null {
  try {
    // Normalise: strip prompt, whitespace, echo line
    const lines = raw
      .split('\r')
      .map(l => l.trim().toUpperCase())
      .filter(l => l.length > 0 && !l.startsWith(pid.command.toUpperCase()) && l !== '>');

    if (lines.length === 0) return null;

    const response = lines[lines.length - 1];

    // Must start with "41" (mode 01 response marker)
    const hex = response.replace(/\s+/g, '');
    if (!hex.startsWith('41')) return null;

    // Strip "41" + 2-char PID → remaining bytes
    const dataHex = hex.slice(4); // skip "41" + PID
    if (dataHex.length === 0) return null;

    const bytes: number[] = [];
    for (let i = 0; i < dataHex.length; i += 2) {
      bytes.push(parseInt(dataHex.slice(i, i + 2), 16));
    }

    const value = pid.decode(bytes);
    return isFinite(value) ? Math.round(value * 1000) / 1000 : null;
  } catch {
    return null;
  }
}
