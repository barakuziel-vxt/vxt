/**
 * RestApiVitalsProvider
 *
 * Generic HTTP/REST adapter for any vitals backend.
 * Works with SignalK servers, Apple Health relays, custom backends, etc.
 *
 * Expected endpoint contract:
 *   GET {baseUrl}{latestPath}              → VitalSnapshot[]
 *   GET {baseUrl}{historyPath}?from=&to=   → VitalHistory
 */

import type { VitalsProvider, VitalSnapshot, VitalHistory, RestApiProviderConfig } from './types';

export class RestApiVitalsProvider implements VitalsProvider {
  readonly id:          string;
  readonly name:        string;
  readonly description: string;
  readonly platform     = 'Network' as const;

  constructor(private readonly cfg: RestApiProviderConfig) {
    this.id          = cfg.id;
    this.name        = cfg.name;
    this.description = cfg.description ?? `REST endpoint: ${cfg.baseUrl}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.cfg.baseUrl}/health`, {
        method:  'HEAD',
        headers: this.cfg.headers,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getLatest(): Promise<VitalSnapshot[]> {
    const path = this.cfg.latestPath ?? '/vitals/latest';
    const url  = `${this.cfg.baseUrl}${path}`;

    const res = await fetch(url, {
      method:  'GET',
      headers: { 'Content-Type': 'application/json', ...this.cfg.headers },
    });

    if (!res.ok) {
      throw new Error(`getLatest HTTP ${res.status} from ${url}`);
    }

    return (await res.json()) as VitalSnapshot[];
  }

  async getHistory(fromMs: number, toMs: number): Promise<VitalHistory> {
    const path = this.cfg.historyPath ?? '/vitals/history';
    const url  = `${this.cfg.baseUrl}${path}?from=${fromMs}&to=${toMs}`;

    const res = await fetch(url, {
      method:  'GET',
      headers: { 'Content-Type': 'application/json', ...this.cfg.headers },
    });

    if (!res.ok) {
      throw new Error(`getHistory HTTP ${res.status} from ${url}`);
    }

    return (await res.json()) as VitalHistory;
  }
}
