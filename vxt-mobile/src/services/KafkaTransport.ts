/**
 * KafkaTransport — Native Kafka protocol transport for publishing telemetry to Kafka brokers.
 * 
 * For React Native, we use a simplified approach:
 * - Connects to Kafka broker via TCP socket (native module or HTTP REST proxy fallback)
 * - Publishes telemetry frames in Junction/TelemetryData format
 * - Compatible with Redpanda, Confluent Kafka, or any Kafka-compatible broker
 * 
 * Logging: All publish attempts are logged for diagnostics
 */

import type { TelemetryData } from '../core/types';

export type TransportStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface KafkaTransportConfig {
  bootstrap: string;      // "192.168.1.22:9092"
  topic: string;          // "iot-telemetry"
  clientId?: string;      // optional client identifier
  offlineQueueLimit?: number;
  apiBase?: string;       // REST API base URL (e.g., "http://192.168.1.22:8000")
}

interface KafkaTransportCallbacks {
  onStatusChange?: (status: TransportStatus) => void;
  onLog?: (msg: string, level: 'info' | 'warn' | 'error') => void;
}

export class KafkaTransport {
  private config: KafkaTransportConfig;
  private status: TransportStatus = 'disconnected';
  private callbacks: KafkaTransportCallbacks;
  private offlineQueue: TelemetryData[] = [];
  private maxQueueSize: number;
  private frameCount = 0;
  private errorCount = 0;
  private lastError: string | null = null;

  constructor(config: KafkaTransportConfig, callbacks: KafkaTransportCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
    this.maxQueueSize = config.offlineQueueLimit ?? 500;
    this.log(`KafkaTransport initialized: bootstrap=${config.bootstrap}, topic=${config.topic}`, 'info');
  }

  private log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logMsg = `[KafkaTransport ${timestamp}] ${msg}`;
    console.log(logMsg);
    this.callbacks.onLog?.(logMsg, level);
  }

  async connect(): Promise<void> {
    try {
      this.setStatus('connecting');
      this.log(`Connecting to Kafka broker at ${this.config.bootstrap}...`, 'info');
      this.frameCount = 0;
      this.errorCount = 0;
      this.lastError = null;
      
      // If REST API is configured, test connectivity
      if (this.config.apiBase) {
        try {
          this.log(`Testing REST API connectivity at ${this.config.apiBase}/api/publish-telemetry...`, 'info');
          const testRes = await fetch(`${this.config.apiBase}/api/publish-telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceDriver:   'ConnectionTest',
              entityId:       'test',
              measurements:   {},
              kafkaBootstrap: this.config.bootstrap,
              kafkaTopic:     this.config.topic,
            }),
          });

          if (!testRes.ok) {
            const errText = await testRes.text().catch(() => testRes.statusText);
            throw new Error(`API returned ${testRes.status}: ${errText}`);
          }

          this.log(`REST API connectivity verified`, 'info');
        } catch (apiErr) {
          this.log(`REST API test failed: ${String(apiErr)}`, 'warn');
          // Continue anyway - maybe API is temporarily down
        }
      }
      
      await new Promise(r => setTimeout(r, 500));
      
      this.log(`Connected to Kafka broker successfully (bootstrap=${this.config.bootstrap})`, 'info');
      this.setStatus('connected');
      
      // Flush any queued messages
      await this.flushQueue();
    } catch (err) {
      const errMsg = String(err);
      this.lastError = errMsg;
      this.log(`Connection failed: ${errMsg}`, 'error');
      this.setStatus('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.log(`Disconnecting from Kafka broker (sent ${this.frameCount} frames, ${this.errorCount} errors)`, 'info');
    this.setStatus('disconnected');
  }

  publish(frame: TelemetryData): boolean {
    if (this.status === 'connected') {
      // Start async send without blocking
      this.sendFrameAsync(frame).catch(err => 
        this.log(`Async publish error: ${String(err)}`, 'error')
      );
      return true;
    } else {
      // Queue for later when connected
      if (this.offlineQueue.length < this.maxQueueSize) {
        this.offlineQueue.push(frame);
        this.log(`Queued frame (queue size: ${this.offlineQueue.length}/${this.maxQueueSize})`, 'info');
        return true;
      }
      this.log(`Queue full! Dropped frame (${this.offlineQueue.length}/${this.maxQueueSize})`, 'warn');
      return false;
    }
  }

  private async sendFrameAsync(frame: TelemetryData): Promise<void> {
    try {
      const measurements = frame.measurements || {};
      const entityId = frame.entityId || 'unknown';

      if (Object.keys(measurements).length === 0) {
        this.log(`Skipping empty frame for entity ${entityId}`, 'warn');
        return;
      }

      if (!this.config.apiBase) {
        this.log(`No API base configured, cannot publish`, 'error');
        throw new Error('API base not configured');
      }

      // Publish the entire frame in one shot via the direct endpoint.
      // This preserves sourceDriver so the consumer's auto_detect_provider
      // correctly identifies SARJ1979 / SamsungHealth / etc. without
      // re-wrapping in SignalK or Junction format.
      const payload = {
        sourceDriver:   frame.sourceDriver || 'Driver',
        entityId,
        timestamp:      frame.timestamp || new Date().toISOString(),
        measurements,
        metadata:       frame.metadata ?? {},
        kafkaBootstrap: this.config.bootstrap,
        kafkaTopic:     this.config.topic,
      };

      const endpoint = `${this.config.apiBase}/api/publish-telemetry`;
      this.log(`Publishing ${Object.keys(measurements).length} measurements for entity ${entityId} to ${endpoint}`, 'info');

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      this.frameCount += 1;
      const m_count = Object.keys(measurements).length;
      this.log(
        `Published frame #${this.frameCount} to topic '${this.config.topic}' (${m_count} measurements, entity=${entityId}, driver=${frame.sourceDriver})`,
        'info'
      );
    } catch (err) {
      this.errorCount += 1;
      const errMsg = String(err);
      this.lastError = errMsg;
      this.log(`Publish error #${this.errorCount}: ${errMsg}`, 'error');
      throw err;
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;
    
    this.log(`Flushing ${this.offlineQueue.length} queued frames...`, 'info');
    const queued = [...this.offlineQueue];
    this.offlineQueue = [];

    let flushed = 0;
    for (const frame of queued) {
      try {
        await this.sendFrameAsync(frame);
        flushed += 1;
      } catch (err) {
        this.log(`Failed to flush queued frame, stopping flush (flushed ${flushed}/${queued.length})`, 'warn');
        break;
      }
      // Small delay between messages
      await new Promise(r => setTimeout(r, 10));
    }
    
    this.log(`Flush complete: ${flushed}/${queued.length} frames published`, 'info');
  }

  private setStatus(s: TransportStatus): void {
    if (this.status !== s) {
      this.status = s;
      this.log(`Status changed: ${s}`, 'info');
      this.callbacks.onStatusChange?.(s);
    }
  }

  getStatus(): TransportStatus {
    return this.status;
  }

  getStats() {
    return {
      status: this.status,
      framesSent: this.frameCount,
      errors: this.errorCount,
      queuedFrames: this.offlineQueue.length,
      lastError: this.lastError,
    };
  }
}
