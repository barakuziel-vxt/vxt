import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch,
  Alert, ActivityIndicator, TextInput, ScrollView,
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

interface Subscription {
  customerSubscriptionId: number;
  customerId: number;
  customerName: string;
  entityId: string;
  entityName: string;
  eventId: number | null;
  eventCode: string | null;
  active: string;
}

interface Props {
  baseUrl: string;
  onBack: () => void;
}

type Role = 'viewer' | 'admin' | 'owner';

export default function InviteUserScreen({ baseUrl, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/customersubscriptions?status=Y`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSubscriptions(data);
      } catch (e: any) {
        Alert.alert('Error', `Failed to load subscriptions: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [baseUrl]);

  const toggleSubscription = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(s => s.customerSubscriptionId)));
    }
  };

  const sendInvite = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('Validation', 'Please enter an email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Validation', 'Please enter a valid email address');
      return;
    }
    if (selected.size === 0) {
      Alert.alert('Validation', 'Please select at least one subscription');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${baseUrl}/invite-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          role,
          subscriptionIds: Array.from(selected),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const result = await res.json();
      Alert.alert(
        'Invitation Sent',
        `${result.message}\n${result.inviteSent ? '📧 Email invitation sent' : '⚠️ Email not sent (Firebase link auth may need to be enabled)'}`,
        [{ text: 'OK', onPress: onBack }],
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSending(false);
    }
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

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📨 Invite User</Text>
      </View>

      {/* Email input */}
      <View style={styles.section}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="user@example.com"
          placeholderTextColor={C.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Role selector */}
      <View style={styles.section}>
        <Text style={styles.label}>Role</Text>
        <View style={styles.chipRow}>
          {(['viewer', 'admin', 'owner'] as Role[]).map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, role === r && styles.chipActive]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.chipText, role === r && styles.chipTextActive]}>
                {r === 'viewer' ? '👁️ Viewer' : r === 'admin' ? '🔧 Admin' : '👑 Owner'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Subscription selection */}
      <View style={[styles.section, { flex: 1 }]}>
        <View style={styles.subHeader}>
          <Text style={styles.label}>
            Select Subscriptions ({selected.size}/{filtered.length})
          </Text>
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.selectAllText}>
              {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.input, { marginBottom: 8 }]}
          placeholder="Filter subscriptions..."
          placeholderTextColor={C.textMuted}
          value={filter}
          onChangeText={setFilter}
        />

        {loading ? (
          <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => String(item.customerSubscriptionId)}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => {
              const isSelected = selected.has(item.customerSubscriptionId);
              return (
                <TouchableOpacity
                  style={[styles.subCard, isSelected && styles.subCardSelected]}
                  onPress={() => toggleSubscription(item.customerSubscriptionId)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subCustomer}>{item.customerName}</Text>
                    <Text style={styles.subEntity}>{item.entityName}</Text>
                    {item.eventCode && (
                      <Text style={styles.subEvent}>Event: {item.eventCode}</Text>
                    )}
                  </View>
                  <Switch
                    value={isSelected}
                    onValueChange={() => toggleSubscription(item.customerSubscriptionId)}
                    trackColor={{ false: C.border, true: C.green }}
                    thumbColor={isSelected ? '#fff' : C.textMuted}
                  />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No active subscriptions found</Text>
            }
          />
        )}
      </View>

      {/* Invite button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.inviteBtn,
            (!email.trim() || selected.size === 0) && styles.inviteBtnDisabled,
          ]}
          onPress={sendInvite}
          disabled={sending || !email.trim() || selected.size === 0}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.inviteBtnText}>
              📨 Invite {email.trim() ? email.trim().split('@')[0] : 'User'} to {selected.size} subscription{selected.size !== 1 ? 's' : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
  },
  backBtnText: { fontSize: 14, color: C.textPrimary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: C.textPrimary, marginLeft: 12 },
  section: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  label: { fontSize: 14, color: C.textPrimary, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, color: C.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: C.border,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.blue, borderColor: C.blue },
  chipText: { fontSize: 13, color: C.textMuted },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  selectAllText: { fontSize: 13, color: C.blue, fontWeight: '600' },
  subCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, marginBottom: 6, borderRadius: 8,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
  },
  subCardSelected: { borderColor: C.green, backgroundColor: '#0d2818' },
  subCustomer: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  subEntity: { fontSize: 13, color: C.green, marginTop: 2 },
  subEvent: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 30 },
  footer: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
  },
  inviteBtn: {
    backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center',
  },
  inviteBtnDisabled: { backgroundColor: C.border, opacity: 0.6 },
  inviteBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
