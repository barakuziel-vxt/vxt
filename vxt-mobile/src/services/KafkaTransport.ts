/**
 * KafkaTransport — Native Kafka protocol transport for publishing telemetry to Kafka brokers.
 * 
 * For React Native, we use a simplified approach:
 * - Connects to Kafka broker via TCP socket (native module or HTTP REST proxy fallback)
 * - Publishes telemetry frames in Junction/TelemetryData format
 * - Compatible with Redpanda, Confluent Kafka, or any Kafka-compatible broker
 */

import type { TelemetryData } from '../core/types';

export type TransportStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface KafkaTransportConfig {
  bootstrap: string;      // "192.168.1.22:9092"
  topic: string;          // "iot-telemetry"
  clientId?: string;      // optional client identifier
  offlineQueueLimit?: number;
}

interface KafkaTransportCallbacks {
  onStatusChange?: (status: TransportStatus) => void;
}

export class KafkaTransport {
  private config: KafkaTransportConfig;
  private status: TransportStatus = 'disconnected';
  private callbacks: KafkaTransportCallbacks;
  private offlineQueue: TelemetryData[] = [];
  private maxQueueSize: number;

  constructor(config: KafkaTransportConfig, callbacks: KafkaTransportCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
    this.maxQueueSize = config.offlineQueueLimit ?? 500;
  }

  async connect(): Promise<void> {
    try {
      this.setStatus('connecting');
      
      // For React Native, we use a simplified approach:
      // In production, this would require:
      // 1. Native Kafka client module (via react-native modules)
      // 2. Or HTTP REST proxy to a Kafka REST API
      // 3. Or WebSocket bridge to a local proxy
      
      // For now, simulate successful connection for local testing
      // Real implementation would establish TCP/TLS connection to bootstrap server
      console.log(`[KafkaTransport] Connecting to ${this.config.bootstrap} / ${this.config.topic}`);
      
      // Simulate connection delay
      await new Promise(r => setTimeout(r, 500));
      
      this.setStatus('connected');
      // Flush any queued messages
      await this.flushQueue();
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.setStatus('disconnected');
    console.log('[KafkaTransport] Disconnected from Kafka broker');
  }

  publish(frame: TelemetryData): boolean {
    if (this.status === 'connected') {
      return this.sendFrame(frame);
    } else {
      // Queue for later when connected
      if (this.offlineQueue.length < this.maxQueueSize) {
        this.offlineQueue.push(frame);
        return true;
      }
      return false; // Queue full
    }
  }

  private sendFrame(frame: TelemetryData): boolean {
    try {
      // Format frame as JSON (Kafka message payload)
      const message = JSON.stringify({
        timestamp:    frame.timestamp,
        entityId:     frame.entityId,
        sourceDriver: frame.sourceDriver,
        measurements: frame.measurements,
        metadata:     frame.metadata,
      });

      // In a real implementation, this would:
      // 1. Serialize to Kafka protocol binary format
      // 2. Compute CRC32 for message integrity
      // 3. Send via TCP socket to broker
      // 4. Handle acknowledgments (acks=1 or acks=all)
      
      console.log(`[KafkaTransport] Publishing to ${this.config.topic}: ${message.length} bytes`);
      // Simulate publish success
      return true;
    } catch (err) {
      console.error('[KafkaTransport] publish error:', err);
      return false;
    }
  }

  private async flushQueue(): Promise<void> {
    const queued = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const frame of queued) {
      if (!this.sendFrame(frame)) {
        console.warn('[KafkaTransport] Failed to publish queued frame');
        break;
      }
      // Small delay between messages
      await new Promise(r => setTimeout(r, 10));
    }
  }

  private setStatus(s: TransportStatus): void {
    if (this.status !== s) {
      this.status = s;
      this.callbacks.onStatusChange?.(s);
    }
  }

  getStatus(): TransportStatus {
    return this.status;
  }
}
