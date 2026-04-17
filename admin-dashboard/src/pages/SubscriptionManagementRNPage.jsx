/**
 * SubscriptionManagementRNPage — SINGLE SOURCE OF TRUTH for both web and mobile.
 * Includes: Subscription list, Edit/Create, User Roles per subscription, Invite User.
 * Same dark theme, same API calls — no duplicate logic in RN screens.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';

const C = {
  bg: '#0d1117', card: '#161b22', border: '#30363d',
  textPrimary: '#e6edf3', textMuted: '#8b949e',
  blue: '#388bfd', green: '#3fb950', red: '#da3633', orange: '#d29922',
};

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const ROLES = ['viewer', 'admin', 'owner'];
function roleColor(r) { return r === 'owner' ? C.orange : r === 'admin' ? C.blue : C.green; }

function toLocalDateStr(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ─── User Roles sub-page ────────────────────────────────────────────── */
function UserRolesView({ subId, subLabel, onBack }) {
  const [auths, setAuths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);

  const fetchAuths = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/customersubscriptions/${subId}/authorizations`);
      if (res.ok) setAuths(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [subId]);

  useEffect(() => { fetchAuths(); }, [fetchAuths]);

  const toggleActive = async (auth) => {
    const newActive = auth.active === 'Y' ? 'N' : 'Y';
    try {
      const res = await fetch(`${BASE}/authorizations/${auth.userAuthorizationId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (res.ok) setAuths(prev => prev.map(a => a.userAuthorizationId === auth.userAuthorizationId ? { ...a, active: newActive } : a));
    } catch (e) { alert(e.message); }
  };

  const updateRole = async (auth, newRole) => {
    try {
      const res = await fetch(`${BASE}/authorizations/${auth.userAuthorizationId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) setAuths(prev => prev.map(a => a.userAuthorizationId === auth.userAuthorizationId ? { ...a, role: newRole } : a));
    } catch (e) { alert(e.message); }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) { alert('Please enter an email address'); return; }
    setInviting(true);
    try {
      const res = await fetch(`${BASE}/customersubscriptions/${subId}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `HTTP ${res.status}`); }
      const result = await res.json();
      const emailNote = result.inviteSent
        ? `\n\nAn invitation email has been sent to ${inviteEmail.trim().toLowerCase()}.`
        : `\n\n⚠️ Invitation email could not be sent (GMAIL not configured).\nPlease notify them manually to download the VXT app and sign in with ${inviteEmail.trim().toLowerCase()}.`;
      alert(`✅ ${result.message}${emailNote}`);
      setInviteOpen(false); setInviteEmail(''); setInviteRole('viewer');
      fetchAuths();
    } catch (e) { alert(e.message); }
    finally { setInviting(false); }
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <div style={S.title}>👥 User Roles</div>
          <div style={S.subtitle}>{subLabel}</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <button style={{ ...S.addBtn, background: C.green }} onClick={() => setInviteOpen(true)}>➕ Invite New User</button>
        <span style={{ fontSize: 13, color: C.textMuted }}>{auths.filter(a => a.active === 'Y').length} active user(s)</span>
      </div>

      {loading ? <div style={S.loader}>Loading...</div> : (
        <div style={S.list}>
          {auths.map(auth => (
            <div key={auth.userAuthorizationId} style={{ ...S.card, ...(auth.active === 'N' ? { opacity: 0.55 } : {}) }}>
              <div style={S.cardTop}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{auth.displayName || auth.email}</div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{auth.email}</div>
                  {auth.createDate && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Added {new Date(auth.createDate).toLocaleDateString()}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={auth.active === 'Y'} onChange={() => toggleActive(auth)} />
                    <span style={{ color: auth.active === 'Y' ? C.green : C.red, marginLeft: 6, fontSize: 11 }}>
                      {auth.active === 'Y' ? 'Active' : 'Revoked'}
                    </span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
                <span style={{ color: C.textMuted, fontSize: 13, marginRight: 8 }}>Role:</span>
                {ROLES.map(r => (
                  <button key={r} style={{
                    padding: '5px 12px', borderRadius: 14, border: `1px solid ${C.border}`, background: 'none',
                    color: C.textMuted, fontSize: 12, marginRight: 6, cursor: 'pointer',
                    ...(auth.role === r ? { background: roleColor(r), borderColor: roleColor(r), color: '#fff', fontWeight: 600 } : {}),
                  }} onClick={() => updateRole(auth, r)}>{r}</button>
                ))}
              </div>
            </div>
          ))}
          {auths.length === 0 && (
            <div style={{ color: C.textMuted, textAlign: 'center', padding: 40 }}>
              No users assigned yet
              <div><button style={{ ...S.addBtn, background: C.green, marginTop: 12 }} onClick={() => setInviteOpen(true)}>➕ Invite First User</button></div>
            </div>
          )}
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div style={S.overlay} onClick={() => setInviteOpen(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Invite New User</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>{subLabel}</div>

            <label style={S.fieldLabel}>Email Address</label>
            <input style={S.input} placeholder="user@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />

            <label style={S.fieldLabel}>Role</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ROLES.map(r => (
                <button key={r} style={{
                  padding: '8px 14px', borderRadius: 16, border: `1px solid ${C.border}`, background: C.bg,
                  color: C.textMuted, fontSize: 13, cursor: 'pointer',
                  ...(inviteRole === r ? { background: C.blue, borderColor: C.blue, color: '#fff', fontWeight: 600 } : {}),
                }} onClick={() => setInviteRole(r)}>{r === 'viewer' ? '👁️ Viewer' : r === 'admin' ? '🔧 Admin' : '👑 Owner'}</button>
              ))}
            </div>

            <div style={S.modalActions}>
              <button style={S.cancelBtn} onClick={() => { setInviteOpen(false); setInviteEmail(''); }}>Cancel</button>
              <button style={S.saveBtn} onClick={sendInvite} disabled={inviting}>{inviting ? 'Sending...' : 'Send Invitation'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Subscription Management Page ───────────────────────────────── */
export default function SubscriptionManagementRNPage() {
  const [subPage, setSubPage] = useState('list'); // 'list' | 'userRoles'
  const [selectedSubId, setSelectedSubId] = useState(null);
  const [selectedSubLabel, setSelectedSubLabel] = useState('');

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formEntityId, setFormEntityId] = useState('');
  const [formEventId, setFormEventId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formActive, setFormActive] = useState('Y');
  const [saving, setSaving] = useState(false);

  // Dropdown data
  const [customers, setCustomers] = useState([]);
  const [entities, setEntities] = useState([]);
  const [events, setEvents] = useState([]);
  const [entitySearch, setEntitySearch] = useState('');

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/customersubscriptions`);
      if (res.ok) setSubscriptions(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

  const fetchFormData = async () => {
    try {
      const [cRes, eRes, evRes] = await Promise.all([
        fetch(`${BASE}/customers`), fetch(`${BASE}/entities`), fetch(`${BASE}/events`),
      ]);
      if (cRes.ok) { const d = await cRes.json(); setCustomers(d.map(c => ({ id: c.customerId, label: c.customerName }))); }
      if (eRes.ok) { const d = await eRes.json(); setEntities(d.map(e => ({ id: e.entityId, label: `${e.entityFirstName || ''} ${e.entityLastName || ''}`.trim() || String(e.entityId) }))); }
      if (evRes.ok) { const d = await evRes.json(); setEvents(d.map(ev => ({ id: ev.eventId, label: ev.eventCode }))); }
    } catch (e) { console.error(e); }
  };

  const filtered = useMemo(() => subscriptions.filter(s => {
    if (statusFilter !== 'all' && s.active !== statusFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (s.customerName||'').toLowerCase().includes(q)
        || (s.entityName||'').toLowerCase().includes(q)
        || String(s.entityId).includes(q)
        || (s.eventCode||'').toLowerCase().includes(q);
    }
    return true;
  }), [subscriptions, filter, statusFilter]);

  const openEdit = (sub) => {
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
      setFormCustomerId(''); setFormEntityId(''); setFormEventId('');
      setFormStartDate(''); setFormEndDate(''); setFormActive('Y');
    }
    setEditModalOpen(true);
  };

  const save = async () => {
    if (!formCustomerId || !formEntityId) { alert('Customer and Entity are required'); return; }
    setSaving(true);
    try {
      const body = {
        customerId: formCustomerId, entityId: formEntityId,
        eventId: formEventId || null,
        subscriptionStartDate: formStartDate || null,
        subscriptionEndDate: formEndDate || null, active: formActive,
      };
      const url = editingSub ? `${BASE}/customersubscriptions/${editingSub.customerSubscriptionId}` : `${BASE}/customersubscriptions`;
      const res = await fetch(url, { method: editingSub ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
      setEditModalOpen(false);
      fetchSubscriptions();
    } catch (e) { alert(`Error: ${e.message}`); }
    finally { setSaving(false); }
  };

  const toggleActive = async (sub) => {
    const newActive = sub.active === 'Y' ? 'N' : 'Y';
    try {
      const res = await fetch(`${BASE}/customersubscriptions/${sub.customerSubscriptionId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (res.ok) setSubscriptions(prev => prev.map(s => s.customerSubscriptionId === sub.customerSubscriptionId ? { ...s, active: newActive } : s));
    } catch (e) { alert(e.message); }
  };

  const deleteSub = async (sub) => {
    if (!confirm(`Delete subscription for ${sub.customerName} / ${sub.entityName}?`)) return;
    try {
      await fetch(`${BASE}/customersubscriptions/${sub.customerSubscriptionId}`, { method: 'DELETE' });
      fetchSubscriptions();
    } catch (e) { alert(e.message); }
  };

  const openUserRoles = (sub) => {
    setSelectedSubId(sub.customerSubscriptionId);
    setSelectedSubLabel(`${sub.customerName} / ${sub.entityName || sub.entityId}`);
    setSubPage('userRoles');
  };

  // ─── Sub-page routing ───
  if (subPage === 'userRoles' && selectedSubId != null) {
    return <UserRolesView subId={selectedSubId} subLabel={selectedSubLabel} onBack={() => { setSubPage('list'); fetchSubscriptions(); }} />;
  }


  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={S.title}>📋 Customer Subscriptions</div>
          <div style={S.subtitle}>
            {filtered.length} shown • {subscriptions.filter(s => s.active === 'Y').length} active / {subscriptions.length} total
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.addBtn} onClick={() => openEdit(null)}>+ New</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={S.filterBar}>
        <input style={S.searchInput} placeholder="Search customer, entity, event..." value={filter} onChange={e => setFilter(e.target.value)} />
      </div>
      <div style={S.chipRow}>
        {[{ label: 'All', v: 'all' }, { label: 'Active', v: 'Y' }, { label: 'Inactive', v: 'N' }].map(f => (
          <button key={f.v} style={{ ...S.chip, ...(statusFilter === f.v ? S.chipActive : {}) }}
            onClick={() => setStatusFilter(f.v)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? <div style={S.loader}>Loading...</div> : (
        <div style={S.list}>
          {filtered.map(sub => (
            <div key={sub.customerSubscriptionId} style={{ ...S.card, ...(sub.active === 'N' ? { opacity: 0.55 } : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px' }}>
                <span style={S.cardTitle}>{sub.customerName}</span>
                <span style={S.cardEntity}>{sub.entityName} ({sub.entityId})</span>
                {sub.eventCode && <span style={S.cardEvent}>• {sub.eventCode}</span>}
                <span style={S.cardDate}>
                  {sub.subscriptionStartDate ? new Date(sub.subscriptionStartDate).toLocaleDateString() : '—'}
                  {sub.subscriptionEndDate ? ` → ${new Date(sub.subscriptionEndDate).toLocaleDateString()}` : ''}
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <label style={{ ...S.toggleLabel, margin: 0 }}>
                    <input type="checkbox" checked={sub.active === 'Y'} onChange={() => toggleActive(sub)} />
                    <span style={{ color: sub.active === 'Y' ? C.green : C.red, marginLeft: 6, fontSize: 12 }}>
                      {sub.active === 'Y' ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                  <button style={{ ...S.cardBtn, color: C.blue }} onClick={() => openUserRoles(sub)}>👥 Users</button>
                  <button style={S.cardBtn} onClick={() => openEdit(sub)}>✏️ Edit</button>
                  <button style={{ ...S.cardBtn, color: C.red }} onClick={() => deleteSub(sub)}>🗑️</button>
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ color: C.textMuted, textAlign: 'center', padding: 40 }}>No subscriptions found</div>}
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div style={S.overlay} onClick={() => setEditModalOpen(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>{editingSub ? 'Edit Subscription' : 'New Subscription'}</div>

            <label style={S.fieldLabel}>Customer</label>
            <select style={S.select} value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)}>
              <option value="">Select Customer...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>

            <label style={S.fieldLabel}>Entity</label>
            <input style={S.input} placeholder="Search entities..." value={entitySearch} onChange={e => setEntitySearch(e.target.value)} />
            <select style={S.select} value={formEntityId} onChange={e => setFormEntityId(e.target.value)}>
              <option value="">Select Entity...</option>
              {entities.filter(en => !entitySearch || en.label.toLowerCase().includes(entitySearch.toLowerCase()) || String(en.id).includes(entitySearch))
                .map(en => <option key={en.id} value={en.id}>{en.label} ({en.id})</option>)}
            </select>

            <label style={S.fieldLabel}>Event (optional)</label>
            <select style={S.select} value={formEventId} onChange={e => setFormEventId(e.target.value)}>
              <option value="">No event filter</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
            </select>

            <label style={S.fieldLabel}>Start Date</label>
            <input type="date" style={S.input} value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />

            <label style={S.fieldLabel}>End Date (optional)</label>
            <input type="date" style={S.input} value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />

            <label style={S.fieldLabel}>
              <input type="checkbox" checked={formActive === 'Y'} onChange={e => setFormActive(e.target.checked ? 'Y' : 'N')} />
              <span style={{ marginLeft: 8 }}>Active</span>
            </label>

            <div style={S.modalActions}>
              <button style={S.cancelBtn} onClick={() => setEditModalOpen(false)}>Cancel</button>
              <button style={S.saveBtn} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  root: { background: C.bg, minHeight: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: C.textPrimary },
  header: { display: 'flex', alignItems: 'center', padding: '14px 16px', background: C.card, borderBottom: `1px solid ${C.border}` },
  title: { fontSize: 20, fontWeight: 700, color: C.textPrimary },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  addBtn: { background: C.green, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  backBtn: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.textPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  filterBar: { padding: '10px 16px 4px' },
  searchInput: { width: '100%', boxSizing: 'border-box', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.textPrimary, fontSize: 14, outline: 'none' },
  chipRow: { display: 'flex', gap: 6, padding: '0 16px 8px', flexWrap: 'wrap' },
  chip: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '6px 12px', color: C.textMuted, fontSize: 12, cursor: 'pointer' },
  chipActive: { borderColor: C.blue, background: C.blue + '22', color: C.blue, fontWeight: 600 },
  loader: { color: C.blue, textAlign: 'center', padding: 40 },
  list: { padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  card: { background: C.card, borderRadius: 10, padding: '10px 14px', border: `1px solid ${C.border}` },
  cardTop: { display: 'flex', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: 600, color: C.textPrimary },
  cardEntity: { fontSize: 13, color: C.green },
  cardEvent: { fontSize: 12, color: C.blue },
  cardDate: { fontSize: 12, color: C.textMuted },
  toggleLabel: { display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13 },
  cardFooter: { display: 'flex', gap: 8, marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 },
  cardBtn: { background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 13, padding: '4px 8px' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 60, zIndex: 1000 },
  modal: { background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 12 },
  fieldLabel: { display: 'block', fontSize: 13, color: C.textMuted, marginTop: 14, marginBottom: 6, fontWeight: 600 },
  input: { width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.textPrimary, fontSize: 14, outline: 'none' },
  select: { width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.textPrimary, fontSize: 14, outline: 'none', marginTop: 4 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { background: C.border, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
  saveBtn: { background: C.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
};
