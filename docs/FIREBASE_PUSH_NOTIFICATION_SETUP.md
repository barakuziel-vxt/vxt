# Firebase Push Notification Setup — VXT Project

Gmail account: **einbar.vxt@gmail.com**

---

## 1. Create the Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and sign in with **einbar.vxt@gmail.com**.
2. Click **Add project** → name it **`vxt-iot`** (or any name you prefer).
3. **Disable** Google Analytics for now (not needed for push notifications) → **Create project**.
4. Wait for provisioning, then click **Continue**.

---

## 2. Register the Android App

1. In the project overview, click the **Android** icon (Add app).
2. **Android package name**: `com.vxtmobile`  
   *(must match `applicationId` in your `vxt-mobile/android/app/build.gradle`)*
3. **App nickname**: `VXT Mobile`
4. Click **Register app**.
5. Download **`google-services.json`** and place it at:
   ```
   vxt-mobile/android/app/google-services.json
   ```
6. Skip the "Add Firebase SDK" step — the React Native Firebase library handles this.
7. Click **Continue to console**.

### Verify your `build.gradle` files

**`android/build.gradle`** — add to `dependencies` block:
```groovy
classpath 'com.google.gms:google-services:4.4.1'
```

**`android/app/build.gradle`** — add at the bottom:
```groovy
apply plugin: 'com.google.gms.google-services'
```

---

## 3. Register the iOS App (when ready)

1. Click **Add app** → iOS icon.
2. iOS bundle ID: `com.vxtmobile` (match your Xcode project).
3. Download **`GoogleService-Info.plist`** → place in `vxt-mobile/ios/`.
4. In Xcode: add the plist to the project target.

---

## 4. Generate the Service Account JSON (for the Python backend)

The Python worker (`subscription_analysis_worker.py`) uses the **Firebase Admin SDK** which needs a service account key.

1. In Firebase Console → **Project Settings** (gear icon) → **Service accounts** tab.
2. Click **Generate new private key** → **Generate key**.
3. A file like `vxt-iot-firebase-adminsdk-xxxxx.json` is downloaded.
4. **Keep this file secret — never commit it to Git.**

### Local development

Place the file at `c:\VXT\firebase-service-account.json` and add to your `.env`:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=c:\VXT\firebase-service-account.json
```

### Azure production (App Service / Function App)

Store the JSON as a single-line environment variable:

```powershell
# Encode the JSON to base64 for safe storage as an env var
$json = Get-Content "firebase-service-account.json" -Raw
$b64  = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))

# Set on the Web App
az webapp config appsettings set `
  --resource-group VXT-IoT-Hub `
  --name vxt-web-app `
  --settings FIREBASE_SERVICE_ACCOUNT_JSON="$b64"

# Set on the Function App (if needed there too)
az functionapp config appsettings set `
  --resource-group vxt-functions-linux `
  --name vxt-function `
  --settings FIREBASE_SERVICE_ACCOUNT_JSON="$b64"
```

The `_init_firebase()` method in the worker automatically handles both path and base64 forms.

---

## 5. Install the React Native Firebase library (mobile)

```bash
cd vxt-mobile
npm install @react-native-firebase/app @react-native-firebase/messaging
```

Then follow the [React Native Firebase setup guide](https://rnfirebase.io/) to link native modules (handled automatically with React Native 0.60+).

### Request FCM token in the app

```javascript
import messaging from '@react-native-firebase/messaging';

async function registerDevice() {
  const authStatus = await messaging().requestPermission();
  if (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  ) {
    const token = await messaging().getToken();
    // POST token to your API → save to UserApplication.fcmToken
    await api.updateFcmToken(token);
  }
}

// Refresh token listener
messaging().onTokenRefresh(token => {
  api.updateFcmToken(token);
});
```

---

## 6. API Endpoint to Save FCM Token

Your backend needs an endpoint to receive and store the FCM token per device. Example:

**POST** `/api/user/device-token`
```json
{
  "userApplicationId": 42,
  "fcmToken": "dxxxxxx...",
  "platform": "android",
  "deviceModel": "Pixel 8",
  "appVersion": "1.2.0"
}
```

This should `UPDATE dbo.UserApplication SET fcmToken = ?, lastActiveUTC = GETUTCDATE() WHERE userApplicationId = ?`

---

## 7. How Push Notifications Work (End-to-End)

```
Event detected in subscription_analysis_worker.py
  └─▶ register_event()  → saves EventLog row
  └─▶ send_push_notification()
        └─▶ SQL: CustomerSubscriptions JOIN UserAppPushNotification JOIN UserApplication JOIN AppUser
        └─▶ Filter: active, enabled, severity >= minSeverity, not in quiet hours
        └─▶ Firebase Admin SDK → FCM → Device
```

### Notification payload (data fields sent to mobile)

| Key | Example |
|-----|---------|
| `eventLogId` | `"1042"` |
| `eventId` | `"7"` |
| `entityId` | `"ent-001"` |
| `eventCode` | `"RAPID_ACCELERATION"` |
| `cumulativeScore` | `"85"` |
| `probability` | `"0.9200"` |
| `severity` | `"HIGH"` |

The mobile app receives these in the `data` map of the notification and can deep-link to the event detail screen.

---

## 8. Severity Mapping

| probability | severity |
|-------------|----------|
| ≥ 0.80 | HIGH |
| 0.50 – 0.79 | MEDIUM |
| < 0.50 | LOW |

A user whose `UserAppPushNotification.minSeverity = 'HIGH'` only receives HIGH events.

---

## 9. Per-Device Preferences Summary

| Column | Effect |
|--------|--------|
| `enabled` | Master switch — `'Y'` required to receive anything |
| `minSeverity` | Minimum severity threshold (LOW/MEDIUM/HIGH) |
| `quietHoursStart` / `quietHoursEnd` | UTC time window where no notifications are sent |
| `soundEnabled` | `'Y'` → `'default'` sound on Android & iOS |
| `vibrationEnabled` | `'Y'` → triggers Android vibration |
| `ledEnabled` | `'Y'` → enables Android LED light |
| `deliveryChannel` | Reserved for future channel routing (e.g., SMS, email) |

---

## 10. Firebase Console Monitoring

- **Firebase Console → Cloud Messaging** — view send history, delivery rates, errors.
- **Firebase Console → Project Settings → Cloud Messaging** — find your **Server key** (legacy) and **Sender ID** — the Sender ID goes in `google-services.json` automatically.
- Use **[Firebase Cloud Messaging REST tester](https://console.firebase.google.com/project/_/messaging/compose)** to send test messages to a specific FCM token during development.

---

## Security Notes

- The service account JSON gives **full admin access** to your Firebase project — treat like a password.
- Add `firebase-service-account.json` to `.gitignore` immediately.
- In Azure, store only as an App Setting (encrypted at rest), never in code.
- The FCM token in `UserApplication.fcmToken` identifies a specific device installation — do not log or expose it in API responses.
