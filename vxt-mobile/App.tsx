import React from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  StyleSheet,
  Platform,
  I18nManager,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { useAuthStore } from './src/store/authStore';
import LoginScreen from './src/screens/LoginScreen';
import { DrawerContext } from './src/context/DrawerContext';
import { initNotifications } from './src/services/NotificationService';
import { loadDataSource } from './src/hooks/useDataSource';
import { loadUserProfile } from './src/hooks/useUserProfile';
import GatewayStatusScreen from './src/screens/GatewayStatusScreen';
import DriverSelectorScreen from './src/screens/DriverSelectorScreen';
import HealthVitalsScreen from './src/screens/HealthVitalsScreen';
import EntityTelemetryRN from './src/screens/EntityTelemetryRN';
import ReportManuallyScreen from './src/screens/ReportManuallyScreen';
import DataSourceScreen from './src/screens/DataSourceScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import SubscriptionManagementScreen from './src/screens/SubscriptionManagementScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import UserAuthorizationScreen from './src/screens/UserAuthorizationScreen';
import { driverManager } from './src/core/DriverManager';
import { SamsungHealthDriver } from './src/drivers/SamsungHealthDriver';
import { HealthConnectDriver } from './src/drivers/HealthConnectDriver';
import { SignalKDriver } from './src/drivers/SignalKDriver';
import { AppleHealthDriver } from './src/drivers/AppleHealthDriver';

// ─── Driver bootstrap (runs once at module load) ────────────────────────────
// userId is set to '' here — the real value is loaded from User Profile
// and pushed to the active driver via setUserId() when startDriver() runs.
if (Platform.OS === 'android') {
  driverManager.register(new SamsungHealthDriver('', 60_000));
  driverManager.register(new HealthConnectDriver('', 60_000));
}
driverManager.register(new SignalKDriver('', 60_000));
driverManager.register(new AppleHealthDriver());
// ────────────────────────────────────────────────────────────────────────────


type Screen = 'Vitals' | 'Status' | 'Driver' | 'Telemetry' | 'ReportManually' | 'DataSource' | 'UserProfile' | 'Subscriptions' | 'PushNotifications' | 'UserAuthorizations';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.round(SCREEN_W * 0.72);
const isRTL = I18nManager.isRTL;

const C = {
  bg:          '#0d1117',
  card:        '#161b22',
  border:      '#30363d',
  textPrimary: '#e6edf3',
  textMuted:   '#8b949e',
  blue:        '#388bfd',
  green:       '#3fb950',
};

const MENU_ITEMS: { key: Screen; label: string; icon: string }[] = [
  { key: 'Vitals',         label: 'Health Vitals',    icon: '💓' },
  { key: 'Telemetry',      label: 'Entity Telemetry', icon: '📊' },
  { key: 'ReportManually', label: 'Report Manually',  icon: '📝' },
  { key: 'Status',         label: 'Event Hub',        icon: '⚡' },
  { key: 'Driver',         label: 'Driver Selection', icon: '🔌' },
  { key: 'DataSource',     label: 'API Endpoints',    icon: '🌐' },
  { key: 'Subscriptions',  label: 'Subscriptions',    icon: '📋' },
  { key: 'PushNotifications', label: 'Push Notifications', icon: '🔔' },
  { key: 'UserAuthorizations', label: 'User Authorizations', icon: '🔑' },
  { key: 'UserProfile',    label: 'User Profile',     icon: '👤' },
];

export default function App() {
  const { user, initialized, setUser, setInitialized } = useAuthStore();

  // Listen to Firebase Auth state changes
  React.useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((fbUser) => {
      setUser(fbUser);
      if (!initialized) setInitialized();
    });
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show loading while Firebase initializes
  if (!initialized) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: C.textMuted, fontSize: 16 }}>Loading...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // Not signed in → show login
  if (!user) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <LoginScreen onAuthenticated={() => {
          // Force re-render — onAuthStateChanged will update the store
          auth().currentUser?.reload();
        }} />
      </SafeAreaProvider>
    );
  }

  // Signed in → show main app
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppShell />
    </SafeAreaProvider>
  );
}

