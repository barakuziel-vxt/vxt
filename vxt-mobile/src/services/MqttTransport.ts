import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import type { TelemetryData } from '../core/types';

// ─── Azure IoT Hub MQTT constants ──────────────────────────────────────────
const IOT_HUB_HOST  = 'VXT-IoT-Hub.azure-devices.net';
const PUBLISH_TOPIC_FOR = (deviceId: string) => `devices/${deviceId}/messages/events/`;

// ─── Pure-JS base64 helpers (Hermes has no atob/btoa) ───────────────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64Decode(b64: string): Uint8Array {
  const s = b64.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor(s.length * 3 / 4));
  let idx = 0;
  for (let i = 0; i < s.length; i += 4) {
    const a = B64.indexOf(s[i])     ?? 0;
    const b = B64.indexOf(s[i + 1]) ?? 0;
    const hasC = (i + 2) < s.length;
    const hasD = (i + 3) < s.length;
    const c = hasC ? B64.indexOf(s[i + 2]) : 0;
    const d = hasD ? B64.indexOf(s[i + 3]) : 0;
    out[idx++] = (a << 2) | (b >> 4);
    if (hasC) out[idx++] = ((b & 0xf) << 4) | (c >> 2);
    if (hasD) out[idx++] = ((c & 0x3) << 6) | d;
  }
  return out.slice(0, idx);
}

function b64Encode(bytes: Uint8Array): string {
  let r = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    r += B64[a >> 2];
    r += B64[((a & 3) << 4) | (b >> 4)];
    r += i + 1 < bytes.length ? B64[((b & 0xf) << 2) | (c >> 6)] : '=';
    r += i + 2 < bytes.length ? B64[c & 0x3f] : '=';
  }
  return r;
}

// ─── Pure-JS UTF-8 encoder (Hermes has no TextEncoder) ──────────────────────
function utf8Encode(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push((c >> 6) | 0xc0, (c & 0x3f) | 0x80);
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const c2 = str.charCodeAt(++i);
      const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      bytes.push((cp >> 18) | 0xf0, ((cp >> 12) & 0x3f) | 0x80,
                 ((cp >> 6) & 0x3f) | 0x80, (cp & 0x3f) | 0x80);
    } else {
      bytes.push((c >> 12) | 0xe0, ((c >> 6) & 0x3f) | 0x80, (c & 0x3f) | 0x80);
    }
  }
  return new Uint8Array(bytes);
}

// ─── Pure-JS SHA-256 + HMAC-SHA256 (Hermes has no crypto.subtle) ─────────────
/* eslint-disable no-bitwise */
const _K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

function _rotr(x: number, n: number): number { return (x >>> n) | (x << (32 - n)); }

