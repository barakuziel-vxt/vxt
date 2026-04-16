import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch,
  Alert, ActivityIndicator, Modal, ScrollView, TextInput,
} from 'react-native';

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

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

interface PushSetting {
  userAppPushNotificationId: number;
  userApplicationId: number;
  customerId: number;
  entityId: string | null;
  enabled: string;
  minSeverity: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  soundEnabled: string;
  vibrationEnabled: string;
  ledEnabled: string;
  deliveryChannel: string;
  customerName: string;
  entityName: string | null;
}

interface UserSubscription {
  userAuthorizationId: number;
  customerId: number;
  entityId: string | null;
  role: string;
  customerName: string;
  entityName: string | null;
  effectiveDate: string;
  expiryDate: string | null;
}

interface Props {
  baseUrl: string;
  userId: string;
  onBack: () => void;
}

export default function NotificationSettingsScreen({ baseUrl, userId, onBack }: Props) {
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [pushSettings, setPushSettings] = useState<PushSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSetting, setSelectedSetting] = useState<PushSetting | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'configured' | 'unconfigured' | 'enabled' | 'disabled'>('all');

  // Local modal state
  const [mEnabled, setMEnabled] = useState(true);
  const [mSeverity, setMSeverity] = useState('MEDIUM');
  const [mQStart, setMQStart] = useState('');
  const [mQEnd, setMQEnd] = useState('');
  const [mSound, setMSound] = useState(true);
  const [mVibration, setMVibration] = useState(true);
  const [mLed, setMLed] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [subsRes, pushRes] = await Promise.all([
        fetch(`${baseUrl}/users/${userId}/subscriptions`),
        fetch(`${baseUrl}/users/${userId}/push-settings`),
      ]);
      if (!subsRes.ok) throw new Error(`Subscriptions: HTTP ${subsRes.status}`);
      const subsData = await subsRes.json();
      setSubscriptions(subsData);

      if (pushRes.ok) {
        setPushSettings(await pushRes.json());
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openSettings = (sub: UserSubscription) => {
    const existing = pushSettings.find(
      p => p.customerId === sub.customerId && p.entityId === sub.entityId,
    );
    if (existing) {
      setSelectedSetting(existing);
      setMEnabled(existing.enabled === 'Y');
      setMSeverity(existing.minSeverity || 'MEDIUM');
      setMQStart(existing.quietHoursStart || '');
      setMQEnd(existing.quietHoursEnd || '');
      setMSound(existing.soundEnabled === 'Y');
      setMVibration(existing.vibrationEnabled === 'Y');
      setMLed(existing.ledEnabled === 'Y');
    } else {
      setSelectedSetting(null);
      setMEnabled(true);
      setMSeverity('MEDIUM');
      setMQStart('');
      setMQEnd('');
      setMSound(true);
      setMVibration(true);
      setMLed(true);
    }
    setModalOpen(true);
  };

  const saveSettings = async (sub: UserSubscription) => {
    setSaving(true);
    try {
      if (selectedSetting) {
        // Update existing
        const res = await fetch(`${baseUrl}/push-settings/${selectedSetting.userAppPushNotificationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: mEnabled ? 'Y' : 'N',
            minSeverity: mSeverity,
            quietHoursStart: mQStart || null,
            quietHoursEnd: mQEnd || null,
            soundEnabled: mSound ? 'Y' : 'N',
            vibrationEnabled: mVibration ? 'Y' : 'N',
            ledEnabled: mLed ? 'Y' : 'N',
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        // Create new
        const res = await fetch(`${baseUrl}/users/${userId}/push-settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: sub.customerId,
            entityId: sub.entityId,
            minSeverity: mSeverity,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      setModalOpen(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', `Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'LOW': return C.green;
      case 'MEDIUM': return C.orange;
      case 'HIGH': return C.red;
      case 'CRITICAL': return '#f85149';
      default: return C.textMuted;
    }
  };

  const getPushStatusForSub = (sub: UserSubscription) => {
    const setting = pushSettings.find(p => p.customerId === sub.customerId && p.entityId === sub.entityId);
    if (!setting) return { configured: false, enabled: false, severity: 'MEDIUM' };
    return { configured: true, enabled: setting.enabled === 'Y', severity: setting.minSeverity };
  };

  // Track which subscription we opened the modal for
  const [modalSubIdx, setModalSubIdx] = useState<number | null>(null);
  const currentSub = modalSubIdx !== null ? subscriptions[modalSubIdx] : null;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>🔔 Notification Settings</Text>
          <Text style={styles.subtitle}>Configure alerts per customer entity</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer, entity..."
          placeholderTextColor={C.textMuted}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Filter chips */}
      <View style={styles.chipRow}>
        {([
          { label: 'All', val: 'all' as const },
          { label: 'Configured', val: 'configured' as const },
          { label: 'Unconfigured', val: 'unconfigured' as const },
          { label: 'Enabled', val: 'enabled' as const },
          { label: 'Disabled', val: 'disabled' as const },
        ]).map(f => (
          <TouchableOpacity
            key={f.val}
            style={[styles.filterChip, filterStatus === f.val && styles.filterChipActive]}
            onPress={() => setFilterStatus(f.val)}
          >
            <Text style={[styles.filterChipText, filterStatus === f.val && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={subscriptions.filter(sub => {
            // Text search
            if (searchText) {
              const q = searchText.toLowerCase();
              const match =
                (sub.customerName || '').toLowerCase().includes(q) ||
                (sub.entityName || sub.entityId || '').toLowerCase().includes(q) ||
                (sub.role || '').toLowerCase().includes(q);
              if (!match) return false;
            }
            // Status filter
            if (filterStatus !== 'all') {
              const ps = getPushStatusForSub(sub);
              if (filterStatus === 'configured' && !ps.configured) return false;
              if (filterStatus === 'unconfigured' && ps.configured) return false;
              if (filterStatus === 'enabled' && !(ps.configured && ps.enabled)) return false;
              if (filterStatus === 'disabled' && !(ps.configured && !ps.enabled)) return false;
            }
            return true;
          })}
          keyExtractor={(item, index) => `${item.customerId}-${item.entityId || 'all'}-${index}`}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item, index }) => {
            const status = getPushStatusForSub(item);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => {
                  setModalSubIdx(index);
                  openSettings(item);
                }}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.customerName}</Text>
                    <Text style={styles.cardSub}>{item.entityName || item.entityId || 'All Entities'}</Text>
                    <Text style={[styles.roleBadge, { color: C.blue }]}>
                      Role: {item.role}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {status.configured ? (
                      <>
                        <View style={[
                          styles.statusDot,
                          { backgroundColor: status.enabled ? C.green : C.red },
                        ]} />
                        <Text style={[styles.severityTxt, { color: getSeverityColor(status.severity) }]}>
                          {status.severity}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.configTxt}>Tap to configure</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 40 }]}>
              No authorizations found. Ask an admin to invite you.
            </Text>
          }
        />
      )}

      {/* Settings Modal */}
      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Push Notification Settings</Text>
              {currentSub && (
                <Text style={styles.modalSubtitle}>
                  {currentSub.customerName} / {currentSub.entityName || currentSub.entityId || 'All Entities'}
                </Text>
              )}

              {/* Enable Toggle */}
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Enable Push Notifications</Text>
                <Switch
                  value={mEnabled}
                  onValueChange={setMEnabled}
                  trackColor={{ false: C.border, true: C.green }}
                  thumbColor={mEnabled ? '#fff' : C.textMuted}
                />
              </View>

              {/* Severity Selector */}
              <Text style={styles.sectionLabel}>Minimum Severity</Text>
              <View style={styles.severityRow}>
                {SEVERITIES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.severityChip,
                      mSeverity === s && {
                        backgroundColor: getSeverityColor(s),
                        borderColor: getSeverityColor(s),
                      },
                    ]}
                    onPress={() => setMSeverity(s)}
                  >
                    <Text style={[
                      styles.severityChipText,
                      mSeverity === s && { color: '#fff', fontWeight: '700' },
                    ]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.helperTxt}>
                Only notifications at or above this severity will be delivered.
              </Text>

              {/* Quiet Hours */}
              <Text style={styles.sectionLabel}>Quiet Hours</Text>
              <View style={styles.quietRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quietLabel}>Start (HH:MM)</Text>
                  <View style={styles.timeInput}>
                    <Text
                      style={styles.timeText}
                      onPress={() => {
                        Alert.prompt
                          ? Alert.prompt('Quiet Hours Start', 'Enter time (HH:MM)', (val) => setMQStart(val), 'plain-text', mQStart || '22:00')
                          : setMQStart(mQStart || '22:00');
                      }}
                    >
                      {mQStart || 'Not set'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.quietDash}>→</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quietLabel}>End (HH:MM)</Text>
                  <View style={styles.timeInput}>
                    <Text
                      style={styles.timeText}
                      onPress={() => {
                        Alert.prompt
                          ? Alert.prompt('Quiet Hours End', 'Enter time (HH:MM)', (val) => setMQEnd(val), 'plain-text', mQEnd || '07:00')
                          : setMQEnd(mQEnd || '07:00');
                      }}
                    >
                      {mQEnd || 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.helperTxt}>
                No notifications during quiet hours (e.g., 22:00 → 07:00).
              </Text>

              {/* Sound / Vibration / LED */}
              <Text style={styles.sectionLabel}>Alert Options</Text>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>🔊 Sound</Text>
                <Switch
                  value={mSound}
                  onValueChange={setMSound}
                  trackColor={{ false: C.border, true: C.green }}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>📳 Vibration</Text>
                <Switch
                  value={mVibration}
                  onValueChange={setMVibration}
                  trackColor={{ false: C.border, true: C.green }}
                />
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>💡 LED</Text>
                <Switch
                  value={mLed}
                  onValueChange={setMLed}
                  trackColor={{ false: C.border, true: C.green }}
                />
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: C.border }]}
                  onPress={() => setModalOpen(false)}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: C.blue }]}
                  onPress={() => currentSub && saveSettings(currentSub)}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  backBtn: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center',
  },
  backBtnText: { fontSize: 24, color: C.textPrimary },
  title: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  filterBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  searchInput: {
    backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, color: C.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: C.border,
  },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, paddingBottom: 8, gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  filterChipActive: { borderColor: C.blue, backgroundColor: C.blue + '22' },
  filterChipText: { fontSize: 11, color: C.textMuted },
  filterChipTextActive: { color: C.blue, fontWeight: '600' },
  card: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  cardSub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  roleBadge: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  statusDot: {
    width: 12, height: 12, borderRadius: 6, marginBottom: 4,
  },
  severityTxt: { fontSize: 12, fontWeight: '600' },
  configTxt: { fontSize: 12, color: C.textMuted, fontStyle: 'italic' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', padding: 16,
  },
  modalContent: {
    backgroundColor: C.card, borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: C.border, marginTop: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary },
  modalSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 4, marginBottom: 8 },
  sectionLabel: {
    fontSize: 14, fontWeight: '600', color: C.textPrimary,
    marginTop: 18, marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  settingLabel: { fontSize: 14, color: C.textPrimary },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityChip: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  severityChipText: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  helperTxt: { fontSize: 11, color: C.textMuted, marginTop: 6 },
  quietRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  quietLabel: { fontSize: 12, color: C.textMuted, marginBottom: 4 },
  quietDash: { fontSize: 16, color: C.textMuted, marginBottom: 8 },
  timeInput: {
    backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, borderWidth: 1, borderColor: C.border,
  },
  timeText: { color: C.textPrimary, fontSize: 14 },
  modalActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 24,
  },
  modalBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, minWidth: 80,
    alignItems: 'center',
  },
  modalBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
