import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { DrawerContext } from '../context/DrawerContext';
import { loadDataSource } from '../hooks/useDataSource';
import { loadUserProfile } from '../hooks/useUserProfile';
import InviteUserScreen from './InviteUserScreen';

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

interface CustomerEntity {
  customerEntityId: number;
  customerId: number;
  customerName: string;
  entityId: string;
  entityName: string;
  entityTypeCode: string;
  active: string;
}

type SubPage = 'list' | 'inviteUser';

export default function CustomerEntitiesScreen() {
  const { openDrawer } = useContext(DrawerContext);
  const [entities, setEntities] = useState<CustomerEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Y' | 'N'>('all');
  const [subPage, setSubPage] = useState<SubPage>('list');
  const [authorizedEntityIds, setAuthorizedEntityIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    (async () => {
      const ds = await loadDataSource();
      setBaseUrl(ds.baseUrl);
    })();
  }, []);

  // Fetch authorized entity IDs for the current user
  useEffect(() => {
    (async () => {
      if (!baseUrl) return;
      const userEmail = auth().currentUser?.email;
      if (!userEmail) return;
      try {
        const res = await fetch(`${baseUrl}/entities?email=${encodeURIComponent(userEmail)}`);
        if (res.ok) {
          const data = await res.json();
          setAuthorizedEntityIds(new Set(data.map((e: any) => String(e.entityId))));
        }
      } catch { /* best-effort */ }
    })();
  }, [baseUrl]);

  const fetchEntities = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${baseUrl}/customerentities${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntities(data);
    } catch (e: any) {
      Alert.alert('Error', `Failed to load customer entities: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, statusFilter]);

  useEffect(() => {
    if (baseUrl) fetchEntities();
  }, [baseUrl, statusFilter]);

  const filtered = entities.filter(e => {
    // Filter by user authorization
    if (authorizedEntityIds && !authorizedEntityIds.has(String(e.entityId))) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      e.customerName?.toLowerCase().includes(q) ||
      e.entityId?.toLowerCase().includes(q) ||
      e.entityName?.toLowerCase().includes(q) ||
      e.entityTypeCode?.toLowerCase().includes(q)
    );
  });

  // Derive customerId from entities (user's customer)
  const derivedCustomerId = entities.length > 0 ? entities[0].customerId : 0;

  // ── Sub-page routing ────────────────────────────────
  if (subPage === 'inviteUser' && baseUrl) {
    return (
      <InviteUserScreen
        baseUrl={baseUrl}
        customerId={derivedCustomerId}
        onBack={() => { setSubPage('list'); fetchEntities(); }}
      />
    );
  }

  // ── Main list ───────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>🏢 Entities</Text>
          <Text style={styles.subtitle}>Manage entities & invite users</Text>
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer, entity, type..."
          placeholderTextColor={C.textMuted}
          value={filter}
          onChangeText={setFilter}
        />
      </View>

      {/* Filter buttons row */}
      <View style={styles.filterBtnRow}>
        {(['all', 'Y', 'N'] as const).map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterBtn, statusFilter === s && styles.filterBtnActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterBtnText, statusFilter === s && styles.filterBtnTextActive]}>
              {s === 'all' ? 'All' : s === 'Y' ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: C.blue }]} onPress={() => setSubPage('inviteUser')}>
          <Text style={[styles.filterBtnText, { color: '#fff' }]}>📨 Invite User</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.customerEntityId)}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.customerName}</Text>
                  <Text style={styles.entityName}>{item.entityName || item.entityId}</Text>
                  <Text style={styles.cardSub}>ID: {item.entityId}</Text>
                  {item.entityTypeCode ? (
                    <Text style={styles.cardSub}>Type: {item.entityTypeCode}</Text>
                  ) : null}
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: item.active === 'Y' ? C.green + '22' : C.red + '22' },
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: item.active === 'Y' ? C.green : C.red },
                  ]}>
                    {item.active === 'Y' ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 40 }]}>
              No customer entities found
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  pageHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  menuBtn: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center',
  },
  menuBtnText: { fontSize: 22, color: C.textPrimary },
  title: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  filterBar: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  searchInput: {
    backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 8, color: C.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: C.border,
  },
  filterBtnRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
    flexWrap: 'wrap', gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
  },
  filterBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  filterBtnText: { fontSize: 13, color: C.textMuted },
  filterBtnTextActive: { color: '#fff', fontWeight: '600' },
  card: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  entityName: { fontSize: 14, fontWeight: '500', color: C.green, marginTop: 2 },
  cardSub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
});
