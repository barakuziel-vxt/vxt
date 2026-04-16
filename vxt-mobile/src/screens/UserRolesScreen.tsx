import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch,
  Alert, ActivityIndicator, TextInput, Modal, ScrollView,
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

const ROLES = ['viewer', 'admin', 'owner'] as const;

interface Authorization {
  userAuthorizationId: number;
  userId: number;
  email: string;
  displayName: string;
  firebaseUid: string;
  role: string;
  active: string;
  createDate: string | null;
}

interface Props {
  baseUrl: string;
  customerId: number;
  customerLabel: string;
  onBack: () => void;
}

export default function UserRolesScreen({ baseUrl, customerId, customerLabel, onBack }: Props) {
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('viewer');
  const [inviting, setInviting] = useState(false);

  const fetchAuthorizations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/customers/${customerId}/authorizations`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAuthorizations(await res.json());
    } catch (e: any) {
      Alert.alert('Error', `Failed to load users: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, customerId]);

  useEffect(() => { fetchAuthorizations(); }, [fetchAuthorizations]);

  const toggleUserActive = async (auth: Authorization) => {
    const newActive = auth.active === 'Y' ? 'N' : 'Y';
    const action = newActive === 'N' ? 'revoke' : 'restore';
    try {
      const res = await fetch(`${baseUrl}/authorizations/${auth.userAuthorizationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAuthorizations(prev =>
        prev.map(a =>
          a.userAuthorizationId === auth.userAuthorizationId
            ? { ...a, active: newActive }
            : a,
        ),
      );
    } catch (e: any) {
      Alert.alert('Error', `Failed to ${action} access: ${e.message}`);
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
          a.userAuthorizationId === auth.userAuthorizationId
            ? { ...a, role: newRole }
            : a,
        ),
      );
    } catch (e: any) {
      Alert.alert('Error', `Failed to update role: ${e.message}`);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Validation', 'Please enter an email address');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch(`${baseUrl}/customers/${customerId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const result = await res.json();
      Alert.alert('Success', result.message);
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
      fetchAuthorizations();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setInviting(false);
    }
  };

  const roleColor = (role: string) =>
    role === 'owner' ? C.orange : role === 'admin' ? C.blue : C.green;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>👥 User Roles</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{customerLabel}</Text>
        </View>
      </View>

      {/* Actions bar */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => setInviteModalOpen(true)}
        >
          <Text style={styles.inviteBtnText}>➕ Invite New User</Text>
        </TouchableOpacity>
        <Text style={styles.countTxt}>
          {authorizations.filter(a => a.active === 'Y').length} active user(s)
        </Text>
      </View>

      {/* User list */}
      {loading ? (
        <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={authorizations}
          keyExtractor={item => String(item.userAuthorizationId)}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={[styles.card, item.active === 'N' && styles.cardRevoked]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{item.displayName || item.email}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  {item.createDate && (
                    <Text style={styles.dateTxt}>
                      Added {new Date(item.createDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Switch
                    value={item.active === 'Y'}
                    onValueChange={() => toggleUserActive(item)}
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
                    style={[
                      styles.roleChip,
                      item.role === r && { backgroundColor: roleColor(r), borderColor: roleColor(r) },
                    ]}
                    onPress={() => updateRole(item, r)}
                  >
                    <Text style={[
                      styles.roleChipText,
                      item.role === r && { color: '#fff', fontWeight: '600' },
                    ]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={styles.subtitle}>No users assigned yet</Text>
              <TouchableOpacity
                style={[styles.inviteBtn, { marginTop: 16 }]}
                onPress={() => setInviteModalOpen(true)}
              >
                <Text style={styles.inviteBtnText}>➕ Invite First User</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Invite Modal */}
      <Modal visible={inviteModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite New User</Text>
            <Text style={styles.modalSubtitle}>{customerLabel}</Text>

            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="user@example.com"
              placeholderTextColor={C.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleChip,
                    inviteRole === r && { backgroundColor: roleColor(r), borderColor: roleColor(r) },
                  ]}
                  onPress={() => setInviteRole(r)}
                >
                  <Text style={[
                    styles.roleChipText,
                    inviteRole === r && { color: '#fff', fontWeight: '600' },
                  ]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.border }]}
                onPress={() => { setInviteModalOpen(false); setInviteEmail(''); }}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.blue }]}
                onPress={sendInvite}
                disabled={inviting}
              >
                {inviting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnText}>Send Invitation</Text>
                )}
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
  backBtn: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center',
  },
  backBtnText: { fontSize: 24, color: C.textPrimary },
  title: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  actionsBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  inviteBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: C.green,
  },
  inviteBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  countTxt: { fontSize: 13, color: C.textMuted },
  card: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  cardRevoked: { opacity: 0.55 },
  cardTop: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
  },
  userName: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
  userEmail: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  dateTxt: { fontSize: 11, color: C.textMuted, marginTop: 4 },
  statusTxt: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  roleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 12, gap: 8,
  },
  roleLabel: { fontSize: 13, color: C.textMuted, marginRight: 4 },
  roleChip: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
  },
  roleChipText: { fontSize: 13, color: C.textMuted },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: C.card, borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: C.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary },
  modalSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 4, marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: C.textMuted, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, color: C.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: C.border,
  },
  modalActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20,
  },
  modalBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, minWidth: 90,
    alignItems: 'center',
  },
  modalBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
