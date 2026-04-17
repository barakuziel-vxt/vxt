# Firebase Configuration - VXT Mobile Setup

**Date**: April 17, 2026  
**Status**: ✅ Configured and Ready for Deployment

---

## Firebase Project Details

- **Project ID**: `vxt-iot-3ad8f`
- **Project Number**: `775916202887`
- **Android Package**: `com.vxtmobile`
- **Account**: einbar.vxt@gmail.com

---

## File Locations

### Backend (Python)
**Service Account Key**:
- Location: `c:\VXT\firebase-service-account.json`
- Original: `c:\VXT-Firebase\vxt-iot-3ad8f-firebase-adminsdk-fbsvc-4134978351.json`
- Status: ✅ Copied and ready
- Usage: `main.py`, `subscription_analysis_worker.py`, `azure-functions/`
- Environment Variable: `FIREBASE_SERVICE_ACCOUNT_PATH=c:\VXT\firebase-service-account.json`

### Mobile (Android)
**Google Services Configuration**:
- Location: `c:\VXT\vxt-mobile\android\app\google-services.json`
- Status: ✅ Present and configured
- Package: `com.vxtmobile`
- API Key: `AIzaSyCe3MtbtM1OeYCVYCv2UELh9KQbJrwB6Fg`

---

## Source Control

Both sensitive files are protected by `.gitignore`:

```
# .gitignore entries
firebase-service-account.json  # Backend service account (NOT committed)
google-services.json           # Mobile config (NOT committed, regenerate if needed)
```

**Important**: These files contain API keys and should NEVER be committed to Git. If accidentally exposed:
1. Regenerate in Firebase Console
2. Rotate credentials immediately
3. Update all deployment environments

---

## Deployment Checklist

- ✅ Firebase project created: `vxt-iot-3ad8f`
- ✅ Android app registered in Firebase Console
- ✅ `google-services.json` present in `android/app/`
- ✅ Service account key copied to backend
- ✅ React Native Firebase packages installed
- ✅ Android SDK updated to API 35
- ✅ Dependencies resolved (async-storage 2.2.0, react-native-screens 4.24.0)

---

## Next Steps

1. **Deploy to Note20**:
   ```bash
   cd c:\VXT\vxt-mobile
   npm run android
   ```

2. **Verify on Device**:
   - App should launch without Firebase errors
   - Push notifications should be deliverable
   - Auth should initialize on startup

3. **Monitor Backend**:
   - Check `main.py` logs for Firebase Admin SDK initialization
   - Verify service account authentication succeeds

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Firebase module not installed" | Run `npm install` and rebuild with `npm run android` |
| "API key not valid" | Check `google-services.json` has correct API key |
| "Auth initialization failed" | Verify service account file at `c:\VXT\firebase-service-account.json` |
| "No emulator/device" | Connect Note20 via USB and enable Developer Mode |

---

## References

- Firebase Console: https://console.firebase.google.com/project/vxt-iot-3ad8f
- React Native Firebase: https://rnfirebase.io/
- Original Setup: [FIREBASE_PUSH_NOTIFICATION_SETUP.md](./FIREBASE_PUSH_NOTIFICATION_SETUP.md)
