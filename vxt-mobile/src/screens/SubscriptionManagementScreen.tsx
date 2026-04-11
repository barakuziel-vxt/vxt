import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch,
  Alert, ActivityIndicator, TextInput, Modal, ScrollView, Platform,
} from 'react-native';
import { DrawerContext } from '../context/DrawerContext';
import { loadDataSource } from '../hooks/useDataSource';
import { loadUserProfile } from '../hooks/useUserProfile';
import UserRolesScreen from './UserRolesScreen';
import NotificationSettingsScreen from './NotificationSettingsScreen';
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

type SubPage = 'list' | 'userRoles' | 'notificationSettings' | 'inviteUser';

interface Subscription {
  customerSubscriptionId: number;
  customerId: number;
  customerName: string;
  entityId: string;
  entityName: string;
  eventId: number | null;
  eventCode: string | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  active: string;
}

interface DropdownItem { id: number | string; label: string; }

export default function SubscriptionManagementScreen() {
  const { openDrawer } = useContext(DrawerContext);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Y' | 'N'>('all');
  const [subPage, setSubPage] = useState<SubPage>('list');
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [selectedSubLabel, setSelectedSubLabel] = useState('');

  // Edit/Create modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formEntityId, setFormEntityId] = useState('');
  const [formEventId, setFormEventId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formActive, setFormActive] = useState('Y');
  const [saving, setSaving] = useState(false);

  // Dropdown data for Edit form
  const [customers, setCustomers] = useState<DropdownItem[]>([]);
  const [events, setEvents] = useState<DropdownItem[]>([]);
  const [entities, setEntities] = useState<DropdownItem[]>([]);

  // Dropdown picker visibility
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');

  // Date picker helpers
  const years = useMemo(() => {
    const arr: string[] = [];
    for (let y = 2020; y <= 2035; y++) arr.push(String(y));
    return arr;
  }, []);
  const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const [pickYear, setPickYear] = useState('');
  const [pickMonth, setPickMonth] = useState('');
  const [pickDay, setPickDay] = useState('');
  const daysInMonth = useMemo(() => {
    const m = parseInt(pickMonth || '1', 10);
    const y = parseInt(pickYear || '2026', 10);
    const count = new Date(y, m, 0).getDate();
    const arr: string[] = [];
    for (let d = 1; d <= count; d++) arr.push(String(d).padStart(2, '0'));
    return arr;
  }, [pickYear, pickMonth]);

  useEffect(() => {
    (async () => {
      const [ds, profile] = await Promise.all([loadDataSource(), loadUserProfile()]);
      setBaseUrl(ds.baseUrl);
      setUserId(profile.userId);
    })();
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true);
    try {
      const statusParam = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`${baseUrl}/customersubscriptions${statusParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSubscriptions(data);
    } catch (e: any) {
      Alert.alert('Error', `Failed to load subscriptions: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, statusFilter]);

  useEffect(() => {
    if (baseUrl) fetchSubscriptions();
  }, [baseUrl, statusFilter]);

  // Fetch dropdown data for edit form
  const fetchFormData = async () => {
    if (!baseUrl) return;
    try {
      const [custRes, evtRes, entRes] = await Promise.all([
        fetch(`${baseUrl}/customers`),
        fetch(`${baseUrl}/events`),
        fetch(`${baseUrl}/entities`),
      ]);
      if (custRes.ok) {
        const data = await custRes.json();
        setCustomers(data.map((c: any) => ({ id: c.customerId, label: c.customerName })));
      }
      if (evtRes.ok) {
        const data = await evtRes.json();
        setEvents(data.map((e: any) => ({ id: e.eventId, label: e.eventCode || e.eventName || `Event ${e.eventId}` })));
      }
      if (entRes.ok) {
        const data = await entRes.json();
        setEntities(data.map((e: any) => ({
          id: e.entityId,
          label: `${e.entityFirstName || ''} ${e.entityLastName || ''}`.trim() || e.entityId,
        })));
      }
    } catch { /* dropdown data is best-effort */ }
  };

  const toggleActive = async (sub: Subscription) => {
    if (!baseUrl) return;
    const newActive = sub.active === 'Y' ? 'N' : 'Y';
    try {
      const res = await fetch(`${baseUrl}/customersubscriptions/${sub.customerSubscriptionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubscriptions(prev =>
        prev.map(s =>
          s.customerSubscriptionId === sub.customerSubscriptionId ? { ...s, active: newActive } : s,
        ),
      );
    } catch (e: any) {
      Alert.alert('Error', `Failed to update: ${e.message}`);
    }
  };

  // Convert a server date string to local YYYY-MM-DD
  const toLocalDateStr = (s: string | null | undefined): string => {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const openEditModal = (sub: Subscription | null) => {
    fetchFormData();
    if (sub) {
      setEditingSub(sub);
      setFormCustomerId(String(sub.customerId));
      setFormEntityId(sub.entityId);
      setFormEventId(sub.eventId ? String(sub.eventId) : '');
      setFormStartDate(toLocalDateStr(sub.subscriptionStartDate));
      setFormEndDate(toLocalDateStr(sub.subscriptionEndDate));
      setFormActive(sub.active);
    } else {
      setEditingSub(null);
      setFormCustomerId('');
      setFormEntityId('');
      setFormEventId('');
      setFormStartDate('');
      setFormEndDate('');
      setFormActive('Y');
    }
    setEditModalOpen(true);
  };

  const saveSubscription = async () => {
    if (!baseUrl || !formCustomerId || !formEntityId) {
      Alert.alert('Validation', 'Customer and Entity are required');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        customerId: formCustomerId,
        entityId: formEntityId,
        eventId: formEventId || null,
        subscriptionStartDate: formStartDate || null,
        subscriptionEndDate: formEndDate || null,
        active: formActive,
      };
      const url = editingSub
        ? `${baseUrl}/customersubscriptions/${editingSub.customerSubscriptionId}`
        : `${baseUrl}/customersubscriptions`;
      const res = await fetch(url, {
        method: editingSub ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      setEditModalOpen(false);
      fetchSubscriptions();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSubscription = (sub: Subscription) => {
    Alert.alert(
      'Delete Subscription',
      `Delete "${sub.entityName}" from ${sub.customerName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!baseUrl) return;
            try {
              const res = await fetch(`${baseUrl}/customersubscriptions/${sub.customerSubscriptionId}`, {
                method: 'DELETE',
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              setSubscriptions(prev =>
                prev.filter(s => s.customerSubscriptionId !== sub.customerSubscriptionId),
              );
            } catch (e: any) {
              Alert.alert('Error', `Failed to delete: ${e.message}`);
            }
          },
        },
      ],
    );
  };

  const filtered = subscriptions.filter(s => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      s.customerName?.toLowerCase().includes(q) ||
      s.entityId?.toLowerCase().includes(q) ||
      s.entityName?.toLowerCase().includes(q) ||
      s.eventCode?.toLowerCase().includes(q)
    );
  });

  const openUserRoles = (sub: Subscription) => {
    setSelectedSubId(sub.customerSubscriptionId);
    setSelectedSubLabel(`${sub.customerName} / ${sub.entityName}`);
    setSubPage('userRoles');
  };

  // ── Sub-page routing ────────────────────────────────
  if (subPage === 'userRoles' && selectedSubId != null) {
    return (
      <UserRolesScreen
        baseUrl={baseUrl!}
        customerSubscriptionId={selectedSubId}
        subscriptionLabel={selectedSubLabel}
        onBack={() => { setSubPage('list'); fetchSubscriptions(); }}
      />
    );
  }

  if (subPage === 'notificationSettings') {
    return (
      <NotificationSettingsScreen
        baseUrl={baseUrl!}
        userId={userId}
        onBack={() => setSubPage('list')}
      />
    );
  }

  if (subPage === 'inviteUser') {
    return (
      <InviteUserScreen
        baseUrl={baseUrl!}
        onBack={() => setSubPage('list')}
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
          <Text style={styles.title}>📋 Subscriptions</Text>
          <Text style={styles.subtitle}>Manage access & notifications</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => openEditModal(null)}>
          <Text style={styles.addBtnText}>＋ New</Text>
        </TouchableOpacity>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer, entity, event..."
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
          <Text style={[styles.filterBtnText, { color: '#fff' }]}>� Invite User</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.customerSubscriptionId)}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.customerName}</Text>
                  <Text style={styles.entityName}>{item.entityName}</Text>
                  <Text style={styles.cardSub}>ID: {item.entityId}</Text>
                  {item.eventCode && (
                    <Text style={styles.cardSub}>Event: {item.eventCode}</Text>
                  )}
                </View>
                <Switch
                  value={item.active === 'Y'}
                  onValueChange={() => toggleActive(item)}
                  trackColor={{ false: C.border, true: C.green }}
                  thumbColor={item.active === 'Y' ? '#fff' : C.textMuted}
                />
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.dateTxt}>
                  {item.subscriptionStartDate
                    ? new Date(item.subscriptionStartDate).toLocaleDateString()
                    : '—'}
                  {item.subscriptionEndDate ? ` → ${new Date(item.subscriptionEndDate).toLocaleDateString()}` : ''}
                </Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => openEditModal(item)}>
                    <Text style={styles.iconBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => deleteSubscription(item)}>
                    <Text style={styles.iconBtnText}>🗑️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rolesBtn} onPress={() => openUserRoles(item)}>
                    <Text style={styles.rolesBtnText}>👥 User Roles</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 40 }]}>
              No subscriptions found
            </Text>
          }
        />
      )}

      {/* Edit/Create Modal */}
      <Modal visible={editModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingSub ? '✏️ Edit Subscription' : '＋ New Subscription'}
              </Text>

              {/* Customer dropdown */}
              <Text style={styles.fieldLabel}>Customer</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowCustomerPicker(true)}>
                <Text style={styles.dropdownBtnText}>
                  {customers.find(c => String(c.id) === formCustomerId)?.label || 'Select Customer...'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>

              {/* Entity dropdown */}
              <Text style={styles.fieldLabel}>Entity</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => { setEntitySearch(''); setShowEntityPicker(true); }}>
                <Text style={styles.dropdownBtnText}>
                  {entities.find(e => String(e.id) === formEntityId)?.label || formEntityId || 'Select Entity...'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>

              {/* Event dropdown */}
              <Text style={styles.fieldLabel}>Event (optional)</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowEventPicker(true)}>
                <Text style={styles.dropdownBtnText}>
                  {formEventId ? (events.find(e => String(e.id) === formEventId)?.label || `Event ${formEventId}`) : 'None'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>

              {/* Start Date picker */}
              <Text style={styles.fieldLabel}>Start Date</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => {
                const parts = (formStartDate || '').split('-');
                setPickYear(parts[0] || String(new Date().getFullYear()));
                setPickMonth(parts[1] || String(new Date().getMonth() + 1).padStart(2, '0'));
                setPickDay(parts[2] || String(new Date().getDate()).padStart(2, '0'));
                setShowStartPicker(true);
              }}>
                <Text style={styles.dropdownBtnText}>
                  {formStartDate ? formStartDate.split('T')[0] : 'Select Start Date...'}
                </Text>
                <Text style={styles.dropdownArrow}>📅</Text>
              </TouchableOpacity>

              {/* End Date picker */}
              <Text style={styles.fieldLabel}>End Date (optional)</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => {
                const parts = (formEndDate || '').split('-');
                setPickYear(parts[0] || String(new Date().getFullYear()));
                setPickMonth(parts[1] || String(new Date().getMonth() + 1).padStart(2, '0'));
                setPickDay(parts[2] || String(new Date().getDate()).padStart(2, '0'));
                setShowEndPicker(true);
              }}>
                <Text style={styles.dropdownBtnText}>
                  {formEndDate ? formEndDate.split('T')[0] : 'No end date'}
                </Text>
                <Text style={styles.dropdownArrow}>📅</Text>
              </TouchableOpacity>

              <View style={[styles.settingRow, { marginTop: 12 }]}>
                <Text style={styles.settingLabel}>Active</Text>
                <Switch
                  value={formActive === 'Y'}
                  onValueChange={v => setFormActive(v ? 'Y' : 'N')}
                  trackColor={{ false: C.border, true: C.green }}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: C.border }]}
                  onPress={() => setEditModalOpen(false)}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: C.blue }]}
                  onPress={saveSubscription}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnText}>{editingSub ? 'Save' : 'Create'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Customer Picker Modal */}
      <Modal visible={showCustomerPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Customer</Text>
            <FlatList
              data={customers}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, formCustomerId === String(item.id) && styles.pickerItemActive]}
                  onPress={() => { setFormCustomerId(String(item.id)); setShowCustomerPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, formCustomerId === String(item.id) && styles.pickerItemTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowCustomerPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Entity Picker Modal */}
      <Modal visible={showEntityPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Entity</Text>
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              placeholder="Search entities..."
              placeholderTextColor={C.textMuted}
              value={entitySearch}
              onChangeText={setEntitySearch}
              autoFocus
            />
            <FlatList
              data={entities.filter(e =>
                e.label.toLowerCase().includes(entitySearch.toLowerCase()) ||
                String(e.id).toLowerCase().includes(entitySearch.toLowerCase())
              )}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, formEntityId === String(item.id) && styles.pickerItemActive]}
                  onPress={() => { setFormEntityId(String(item.id)); setShowEntityPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, formEntityId === String(item.id) && styles.pickerItemTextActive]}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>{item.id}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowEntityPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Event Picker Modal */}
      <Modal visible={showEventPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Event</Text>
            <FlatList
              data={[{ id: '', label: 'None' }, ...events]}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, formEventId === String(item.id) && styles.pickerItemActive]}
                  onPress={() => { setFormEventId(String(item.id)); setShowEventPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, formEventId === String(item.id) && styles.pickerItemTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowEventPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Start Date Picker Modal */}
      <Modal visible={showStartPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Start Date</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateColLabel}>Year</Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  {years.map(y => (
                    <TouchableOpacity key={y} style={[styles.pickerItem, pickYear === y && styles.pickerItemActive]}
                      onPress={() => setPickYear(y)}>
                      <Text style={[styles.pickerItemText, pickYear === y && styles.pickerItemTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateColLabel}>Month</Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  {months.map(m => (
                    <TouchableOpacity key={m} style={[styles.pickerItem, pickMonth === m && styles.pickerItemActive]}
                      onPress={() => setPickMonth(m)}>
                      <Text style={[styles.pickerItemText, pickMonth === m && styles.pickerItemTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateColLabel}>Day</Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  {daysInMonth.map(d => (
                    <TouchableOpacity key={d} style={[styles.pickerItem, pickDay === d && styles.pickerItemActive]}
                      onPress={() => setPickDay(d)}>
                      <Text style={[styles.pickerItemText, pickDay === d && styles.pickerItemTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={[styles.pickerCancel, { flex: 1 }]} onPress={() => setShowStartPicker(false)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerCancel, { flex: 1, backgroundColor: C.blue }]}
                onPress={() => { setFormStartDate(`${pickYear}-${pickMonth}-${pickDay}`); setShowStartPicker(false); }}>
                <Text style={[styles.pickerCancelText, { color: '#fff' }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Date Picker Modal */}
      <Modal visible={showEndPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select End Date</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateColLabel}>Year</Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  {years.map(y => (
                    <TouchableOpacity key={y} style={[styles.pickerItem, pickYear === y && styles.pickerItemActive]}
                      onPress={() => setPickYear(y)}>
                      <Text style={[styles.pickerItemText, pickYear === y && styles.pickerItemTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateColLabel}>Month</Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  {months.map(m => (
                    <TouchableOpacity key={m} style={[styles.pickerItem, pickMonth === m && styles.pickerItemActive]}
                      onPress={() => setPickMonth(m)}>
                      <Text style={[styles.pickerItemText, pickMonth === m && styles.pickerItemTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateColLabel}>Day</Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  {daysInMonth.map(d => (
                    <TouchableOpacity key={d} style={[styles.pickerItem, pickDay === d && styles.pickerItemActive]}
                      onPress={() => setPickDay(d)}>
                      <Text style={[styles.pickerItemText, pickDay === d && styles.pickerItemTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={[styles.pickerCancel, { flex: 1 }]} onPress={() => setShowEndPicker(false)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerCancel, { flex: 1 }]}
                onPress={() => { setFormEndDate(''); setShowEndPicker(false); }}>
                <Text style={styles.pickerCancelText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerCancel, { flex: 1, backgroundColor: C.blue }]}
                onPress={() => { setFormEndDate(`${pickYear}-${pickMonth}-${pickDay}`); setShowEndPicker(false); }}>
                <Text style={[styles.pickerCancelText, { color: '#fff' }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: C.green,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
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
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  dateTxt: { fontSize: 12, color: C.textMuted },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  iconBtnText: { fontSize: 16 },
  rolesBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: C.blue,
  },
  rolesBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  // Edit/Create modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', padding: 20,
  },
  modalContent: {
    backgroundColor: C.card, borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: C.border, marginTop: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: C.textMuted, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, color: C.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: C.border,
  },
  chipScroll: { maxHeight: 44 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: C.blue, borderColor: C.blue },
  chipText: { fontSize: 13, color: C.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: { fontSize: 14, color: C.textPrimary },
  modalActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20,
  },
  modalBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    minWidth: 80, alignItems: 'center',
  },
  modalBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  // Dropdown button
  dropdownBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 12, borderWidth: 1, borderColor: C.border,
  },
  dropdownBtnText: { fontSize: 14, color: C.textPrimary, flex: 1 },
  dropdownArrow: { fontSize: 12, color: C.textMuted, marginLeft: 8 },
  // Picker modal
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', padding: 24,
  },
  pickerContent: {
    backgroundColor: C.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 12 },
  pickerItem: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerItemActive: { backgroundColor: C.blue + '22' },
  pickerItemText: { fontSize: 14, color: C.textPrimary },
  pickerItemTextActive: { color: C.blue, fontWeight: '600' },
  pickerCancel: {
    marginTop: 12, paddingVertical: 12, alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 8,
  },
  pickerCancelText: { fontSize: 14, color: C.textMuted, fontWeight: '600' },
  dateColLabel: { fontSize: 12, color: C.textMuted, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
});
