/**
 * useDataSource — manages the active data source for EntityTelemetryRN.
 *
 * Three source types:
 *   'cloud'  — pull from the cloud API (configurable URL)
 *   'local'  — pull from a local network endpoint (configurable URL)
 *   'driver' — pull from the currently active driver (no HTTP fetch)
 *
 * Settings are persisted in AsyncStorage and reloaded on every mount.
 */
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DataSourceType = 'cloud' | 'local' | 'driver';

export const DEFAULT_CLOUD_URL =
  'https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net';
export const DEFAULT_LOCAL_URL = 'http://192.168.1.36:8000';

const KEY_TYPE          = '@vxt_ds_type';
const KEY_CLOUD_URL     = '@vxt_ds_cloud_url';
const KEY_LOCAL_URL     = '@vxt_ds_local_url';

export interface DataSource {
  type:         DataSourceType;
  cloudUrl:     string;
  localUrl:     string;
  loaded:       boolean;
  /** Resolved base URL (null when type === 'driver') */
  baseUrl:      string | null;
}

export async function loadDataSource(): Promise<DataSource> {
  const [type, cloudUrl, localUrl] = await Promise.all([
    AsyncStorage.getItem(KEY_TYPE),
    AsyncStorage.getItem(KEY_CLOUD_URL),
    AsyncStorage.getItem(KEY_LOCAL_URL),
  ]);
  const t = (type as DataSourceType) || 'driver';
  const c = cloudUrl || DEFAULT_CLOUD_URL;
  const l = localUrl || DEFAULT_LOCAL_URL;
  return {
    type: t,
    cloudUrl: c,
    localUrl: l,
    loaded: true,
    baseUrl: t === 'cloud' ? c : t === 'local' ? l : null,
  };
}

export async function saveDataSource(
  type: DataSourceType,
  cloudUrl: string,
  localUrl: string,
): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEY_TYPE, type),
    AsyncStorage.setItem(KEY_CLOUD_URL, cloudUrl),
    AsyncStorage.setItem(KEY_LOCAL_URL, localUrl),
  ]);
}

export function useDataSource(): DataSource {
  const [ds, setDs] = useState<DataSource>({
    type:         'driver',
    cloudUrl:     DEFAULT_CLOUD_URL,
    localUrl:     DEFAULT_LOCAL_URL,
    loaded:       false,
    baseUrl:      null,
  });

  useEffect(() => {
    loadDataSource().then(setDs);
  }, []);

  return ds;
}
