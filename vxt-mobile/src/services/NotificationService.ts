/**
 * NotificationService — Firebase Cloud Messaging integration
 *
 * Handles:
 *  - FCM token retrieval and refresh
 *  - Permission requests
 *  - Foreground / background notification display via Notifee
 *  - Sending the FCM token to the backend API
 */
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const STORAGE_KEY_FCM = '@vxt_fcm_token';
const CHANNEL_ID      = 'vxt-alerts';

// ─── Notifee channel (Android) ──────────────────────────────────────────────
async function ensureChannel() {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'VXT Alerts',
      importance: AndroidImportance.HIGH,
      vibration: true,
      sound: 'default',
    });
  }
}

// ─── Display a notification (foreground & background) ───────────────────────
async function displayNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  await ensureChannel();
  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
  });
}

// ─── Request permission & get FCM token ─────────────────────────────────────
async function requestPermissionAndGetToken(): Promise<string | null> {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.warn('[Notification] Permission denied');
    return null;
  }

  const token = await messaging().getToken();
  console.log('[Notification] FCM token:', token?.slice(0, 20) + '…');
  return token;
}

// ─── Send token to backend API ──────────────────────────────────────────────
async function sendTokenToBackend(
  fcmToken: string,
  apiBaseUrl: string,
  userId: string,
): Promise<boolean> {
  try {
    const deviceModel = await DeviceInfo.getModel();
    const appVersion  = DeviceInfo.getVersion();

    const res = await fetch(`${apiBaseUrl}/api/user/device-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        fcmToken,
        platform: Platform.OS,
        deviceModel,
        appVersion,
      }),
    });

    if (!res.ok) {
      console.error('[Notification] Failed to register token:', res.status);
      return false;
    }
    console.log('[Notification] Token registered with backend');
    return true;
  } catch (err) {
    console.error('[Notification] Error sending token to backend:', err);
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise FCM: request permission, get token, register with backend,
 * and set up foreground + token-refresh listeners.
 *
 * Call once from the app root (e.g. App.tsx useEffect).
 */
export async function initNotifications(
  apiBaseUrl: string,
  userId: string,
): Promise<void> {
  const token = await requestPermissionAndGetToken();
  if (!token) return;

  // Persist locally so we can detect changes on next launch
  const prevToken = await AsyncStorage.getItem(STORAGE_KEY_FCM);
  if (token !== prevToken) {
    await sendTokenToBackend(token, apiBaseUrl, userId);
    await AsyncStorage.setItem(STORAGE_KEY_FCM, token);
  }

  // ── Token refresh listener ───────────────────────────────────────────────
  messaging().onTokenRefresh(async newToken => {
    console.log('[Notification] Token refreshed');
    await sendTokenToBackend(newToken, apiBaseUrl, userId);
    await AsyncStorage.setItem(STORAGE_KEY_FCM, newToken);
  });

  // ── Foreground message listener ──────────────────────────────────────────
  messaging().onMessage(async remoteMessage => {
    console.log('[Notification] Foreground message:', remoteMessage.messageId);
    const { notification, data } = remoteMessage;
    if (notification) {
      await displayNotification(
        notification.title ?? 'VXT Alert',
        notification.body  ?? '',
        data as Record<string, string> | undefined,
      );
    }
  });
}

/**
 * Set up background message handler.
 * Must be called at the TOP level (index.js), outside any component.
 */
export function registerBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('[Notification] Background message:', remoteMessage.messageId);
    // Notifee will auto-display if the message contains a `notification` key.
    // For data-only messages, display manually:
    const { notification, data } = remoteMessage;
    if (notification) {
      await displayNotification(
        notification.title ?? 'VXT Alert',
        notification.body  ?? '',
        data as Record<string, string> | undefined,
      );
    }
  });
}
