import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch,
  Alert, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { DrawerContext } from '../context/DrawerContext';
import { loadDataSource } from '../hooks/useDataSource';

const C = {
  bg:          '#0d1117',
  card:        '#161b22',
  border:      '#30363d',
  textPrimary: '#e6edf3',
  textMuted:   '#8b949e',
  blue:        '#388bfd',
  green:       '#3fb950',
  red:         '#da3633',
  orange:      '#d29922',
};

const ROLES = ['viewer', 'admin', 'owner'] as const;

interface Authorization {
  userAuthorizationId: number;
  userId: number;
  email: string;
  displayName: string;
  customerSubscriptionId: number;
  entityId: number | null;
  customerName: string;
  eventCode: string | null;
  role: string;
  active: string;
  createDate: string | null;
}

export default function UserAuthorizationScreen() {
  const { openDrawer } = useContext(DrawerContext);
  const [baseUrl, setBaseUrl] = useState('');
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [filterActive, setFilterActive] = useState<string | null>(null); // 'Y', 'N', or null (all)

  useEffect(() => {
    (async () => {
      const ds = await loadDataSource();
      setBaseUrl(ds.baseUrl);
    })();
  }, []);

  const fetchAuthorizations = useCallback(async () => {
    if (!baseUrl) return;
    try {
      const userEmail = auth().currentUser?.email || '';
      const emailParam = userEmail ? `?email=${encodeURIComponent(userEmail)}` : '';
      const res = await fetch(`${baseUrl}/admin/authorizations${emailParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAuthorizations(await res.json());
    } catch (e: any) {
      Alert.alert('Error', `Failed to load authorizations: ${e.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baseUrl]);

  useEffect(() => { if (baseUrl) fetchAuthorizations(); }, [baseUrl, fetchAuthorizations]);

  const onRefresh = () => { setRefreshing(true); fetchAuthorizations(); };

  const toggleActive = async (auth: Authorization) => {
    const newActive = auth.active === 'Y' ? 'N' : 'Y';
    try {
      const res = await fetch(`${baseUrl}/authorizations/${auth.userAuthorizationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAuthorizations(prev =>
        prev.map(a =>
          a.userAuthorizationId === auth.userAuthorizationId ? { ...a, active: newActive } : a
        ),
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const updateRole = async (auth: Authorization, newRole: string) => {
    try {
      const res = await fetch(`${baseUrl}/authorizations/${auth.userAuthorizationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAuthorizations(prev =>
        prev.map(a =>
          a.userAuthorizationId === auth.userAuthorizationId ? { ...a, role: newRole } : a
        ),
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const roleColor = (role: string) =>
    role === 'owner' ? C.orange : role === 'admin' ? C.blue : C.green;

  const filtered = authorizations.filter(a => {
    if (filterActive && a.active !== filterActive) return false;
    if (filterRole && a.role !== filterRole) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const match =
        (a.displayName || '').toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.customerName || '').toLowerCase().includes(q) ||
        (a.eventCode || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>🔑 User Authorizations</Text>
          <Text style={styles.subtitle}>
            {filtered.length} shown • {authorizations.filter(a => a.active === 'Y').length} active / {authorizations.length} total
          </Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, email, customer..."
          placeholderTextColor={C.textMuted}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Filter chips */}
      <View style={styles.chipRow}>
        {/* Status filters */}
        {[
          { label: 'All', val: null },
          { label: 'Active', val: 'Y' },
          { label: 'Revoked', val: 'N' },
        ].map(f => (
          <TouchableOpacity
            key={f.label}
            style={[styles.filterChip, filterActive === f.val && styles.filterChipActive]}
            onPress={() => setFilterActive(f.val)}
          >
            <Text style={[styles.filterChipText, filterActive === f.val && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={styles.chipSeparator} />

        {/* Role filters */}
        {[
          { label: 'All Roles', val: null },
          ...ROLES.map(r => ({ label: r.charAt(0).toUpperCase() + r.slice(1), val: r })),
        ].map(f => (
          <TouchableOpacity
            key={f.label}
            style={[
              styles.filterChip,
              filterRole === f.val && styles.filterChipActive,
              filterRole === f.val && f.val && { backgroundColor: roleColor(f.val) + '33', borderColor: roleColor(f.val) },
            ]}
            onPress={() => setFilterRole(f.val)}
          >
            <Text style={[
              styles.filterChipText,
              filterRole === f.val && styles.filterChipTextActive,
              filterRole === f.val && f.val && { color: roleColor(f.val) },
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.userAuthorizationId)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
          renderItem={({ item }) => (
            <View style={[styles.card, item.active === 'N' && styles.cardRevoked]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{item.displayName || item.email}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  <Text style={styles.subInfo}>
                    {item.customerName} • Entity {item.entityId} • {item.eventCode || '—'}
                  </Text>
                  {item.createDate && (
                    <Text style={styles.dateTxt}>Added {new Date(item.createDate).toLocaleDateString()}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Switch
                    value={item.active === 'Y'}
                    onValueChange={() => toggleActive(item)}
                    trackColor={{ false: C.border, true: C.green }}
                    thumbColor={item.active === 'Y' ? '#fff' : C.textMuted}
                  />
                  <Text style={[styles.statusTxt, { color: item.active === 'Y' ? C.green : C.red }]}>
                    {item.active === 'Y' ? 'Active' : 'Revoked'}
                  </Text>
                </View>
              </View>
              {/* Role selector */}
              <View style={styles.roleRow}>
                <Text style={styles.roleLabel}>Role:</Text>
                {ROLES.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, item.role === r && { backgroundColor: roleColor(r), borderColor: roleColor(r) }]}
                    onPress={() => updateRole(item, r)}
                  >
                    <Text style={[styles.roleChipText, item.role === r && { color: '#fff', fontWeight: '600' }]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={styles.userName}>No authorizations found</Text>
              <Text style={styles.userEmail}>Invite users from Subscriptions screen</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  menuBtn: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: C.card,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  menuBtnText: { fontSize: 22, color: C.textPrimary },
  title: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  filterBar: {
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4,
  },
  searchInput: {
    backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, color: C.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: C.border,
  },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingBottom: 8, gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  filterChipActive: { borderColor: C.blue, backgroundColor: C.blue + '22' },
  filterChipText: { fontSize: 12, color: C.textMuted },
  filterChipTextActive: { color: C.blue, fontWeight: '600' },
  chipSeparator: { width: 1, backgroundColor: C.border, marginHorizontal: 2, alignSelf: 'stretch' },
  card: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 14,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardRevoked: { opacity: 0.55 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  userName: { color: C.textPrimary, fontSize: 16, fontWeight: '600' },
  userEmail: { color: C.textMuted, fontSize: 13, marginTop: 2 },
  subInfo: { color: C.blue, fontSize: 12, marginTop: 4 },
  dateTxt: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  statusTxt: { fontSize: 11, marginTop: 4 },
  roleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  roleLabel: { color: C.textMuted, fontSize: 13, marginRight: 8 },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 6,
  },
  roleChipText: { color: C.textMuted, fontSize: 12 },
});