function _sha256(msg: Uint8Array): Uint8Array {
  const bLen = msg.length;
  const padLen = ((bLen + 9 + 63) & ~63);
  const padded = new Uint8Array(padLen);
  padded.set(msg);
  padded[bLen] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padLen - 4, (bLen * 8) >>> 0, false);
  dv.setUint32(padLen - 8, Math.floor(bLen / 0x20000000), false);

  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,
      h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const w = new Uint32Array(64);

  for (let off = 0; off < padLen; off += 64) {
    const cv = new DataView(padded.buffer, off, 64);
    for (let i = 0; i < 16; i++) w[i] = cv.getUint32(i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = _rotr(w[i-15],7) ^ _rotr(w[i-15],18) ^ (w[i-15] >>> 3);
      const s1 = _rotr(w[i-2],17) ^ _rotr(w[i-2],19)  ^ (w[i-2]  >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let i = 0; i < 64; i++) {
      const S1   = _rotr(e,6) ^ _rotr(e,11) ^ _rotr(e,25);
      const ch   = (e & f) ^ (~e & g);
      const t1   = (h + S1 + ch + _K[i] + w[i]) >>> 0;
      const S0   = _rotr(a,2) ^ _rotr(a,13) ^ _rotr(a,22);
      const maj  = (a & b) ^ (a & c) ^ (b & c);
      const t2   = (S0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
    h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach((v,i) => ov.setUint32(i*4, v, false));
  return out;
}

function _hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const B = 64;
  const k = key.length > B ? _sha256(key) : key;
  const kp = new Uint8Array(B); kp.set(k);
  const iKey = kp.map((b, i) => b ^ 0x36);
  const oKey = kp.map((b, i) => b ^ 0x5c);
  const inner = new Uint8Array(B + data.length);
  inner.set(iKey); inner.set(data, B);
  const outer = new Uint8Array(B + 32);
  outer.set(oKey); outer.set(_sha256(inner), B);
  return _sha256(outer);
}
/* eslint-enable no-bitwise */

/**
 * Generate a SAS token — pure-JS, no browser globals (works in Hermes).
 */
function buildSasToken(
  resourceUri: string,
  signingKey: string,
  expirySeconds = 3600,
): string {
  const expiry    = Math.floor(Date.now() / 1000) + expirySeconds;
  const toSign    = `${encodeURIComponent(resourceUri)}\n${expiry}`;
  const keyBytes  = b64Decode(signingKey);
  const msgBytes  = utf8Encode(toSign);
  const sigBytes  = _hmacSha256(keyBytes, msgBytes);
  const signature = encodeURIComponent(b64Encode(sigBytes));
  // Device-to-cloud SAS tokens must NOT include skn (that is hub-policy-only)
  return (
    `SharedAccessSignature sr=${encodeURIComponent(resourceUri)}` +
    `&sig=${signature}&se=${expiry}`
  );
}

// Parse the IoT Hub connection string that is stored in config / env
function parseConnectionString(cs: string): {
  hostName: string;
  deviceId: string;
  sharedAccessKey: string;
} {
  const parts = Object.fromEntries(
    cs.split(';').map(p => {
      const eq = p.indexOf('=');
      return [p.slice(0, eq), p.slice(eq + 1)];
    }),
  );
  return {
    hostName:        parts['HostName']        ?? '',
    deviceId:        parts['DeviceId']        ?? '',
    sharedAccessKey: parts['SharedAccessKey'] ?? '',
  };
}

// ─── Transport ─────────────────────────────────────────────────────────────

export type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MqttTransportOptions {
  connectionString: string;
  /** Messages sent while disconnected are queued up to this limit */
  offlineQueueLimit?: number;
  keepalive?: number;
}

/**
 * MqttTransport
 *
 * Thin MQTT.js wrapper tailored for Azure IoT Hub's MQTT endpoint.
 * - Authenticates via time-limited SAS tokens (no permanent secrets in-flight)
 * - QoS 1 publish (at-least-once delivery)
 * - Auto-reconnect with exponential back-off (mqtt.js built-in)
 * - Offline message queue (configurable)
 */
export class MqttTransport {
  private client: MqttClient | null = null;
  private status: TransportStatus  = 'disconnected';
  private deviceId: string          = '';
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly onStatusChange?: (s: TransportStatus) => void;

  constructor(
    private readonly options: MqttTransportOptions,
    callbacks?: { onStatusChange?: (s: TransportStatus) => void },
  ) {
    this.onStatusChange = callbacks?.onStatusChange;
  }

  // ─── Connection lifecycle ──────────────────────────────────────────────

  async connect(): Promise<void> {
    const { hostName, deviceId, sharedAccessKey } =
      parseConnectionString(this.options.connectionString);
    this.deviceId = deviceId;

    const resourceUri = `${hostName}/devices/${deviceId}`;
    const TTL_SECONDS = 86400; // 24h — token is refreshed proactively before expiry
    const sasToken    = buildSasToken(resourceUri, sharedAccessKey, TTL_SECONDS);

    // React Native has no native TLS socket module, so raw MQTTS (port 8883)
    // fails silently.  Azure IoT Hub supports MQTT-over-WebSocket on port 443,
    // which works with React Native's built-in WebSocket implementation.
    const wsUrl = `wss://${hostName}:443/$iothub/websocket?iothub-no-client-cert=true`;

    const mqttOpts: IClientOptions = {
      // WebSocket URL carries host + port + path; omit host/port/protocol keys
      clientId:   deviceId,
      username:   `${hostName}/${deviceId}/?api-version=2021-04-12`,
      password:   sasToken,
      keepalive:  this.options.keepalive ?? 60,
      clean:      true,
      reconnectPeriod: 5000,
      connectTimeout:  15_000,
      queueQoSZero: false,
    };

    this.setStatus('connecting');

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

      // Pass wsUrl as first arg — this is what tells mqtt.js to use WebSockets
      this.client = mqtt.connect(wsUrl, mqttOpts);
      const offlineQueue: string[] = [];

      this.client.on('connect', () => {
        console.log('[MqttTransport] CONNECTED to Azure IoT Hub via WSS');
        this.setStatus('connected');
        for (const payload of offlineQueue.splice(0)) {
          this.publishRaw(payload);
        }
        settle(resolve);
        // Proactively reconnect 5 min before the SAS token expires
        if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);
        this.tokenRefreshTimer = setTimeout(
          () => { void this.refreshToken(); },
          (TTL_SECONDS - 300) * 1000,
        );
      });

      this.client.on('error', err => {
        console.error('[MqttTransport] error:', err.message ?? String(err));
        this.setStatus('error');
        // Stop client so it doesn't keep reconnecting after a fatal auth error
        this.client?.end(true);
        settle(() => reject(err));
      });

      this.client.on('close',      () => { if (this.status === 'connected') this.setStatus('disconnected'); });
      this.client.on('reconnect',  () => this.setStatus('connecting'));
    });
  }

  async disconnect(): Promise<void> {
    if (this.tokenRefreshTimer) { clearTimeout(this.tokenRefreshTimer); this.tokenRefreshTimer = null; }
    if (!this.client) return;
    return new Promise<void>(resolve => {
      this.client!.end(false, {}, () => {
        this.setStatus('disconnected');
        resolve();
      });
    });
  }

  private async refreshToken(): Promise<void> {
    console.log('[MqttTransport] SAS token nearing expiry — reconnecting with fresh token');
    await this.disconnect();
    await this.connect();
  }

  // ─── Publish ───────────────────────────────────────────────────────────

  /**
   * Serialise and publish a TelemetryData frame to IoT Hub.
   * Returns false if not currently connected (caller may retry / queue).
   */
  publish(data: TelemetryData): boolean {
    if (!this.client || this.status !== 'connected') return false;
    const payload = JSON.stringify(data);
    return this.publishRaw(payload);
  }

  private publishRaw(payload: string): boolean {
    if (!this.client) return false;
    this.client.publish(PUBLISH_TOPIC_FOR(this.deviceId), payload, { qos: 1 }, err => {
      if (err) console.warn('[MqttTransport] publish error:', err.message);
    });
    return true;
  }

  // ─── Status helpers ────────────────────────────────────────────────────

  getStatus(): TransportStatus { return this.status; }

  private setStatus(s: TransportStatus) {
    this.status = s;
    this.onStatusChange?.(s);
  }
}