function PushNotificationsWrapper() {
  const { openDrawer } = React.useContext(DrawerContext);
  const [baseUrl, setBaseUrl] = React.useState('');
  const [userId, setUserId] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    (async () => {
      const [ds, profile] = await Promise.all([loadDataSource(), loadUserProfile()]);
      setBaseUrl(ds.baseUrl);
      setUserId(profile.userId);
      setLoading(false);
    })();
  }, []);
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity onPress={openDrawer} style={{ position: 'absolute', top: 50, left: 16, width: 40, height: 40, borderRadius: 8, backgroundColor: '#161b22', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, color: '#e6edf3' }}>☰</Text>
        </TouchableOpacity>
        <Text style={{ color: '#8b949e', fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }
  if (!baseUrl || !userId) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <TouchableOpacity onPress={openDrawer} style={{ position: 'absolute', top: 50, left: 16, width: 40, height: 40, borderRadius: 8, backgroundColor: '#161b22', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, color: '#e6edf3' }}>☰</Text>
        </TouchableOpacity>
        <Text style={{ color: '#e6edf3', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>🔔 Push Notifications</Text>
        <Text style={{ color: '#8b949e', fontSize: 14, textAlign: 'center' }}>
          {!baseUrl ? 'Please configure your API endpoint in API Endpoints first.' : 'Please set your User ID in User Profile first.'}
        </Text>
      </View>
    );
  }
  return <NotificationSettingsScreen baseUrl={baseUrl} userId={userId} onBack={openDrawer} />;
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const [active, setActive]   = React.useState<Screen>('Telemetry');
  const [isOpen, setIsOpen]   = React.useState(false);

  // Initialize push notifications
  React.useEffect(() => {
    (async () => {
      try {
        const [ds, profile] = await Promise.all([loadDataSource(), loadUserProfile()]);
        if (ds.baseUrl && profile.userId) {
          await initNotifications(ds.baseUrl, profile.userId);
        }
      } catch (e) {
        console.warn('Push notification init failed:', e);
      }
    })();
  }, []);

  const hiddenValue    = isRTL ? DRAWER_W : -DRAWER_W;
  const translateX     = React.useRef(new Animated.Value(hiddenValue)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;

  function openDrawer() {
    setIsOpen(true);
    Animated.parallel([
      Animated.timing(translateX,      { toValue: 0,   duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 1,   duration: 260, useNativeDriver: true }),
    ]).start();
  }

  function closeDrawer() {
    Animated.parallel([
      Animated.timing(translateX,      { toValue: hiddenValue, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0,         duration: 220, useNativeDriver: true }),
    ]).start(() => setIsOpen(false));
  }

  function navigate(screen: Screen) {
    setActive(screen);
    closeDrawer();
  }

  function navigateTo(screen: string) {
    const validScreens: Screen[] = ['Vitals','Status','Driver','Telemetry','ReportManually','DataSource','UserProfile','Subscriptions','PushNotifications','UserAuthorizations'];
    if (validScreens.includes(screen as Screen)) {
      setActive(screen as Screen);
    }
  }

  const ActiveScreen: React.ComponentType =
    active === 'Vitals'         ? HealthVitalsScreen :
    active === 'Telemetry'      ? EntityTelemetryRN :
    active === 'ReportManually' ? ReportManuallyScreen :
    active === 'Status'         ? GatewayStatusScreen :
    active === 'Driver'         ? DriverSelectorScreen :
    active === 'DataSource'     ? DataSourceScreen :
    active === 'UserProfile'    ? UserProfileScreen :
    active === 'Subscriptions'  ? SubscriptionManagementScreen :
    active === 'PushNotifications' ? PushNotificationsWrapper :
    active === 'UserAuthorizations' ? UserAuthorizationScreen :
    HealthVitalsScreen; // Default fallback

  return (
    <DrawerContext.Provider value={{ openDrawer, navigateTo }}>
      <View style={[styles.root, { paddingTop: insets.top }]}>

        {/* ── Active screen ─────────────────────────────────── */}
        <ActiveScreen />

        {/* ── Backdrop ──────────────────────────────────────── */}
        {isOpen && (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
            pointerEvents="box-only"
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeDrawer}
            />
          </Animated.View>
        )}

        {/* ── Drawer panel ──────────────────────────────────── */}
        <Animated.View
          style={[styles.drawer, { paddingTop: insets.top, transform: [{ translateX }] }]}
          pointerEvents={isOpen ? 'box-none' : 'none'}
        >
          {/* Drawer header */}
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>VXT</Text>
            <TouchableOpacity onPress={closeDrawer} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Menu items */}
          {MENU_ITEMS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.menuItem, active === item.key && styles.menuItemActive]}
              onPress={() => navigate(item.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={[styles.menuLabel, active === item.key && styles.menuLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Sign out */}
          <View style={{ borderTopWidth: 1, borderTopColor: C.border, marginTop: 12, paddingTop: 12 }}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { closeDrawer(); useAuthStore.getState().signOut(); }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>🚪</Text>
              <Text style={[styles.menuLabel, { color: '#da3633' }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

      </View>
    </DrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Backdrop ──────────────────────────────────────────
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },

  // ── Drawer ────────────────────────────────────────────
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: C.card,
    borderRightWidth: 1,
    borderRightColor: C.border,
    zIndex: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 8,
  },
  drawerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: C.textMuted,
    fontSize: 18,
    fontWeight: '300',
  },

  // ── Menu items ────────────────────────────────────────
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    marginHorizontal: 10,
    marginVertical: 2,
  },
  menuItemActive: {
    backgroundColor: C.blue + '22',
  },
  menuIcon: {
    fontSize: 20,
    marginEnd: 14,
  },
  menuLabel: {
    fontSize: 16,
    color: C.textPrimary,
    fontWeight: '600',
  },
  menuLabelActive: {
    color: C.blue,
    fontWeight: '700',
  },
});


