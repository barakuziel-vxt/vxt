/**
 * PushNotificationRNPage — web version matching RN NotificationSettingsScreen
 * Same dark theme, same API calls, same layout.
 */
import React, { useState, useEffect, useCallback } from 'react';

const C = {
  bg: '#0d1117', card: '#161b22', border: '#30363d',
  textPrimary: '#e6edf3', textMuted: '#8b949e',
  blue: '#388bfd', green: '#3fb950', red: '#da3633', orange: '#d29922',
};

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function sevColor(s) {
  return s === 'LOW' ? C.green : s === 'MEDIUM' ? C.orange : s === 'HIGH' ? C.red : s === 'CRITICAL' ? '#f85149' : C.textMuted;
}

export default function PushNotificationRNPage() {
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [pushSettings, setPushSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSub, setModalSub] = useState(null);
  const [selectedSetting, setSelectedSetting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mEnabled, setMEnabled] = useState(true);
  const [mSeverity, setMSeverity] = useState('MEDIUM');
  const [mQStart, setMQStart] = useState('');
  const [mQEnd, setMQEnd] = useState('');
  const [mSound, setMSound] = useState(true);
  const [mVibration, setMVibration] = useState(true);
  const [mLed, setMLed] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/appusers`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [subsRes, pushRes] = await Promise.all([
        fetch(`${BASE}/users/${userId}/subscriptions`),
        fetch(`${BASE}/users/${userId}/push-settings`),
      ]);
      if (subsRes.ok) setSubscriptions(await subsRes.json());
      if (pushRes.ok) setPushSettings(await pushRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getPushStatus = (subId) => {
    const s = pushSettings.find(p => p.customerSubscriptionId === subId);
    if (!s) return { configured: false, enabled: false, severity: 'MEDIUM' };
    return { configured: true, enabled: s.enabled === 'Y', severity: s.minSeverity };
  };

  const openSettings = (sub) => {
    const existing = pushSettings.find(p => p.customerSubscriptionId === sub.customerSubscriptionId);
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
      setMEnabled(true); setMSeverity('MEDIUM');
      setMQStart(''); setMQEnd('');
      setMSound(true); setMVibration(true); setMLed(true);
    }
    setModalSub(sub);
    setModalOpen(true);
  };

  const saveSettings = async () => {
    if (!modalSub) return;
    setSaving(true);
    try {
      if (selectedSetting) {
        const res = await fetch(`${BASE}/push-settings/${selectedSetting.userAppPushNotificationId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: mEnabled ? 'Y' : 'N', minSeverity: mSeverity,
            quietHoursStart: mQStart || null, quietHoursEnd: mQEnd || null,
            soundEnabled: mSound ? 'Y' : 'N', vibrationEnabled: mVibration ? 'Y' : 'N', ledEnabled: mLed ? 'Y' : 'N',
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        const res = await fetch(`${BASE}/users/${userId}/push-settings`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerSubscriptionId: modalSub.customerSubscriptionId, minSeverity: mSeverity }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }
      }
      setModalOpen(false);
      fetchData();
    } catch (e) { alert(`Failed to save: ${e.message}`); }
    finally { setSaving(false); }
  };

  const filtered = subscriptions.filter(sub => {
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!(sub.customerName || '').toLowerCase().includes(q)
        && !String(sub.entityId).toLowerCase().includes(q)
        && !(sub.eventCode || '').toLowerCase().includes(q)) return false;
    }
    if (filterStatus !== 'all') {
      const ps = getPushStatus(sub.customerSubscriptionId);
      if (filterStatus === 'configured' && !ps.configured) return false;
      if (filterStatus === 'unconfigured' && ps.configured) return false;
      if (filterStatus === 'enabled' && !(ps.configured && ps.enabled)) return false;
      if (filterStatus === 'disabled' && !(ps.configured && !ps.enabled)) return false;
    }
    return true;
  });

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <div style={S.title}>🔔 Notification Settings</div>
          <div style={S.subtitle}>Configure alerts per subscription</div>
        </div>
      </div>

      {/* User selector */}
      <div style={{ padding: '10px 16px 4px' }}>
        <select
          style={{ ...S.searchInput, cursor: 'pointer' }}
          value={userId}
          onChange={e => setUserId(e.target.value)}
        >
          <option value="">Select a user...</option>
          {users.filter(u => u.active === 'Y').map(u => (
            <option key={u.userId} value={u.userId}>
              {u.displayName || u.email} ({u.email})
            </option>
          ))}
        </select>
      </div>

      {userId && (
        <>
          <div style={S.filterBar}>
            <input style={S.searchInput} placeholder="Search customer, entity, event..." value={searchText} onChange={e => setSearchText(e.target.value)} />
          </div>

          <div style={S.chipRow}>
            {['all', 'configured', 'unconfigured', 'enabled', 'disabled'].map(v => (
              <button key={v} style={{ ...S.chip, ...(filterStatus === v ? S.chipActive : {}) }}
                onClick={() => setFilterStatus(v)}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
            ))}
          </div>
        </>
      )}

      {loading ? <div style={S.loader}>Loading...</div> : (
        <div style={S.list}>
          {filtered.map(sub => {
            const status = getPushStatus(sub.customerSubscriptionId);
            return (
              <div key={sub.customerSubscriptionId} style={S.card} onClick={() => openSettings(sub)}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{sub.customerName}</span>
                  <span style={{ fontSize: 13, color: C.textMuted }}>{sub.entityName || sub.entityId}</span>
                  {sub.eventCode && <span style={{ fontSize: 12, color: C.textMuted }}>\u2022 {sub.eventCode}</span>}
                  <span style={{ fontSize: 12, color: C.blue, fontWeight: 600 }}>\u2022 {sub.role}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {status.configured ? (
                      <>
                        <span style={{ width: 10, height: 10, borderRadius: 5, background: status.enabled ? C.green : C.red, display: 'inline-block' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: sevColor(status.severity) }}>{status.severity}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>Tap to configure</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
          {!userId && <div style={{ color: C.textMuted, textAlign: 'center', padding: 40 }}>Select a user to view notification settings</div>}
          {userId && filtered.length === 0 && !loading && <div style={{ color: C.textMuted, textAlign: 'center', padding: 40 }}>No subscriptions found</div>}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={S.overlay} onClick={() => setModalOpen(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Push Notification Settings</div>
            {modalSub && (
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
                {modalSub.customerName} / {modalSub.entityId}{modalSub.eventCode ? ` / ${modalSub.eventCode}` : ''}
              </div>
            )}

            {/* Enable */}
            <div style={S.settingRow}>
              <span style={S.settingLabel}>Enable Push Notifications</span>
              <label style={S.toggleLabel}>
                <input type="checkbox" checked={mEnabled} onChange={e => setMEnabled(e.target.checked)} />
                <span style={{ color: mEnabled ? C.green : C.red, marginLeft: 6, fontSize: 12 }}>{mEnabled ? 'ON' : 'OFF'}</span>
              </label>
            </div>

            {/* Severity */}
            <div style={S.sectionLabel}>Minimum Severity</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              {SEVERITIES.map(s => (
                <button key={s} style={{
                  ...S.sevChip,
                  ...(mSeverity === s ? { background: sevColor(s), borderColor: sevColor(s), color: '#fff', fontWeight: 700 } : {}),
                }} onClick={() => setMSeverity(s)}>{s}</button>
              ))}
            </div>
            <div style={S.helperTxt}>Only notifications at or above this severity will be delivered.</div>

            {/* Quiet Hours */}
            <div style={S.sectionLabel}>Quiet Hours</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Start</div>
                <input type="time" style={S.timeInput} value={mQStart} onChange={e => setMQStart(e.target.value)} />
              </div>
              <span style={{ color: C.textMuted, marginTop: 14 }}>→</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>End</div>
                <input type="time" style={S.timeInput} value={mQEnd} onChange={e => setMQEnd(e.target.value)} />
              </div>
            </div>
            <div style={S.helperTxt}>No notifications during quiet hours.</div>

            {/* Alert options */}
            <div style={S.sectionLabel}>Alert Options</div>
            {[
              { label: '🔊 Sound', val: mSound, set: setMSound },
              { label: '📳 Vibration', val: mVibration, set: setMVibration },
              { label: '💡 LED', val: mLed, set: setMLed },
            ].map(o => (
              <div key={o.label} style={S.settingRow}>
                <span style={S.settingLabel}>{o.label}</span>
                <input type="checkbox" checked={o.val} onChange={e => o.set(e.target.checked)} />
              </div>
            ))}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={{ ...S.btn, flex: 1, background: C.border }} onClick={() => setModalOpen(false)}>Cancel</button>
              <button style={{ ...S.btn, flex: 1, background: C.blue }} onClick={saveSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  root: { background: C.bg, minHeight: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: C.textPrimary },
  header: { padding: '14px 16px', background: C.card, borderBottom: `1px solid ${C.border}` },
  title: { fontSize: 20, fontWeight: 700, color: C.textPrimary },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  filterBar: { padding: '10px 16px 4px' },
  searchInput: { width: '100%', boxSizing: 'border-box', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.textPrimary, fontSize: 14, outline: 'none' },
  chipRow: { display: 'flex', gap: 6, padding: '0 16px 8px', flexWrap: 'wrap' },
  chip: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '6px 12px', color: C.textMuted, fontSize: 12, cursor: 'pointer' },
  chipActive: { borderColor: C.blue, background: C.blue + '22', color: C.blue, fontWeight: 600 },
  loader: { color: C.blue, textAlign: 'center', padding: 40 },
  list: { padding: '0 12px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  card: { background: C.card, borderRadius: 10, padding: 14, border: `1px solid ${C.border}`, cursor: 'pointer' },
  cardTop: { display: 'flex', justifyContent: 'space-between' },
  btn: { padding: '10px 16px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: C.card, borderRadius: 14, padding: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  settingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` },
  settingLabel: { color: C.textPrimary, fontSize: 14 },
  toggleLabel: { cursor: 'pointer', display: 'flex', alignItems: 'center' },
  sectionLabel: { color: C.textPrimary, fontSize: 14, fontWeight: 600, marginTop: 14, marginBottom: 6 },
  sevChip: { padding: '6px 10px', borderRadius: 14, border: `1px solid ${C.border}`, background: 'none', color: C.textMuted, fontSize: 11, cursor: 'pointer' },
  helperTxt: { fontSize: 11, color: C.textMuted, marginBottom: 6 },
  timeInput: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', color: C.textPrimary, fontSize: 13, width: '100%', boxSizing: 'border-box' },
};
