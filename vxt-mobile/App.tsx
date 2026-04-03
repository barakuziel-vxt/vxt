import React from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DrawerContext } from './src/context/DrawerContext';
import GatewayStatusScreen from './src/screens/GatewayStatusScreen';
import DriverSelectorScreen from './src/screens/DriverSelectorScreen';
import HealthVitalsScreen from './src/screens/HealthVitalsScreen';

type Screen = 'Vitals' | 'Status' | 'Driver';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.round(SCREEN_W * 0.72);

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
  { key: 'Vitals',  label: 'Health Vitals',    icon: '💓' },
  { key: 'Status',  label: 'VXT Gateway',       icon: '⚡' },
  { key: 'Driver',  label: 'Driver Selection',  icon: '🔌' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const [active, setActive]   = React.useState<Screen>('Vitals');
  const [isOpen, setIsOpen]   = React.useState(false);

  const translateX     = React.useRef(new Animated.Value(-DRAWER_W)).current;
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
      Animated.timing(translateX,      { toValue: -DRAWER_W, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0,         duration: 220, useNativeDriver: true }),
    ]).start(() => setIsOpen(false));
  }

  function navigate(screen: Screen) {
    setActive(screen);
    closeDrawer();
  }

  const ActiveScreen =
    active === 'Vitals'  ? HealthVitalsScreen :
    active === 'Status'  ? GatewayStatusScreen :
    DriverSelectorScreen;

  return (
    <DrawerContext.Provider value={{ openDrawer }}>
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
    marginRight: 14,
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


