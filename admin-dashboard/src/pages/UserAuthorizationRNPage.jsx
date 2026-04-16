/**
 * UserAuthorizationRNPage — web version matching RN UserAuthorizationScreen
 * Same dark theme, same API calls, same layout.
 */
import React, { useState, useEffect, useCallback } from 'react';

const C = {
  bg: '#0d1117', card: '#161b22', border: '#30363d',
  textPrimary: '#e6edf3', textMuted: '#8b949e',
  blue: '#388bfd', green: '#3fb950', red: '#da3633', orange: '#d29922',
};

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const ROLES = ['viewer', 'admin', 'owner'];

function roleColor(role) {
  return role === 'owner' ? C.orange : role === 'admin' ? C.blue : C.green;
}

export default function UserAuthorizationRNPage() {
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState(null);
  const [filterActive, setFilterActive] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/authorizations`);
      if (res.ok) setAuthorizations(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleActive = async (auth) => {
    const newActive = auth.active === 'Y' ? 'N' : 'Y';
    try {
      const res = await fetch(`${BASE}/authorizations/${auth.userAuthorizationId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (res.ok) setAuthorizations(prev => prev.map(a => a.userAuthorizationId === auth.userAuthorizationId ? { ...a, active: newActive } : a));
    } catch (e) { alert(e.message); }
  };

  const updateRole = async (auth, newRole) => {
    try {
      const res = await fetch(`${BASE}/authorizations/${auth.userAuthorizationId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) setAuthorizations(prev => prev.map(a => a.userAuthorizationId === auth.userAuthorizationId ? { ...a, role: newRole } : a));
    } catch (e) { alert(e.message); }
  };

  const filtered = authorizations.filter(a => {
    if (filterActive && a.active !== filterActive) return false;
    if (filterRole && a.role !== filterRole) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (a.displayName||'').toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.customerName||'').toLowerCase().includes(q) || (a.eventCode||'').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={S.title}>🔑 User Authorizations</div>
          <div style={S.subtitle}>
            {filtered.length} shown • {authorizations.filter(a => a.active === 'Y').length} active / {authorizations.length} total
          </div>
        </div>
      </div>

      <div style={S.filterBar}>
        <input style={S.searchInput} placeholder="Search name, email, customer..." value={searchText} onChange={e => setSearchText(e.target.value)} />
      </div>

      <div style={S.chipRow}>
        {[{ label: 'All', v: null }, { label: 'Active', v: 'Y' }, { label: 'Revoked', v: 'N' }].map(f => (
          <button key={f.label} style={{ ...S.chip, ...(filterActive === f.v ? S.chipActive : {}) }} onClick={() => setFilterActive(f.v)}>{f.label}</button>
        ))}
        <span style={{ width: 1, background: C.border, alignSelf: 'stretch', margin: '0 2px' }} />
        {[{ label: 'All Roles', v: null }, ...ROLES.map(r => ({ label: r.charAt(0).toUpperCase() + r.slice(1), v: r }))].map(f => (
          <button key={f.label} style={{
            ...S.chip,
            ...(filterRole === f.v ? { borderColor: f.v ? roleColor(f.v) : C.blue, background: (f.v ? roleColor(f.v) : C.blue) + '33', color: f.v ? roleColor(f.v) : C.blue, fontWeight: 600 } : {}),
          }} onClick={() => setFilterRole(f.v)}>{f.label}</button>
        ))}
      </div>

      {loading ? <div style={S.loader}>Loading...</div> : (
        <div style={S.list}>
          {filtered.map(auth => (
            <div key={auth.userAuthorizationId} style={{ ...S.card, ...(auth.active === 'N' ? { opacity: 0.55 } : {}) }}>
              <div style={S.cardTop}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary }}>{auth.displayName || auth.email}</div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{auth.email}</div>
                  <div style={{ fontSize: 12, color: C.blue, marginTop: 4 }}>
                    {auth.customerName} • {auth.entityName || auth.entityId || 'All Entities'}
                  </div>
                  {auth.effectiveDate && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Effective {new Date(auth.effectiveDate).toLocaleDateString()}{auth.expiryDate ? ` • Expires ${new Date(auth.expiryDate).toLocaleDateString()}` : ''}</div>}
                  {auth.createDate && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Added {new Date(auth.createDate).toLocaleDateString()}</div>}
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
              <div style={S.roleRow}>
                <span style={{ color: C.textMuted, fontSize: 13, marginRight: 8 }}>Role:</span>
                {ROLES.map(r => (
                  <button key={r} style={{
                    ...S.roleChip,
                    ...(auth.role === r ? { background: roleColor(r), borderColor: roleColor(r), color: '#fff', fontWeight: 600 } : {}),
                  }} onClick={() => updateRole(auth, r)}>{r}</button>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ color: C.textMuted, textAlign: 'center', padding: 40 }}>No authorizations found</div>}
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
  filterBar: { padding: '10px 16px 4px' },
  searchInput: { width: '100%', boxSizing: 'border-box', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.textPrimary, fontSize: 14, outline: 'none' },
  chipRow: { display: 'flex', gap: 6, padding: '0 16px 8px', flexWrap: 'wrap', alignItems: 'stretch' },
  chip: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '6px 12px', color: C.textMuted, fontSize: 12, cursor: 'pointer' },
  chipActive: { borderColor: C.blue, background: C.blue + '22', color: C.blue, fontWeight: 600 },
  loader: { color: C.blue, textAlign: 'center', padding: 40 },
  list: { padding: '0 12px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  card: { background: C.card, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` },
  cardTop: { display: 'flex', justifyContent: 'space-between' },
  roleRow: { display: 'flex', alignItems: 'center', marginTop: 10 },
  roleChip: { padding: '5px 12px', borderRadius: 14, border: `1px solid ${C.border}`, background: 'none', color: C.textMuted, fontSize: 12, marginRight: 6, cursor: 'pointer' },
};
