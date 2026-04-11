# Subscription Access & Notification Management — Architecture

## Overview

This system manages **who** has access to IoT subscriptions (maritime vessels, health patients) and **how** they receive push notifications. It spans three layers: React Native mobile screens, FastAPI backend endpoints, and Azure SQL tables.

---

## Database Schema

```
┌──────────────┐     ┌────────────────────────┐     ┌──────────────────┐
│   Customers  │────▶│ CustomerSubscriptions   │◀────│     Event        │
│              │     │ (entityId, eventId,     │     │ (eventCode)      │
│              │     │  active, dates)         │     │                  │
└──────────────┘     └────────────┬───────────┘     └──────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │                           │
           ┌────────▼──────────┐    ┌───────────▼──────────────┐
           │ UserAuthorization │    │ UserAppPushNotification   │
           │ (userId, role,    │    │ (userApplicationId,       │
           │  active)          │    │  enabled, minSeverity,    │
           └────────┬──────────┘    │  quietHours, sound, etc.) │
                    │               └───────────┬──────────────┘
           ┌────────▼──────────┐    ┌───────────▼──────────────┐
           │    AppUser        │    │   UserApplication         │
           │ (firebaseUid,    │────▶│ (platform, fcmToken,     │
           │  email, customer) │    │  deviceModel, appVersion) │
           └───────────────────┘    └──────────────────────────┘
```

### Key Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `CustomerSubscriptions` | What is being monitored (entity + event) | `customerSubscriptionId`, `entityId`, `eventId`, `active` |
| `AppUser` | Firebase Auth users | `userId`, `firebaseUid`, `email`, `customerId` |
| `UserAuthorization` | RBAC: who can see what | `userId` → `customerSubscriptionId`, `role` (owner/admin/viewer) |
| `UserApplication` | Device registration (FCM tokens) | `userId`, `fcmToken`, `platform`, `deviceModel` |
| `UserAppPushNotification` | Per-device, per-subscription notification preferences | `userApplicationId` → `customerSubscriptionId`, `enabled`, `minSeverity`, quiet hours |

### Relationship Chain (Push Notification Flow)

```
Customer → CustomerSubscriptions → UserAuthorization → AppUser
                                                          ↓
                                              UserApplication (fcmToken)
                                                          ↓
                                        UserAppPushNotification (preferences)
```

---

## API Endpoints (FastAPI — main.py)

### Authorization Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/customersubscriptions/{id}/authorizations` | List all authorized users for a subscription |
| `PUT` | `/authorizations/{auth_id}` | Update role or revoke access (`active` → `N`) |
| `POST` | `/customersubscriptions/{id}/invite` | Invite user by email — creates AppUser + UserAuthorization + Firebase sign-in link |

### User's Own View

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/users/{user_id}/subscriptions` | Get all subscriptions a user has access to |
| `GET` | `/users/{user_id}/push-settings` | Get push notification settings across subscriptions |
| `POST` | `/users/{user_id}/push-settings` | Create default push setting for a subscription |
| `PUT` | `/push-settings/{setting_id}` | Update notification preferences (severity, quiet hours, sound, etc.) |
| `GET` | `/users/by-email/{email}` | Look up an AppUser by email |

### Invitation Flow (POST `/customersubscriptions/{id}/invite`)

```
1. Validate email + role
2. Look up subscription → get customerId
3. Find or create AppUser:
   a. If email exists in AppUser → use existing userId
   b. If not → create Firebase Auth user → insert AppUser row
4. Create or reactivate UserAuthorization (upsert on userId + subscriptionId)
5. Generate Firebase sign-in link (email link auth)
6. Return success with invitation status
```

---

## React Native Screens

### Screen A: SubscriptionManagementScreen (📋 Subscriptions)

**File**: `src/screens/SubscriptionManagementScreen.tsx`

- **Main list view**: Shows all `CustomerSubscriptions` with search filter and status filter (All / Active / Inactive)
- **Active toggle**: Switch to enable/disable subscription (auto-saves via `PUT /customersubscriptions/{id}`)
- **"User Roles" button**: Opens `UserRolesScreen` for that subscription
- **"My Notifications" button**: Opens `NotificationSettingsScreen` for the logged-in user
- **Navigation**: Sub-page routing via `subPage` state (no external navigation library)

### Sub-Screen: UserRolesScreen (👥 User Roles)

**File**: `src/screens/UserRolesScreen.tsx`

- **User list**: Shows all `UserAuthorization` entries for a subscription with email, role, and active status
- **Revoke/restore toggle**: Switch sets `UserAuthorization.active` to `Y`/`N` (auto-saves)
- **Role selector**: Chip buttons (viewer / admin / owner) — auto-saves on tap
- **"Invite New User" button**: Opens modal with email input + role selector
- **Invite modal**: Sends `POST /customersubscriptions/{id}/invite` with `{ email, role }`

### Screen B: NotificationSettingsScreen (🔔 Notification Settings)

**File**: `src/screens/NotificationSettingsScreen.tsx`

- **Subscription list**: Shows all subscriptions the user has been granted access to (via `GET /users/{id}/subscriptions`)
- **Status indicators**: Green/red dot for enabled/disabled, severity level color-coded
- **Settings modal** (on tap):
  - Toggle: Enable Push Notifications
  - Severity selector: LOW / MEDIUM / HIGH / CRITICAL (chip buttons)
  - Quiet Hours: Start time / End time (HH:MM)
  - Alert options: Sound, Vibration, LED toggles
- **Save**: Creates new `UserAppPushNotification` row or updates existing via API

---

## Drawer Navigation

Added to `App.tsx`:

```
type Screen = ... | 'Subscriptions';

MENU_ITEMS = [
  ...existing items...,
  { key: 'Subscriptions', label: 'Subscriptions', icon: '📋' },
  { key: 'UserProfile', ... },
];
```

---

## End-to-End Flow

### Admin invites a user:

```
Admin opens app → 📋 Subscriptions → picks a subscription
  → 👥 User Roles → ➕ Invite New User
  → enters email + role → Send Invitation
  → API creates AppUser (Firebase Auth) + UserAuthorization
  → Firebase sends sign-in email to invitee
```

### Invitee configures notifications:

```
Invitee installs app → registers via Firebase email link
  → App gets FCM token → POST /api/user/device-token
  → Opens 📋 Subscriptions → 🔔 My Notifications
  → Sees granted subscriptions → taps one
  → Configures: enable push, min severity, quiet hours, sound
  → Save → API creates/updates UserAppPushNotification
```

### Push notification delivery:

```
subscription_analysis_worker.py detects anomaly
  → Queries: CustomerSubscriptions → UserAppPushNotification → UserApplication
  → Filters: active, enabled, severity ≥ minSeverity, not in quiet hours
  → Firebase Admin SDK → FCM → Device notification
```

---

## Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `main.py` | Modified | Added 8 new API endpoints for authorization + push settings |
| `src/screens/SubscriptionManagementScreen.tsx` | Created | Main subscription list with sub-page navigation |
| `src/screens/UserRolesScreen.tsx` | Created | User authorization management + invite modal |
| `src/screens/NotificationSettingsScreen.tsx` | Created | Push notification preferences per subscription |
| `App.tsx` | Modified | Added 'Subscriptions' to drawer navigation |
| `docs/SUBSCRIPTION_ACCESS_ARCHITECTURE.md` | Created | This document |
