/**
 * EntityAttributeRNPage — SINGLE SOURCE OF TRUTH for both web and mobile.
 * Includes: Attribute list with filters, Add/Edit attribute, Scoring sub-page (add/edit/delete scores).
 * Same dark theme, same API calls — works in admin dashboard and mobile WebView.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';

const C = {
  bg: '#0d1117', card: '#161b22', border: '#30363d',
  textPrimary: '#e6edf3', textMuted: '#8b949e',
  blue: '#388bfd', green: '#3fb950', red: '#da3633', orange: '#d29922',
};

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const THRESHOLD_STATES = { 0: 'normal', 1: 'warn', 2: 'alarm', 3: 'emergency' };

/* ─── Threshold sub-page ──────────────────────────────────────────────── */
function ScoringView({ attribute, onBack }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ minValue: '', maxValue: '', strValue: '', score: '' });
  const [showStateDropdown, setShowStateDropdown] = useState(false);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/entitytypeattributescore?attributeId=${attribute.entityTypeAttributeId}`);
      if (res.ok) setScores(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [attribute.entityTypeAttributeId]);

  useEffect(() => {
    fetchScores();
    // Auto-populate ranges from protocol attribute
    if (attribute.protocolId) {
      (async () => {
        try {
          const res = await fetch(`${BASE}/protocolattributes?protocolId=${attribute.protocolId}`);
          if (res.ok) {
            const attrs = await res.json();
            const match = attrs.find(a => a.protocolAttributeCode === attribute.entityTypeAttributeCode);
            if (match) {
              setForm(prev => ({
                ...prev,
                minValue: match.rangeMin != null ? String(match.rangeMin) : '',
                maxValue: match.rangeMax != null ? String(match.rangeMax) : '',
              }));
            }
          }
        } catch (e) { console.error(e); }
      })();
    }
  }, [fetchScores, attribute.protocolId, attribute.entityTypeAttributeCode]);

  const resetForm = () => { setForm({ minValue: '', maxValue: '', strValue: '', score: '' }); setEditingId(null); };

  const saveScore = async () => {
    if (!form.score) { alert('State is required'); return; }
    try {
      const body = {
        entityTypeId: attribute.entityTypeId,
        entityTypeAttributeId: attribute.entityTypeAttributeId,
        minValue: form.minValue || null, maxValue: form.maxValue || null,
        strValue: form.strValue || null, score: form.score,
      };
      const url = editingId
        ? `${BASE}/entitytypeattributescore/${editingId}`
        : `${BASE}/entitytypeattributescore`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
      resetForm();
      fetchScores();
    } catch (e) { alert(`Error: ${e.message}`); }
  };

  const editScore = (s) => {
    setEditingId(s.entityTypeAttributeScoreId);
    setForm({
      minValue: s.minValue != null ? String(s.minValue) : '',
      maxValue: s.maxValue != null ? String(s.maxValue) : '',
      strValue: s.strValue || '',
      score: s.score != null ? String(s.score) : '',
    });
  };

  const deleteScore = async (id) => {
    if (!confirm('Delete this score?')) return;
    try {
      await fetch(`${BASE}/entitytypeattributescore/${id}`, { method: 'DELETE' });
      fetchScores();
      if (editingId === id) resetForm();
    } catch (e) { alert(e.message); }
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <div style={S.title}>📊 Threshold Values</div>
          <div style={S.subtitle}>{attribute.entityTypeAttributeName}</div>
        </div>
      </div>

      {/* Add / Edit form */}
      <div style={{ padding: '12px 16px', background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, marginBottom: 10 }}>
          {editingId ? '✏️ Edit Threshold' : '➕ Add New Threshold'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 100px' }}>
            <label style={S.fieldLabel}>Min Value</label>
            <input type="number" step="0.01" style={S.input} placeholder="Min" value={form.minValue} onChange={e => setForm(p => ({ ...p, minValue: e.target.value }))} />
          </div>
          <div style={{ flex: '1 1 100px' }}>
            <label style={S.fieldLabel}>Max Value</label>
            <input type="number" step="0.01" style={S.input} placeholder="Max" value={form.maxValue} onChange={e => setForm(p => ({ ...p, maxValue: e.target.value }))} />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={S.fieldLabel}>String Value</label>
            <input style={S.input} placeholder="e.g. Normal" value={form.strValue} onChange={e => setForm(p => ({ ...p, strValue: e.target.value }))} />
          </div>
          <div style={{ flex: '1 1 100px', position: 'relative' }}>
            <label style={S.fieldLabel}>State *</label>
            <div style={{ position: 'relative' }}>
              <button type="button" style={{ ...S.input, textAlign: 'left', cursor: 'pointer', backgroundColor: C.border, color: C.textPrimary }} onClick={() => setShowStateDropdown(!showStateDropdown)}>
                {form.score ? THRESHOLD_STATES[form.score] || form.score : 'Select state'}
              </button>
              {showStateDropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.card, border: `1px solid ${C.blue}`, borderRadius: 4, zIndex: 10, marginTop: 2 }}>
                  {Object.entries(THRESHOLD_STATES).map(([key, label]) => (
                    <div key={key} style={{ padding: '8px 12px', cursor: 'pointer', color: form.score === key ? C.blue : C.textPrimary, backgroundColor: form.score === key ? 'rgba(56, 139, 253, 0.2)' : 'transparent', borderBottom: `1px solid ${C.border}`, fontSize: 14 }} onClick={() => { setForm(p => ({ ...p, score: key })); setShowStateDropdown(false); }}>
                    {label}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button style={{ ...S.addBtn, background: editingId ? C.blue : C.green }} onClick={saveScore}>
            {editingId ? '💾 Update' : '➕ Add'}
          </button>
          {editingId && <button style={{ ...S.addBtn, background: C.border }} onClick={resetForm}>Cancel</button>}
        </div>
      </div>

      {/* Threshold list */}
      {loading ? <div style={S.loader}>Loading...</div> : (
        <div style={S.list}>
          {scores.map(s => (
            <div key={s.entityTypeAttributeScoreId} style={{ ...S.card, ...(editingId === s.entityTypeAttributeScoreId ? { borderColor: C.blue, background: '#0d1f3c' } : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px' }}>
                <span style={{ fontSize: 14, color: C.textPrimary, fontWeight: 600 }}>
                  {s.minValue != null && s.maxValue != null ? `${s.minValue} — ${s.maxValue}` : s.minValue != null ? `≥ ${s.minValue}` : s.maxValue != null ? `≤ ${s.maxValue}` : '—'}
                </span>
                {s.strValue && <span style={{ fontSize: 13, color: C.orange }}>{s.strValue}</span>}
                <span style={{ fontSize: 14, fontWeight: 700, color: C.blue, marginLeft: 'auto' }}>State: {THRESHOLD_STATES[s.score] || s.score}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                <button style={{ ...S.cardBtn, color: C.blue }} onClick={() => editScore(s)}>✏️ Edit</button>
                <button style={{ ...S.cardBtn, color: C.red }} onClick={() => deleteScore(s.entityTypeAttributeScoreId)}>🗑️ Delete</button>
              </div>
            </div>
          ))}
          {scores.length === 0 && <div style={{ color: C.textMuted, textAlign: 'center', padding: 40 }}>No thresholds defined yet</div>}
        </div>
      )}
    </div>
  );
}

/* ─── Add / Edit Attribute sub-page ─────────────────────────────────── */
function AttributeFormView({ attribute, onBack, onSaved }) {
  const [entityTypes, setEntityTypes] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [protocolAttributes, setProtocolAttributes] = useState([]);
  const [providers, setProviders] = useState([]);
  const [providerEvents, setProviderEvents] = useState([]);
  const [saving, setSaving] = useState(false);
  const isEditing = !!attribute;

  const [form, setForm] = useState({
    entityTypeId: '', protocolId: '', entityTypeAttributeCode: '',
    entityTypeAttributeName: '', entityTypeAttributeTimeAspect: 'Pt',
    entityTypeAttributeUnit: '', providerId: '', providerEventType: '',
    active: 'Y', defaultInGraph: 'N',
  });

  useEffect(() => {
    (async () => {
      try {
        const [etRes, pRes, pvRes, peRes] = await Promise.all([
          fetch(`${BASE}/entitytypes`), fetch(`${BASE}/protocols`),
          fetch(`${BASE}/providers`), fetch(`${BASE}/providerevents`),
        ]);
        if (etRes.ok) setEntityTypes(await etRes.json());
        if (pRes.ok) setProtocols(await pRes.json());
        if (pvRes.ok) setProviders(await pvRes.json());
        if (peRes.ok) setProviderEvents(await peRes.json());
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    if (attribute) {
      setForm({
        entityTypeId: String(attribute.entityTypeId || ''),
        protocolId: attribute.protocolId ? String(attribute.protocolId) : '',
        entityTypeAttributeCode: attribute.entityTypeAttributeCode || '',
        entityTypeAttributeName: attribute.entityTypeAttributeName || '',
        entityTypeAttributeTimeAspect: attribute.entityTypeAttributeTimeAspect || 'Pt',
        entityTypeAttributeUnit: attribute.entityTypeAttributeUnit || '',
        providerId: attribute.providerId ? String(attribute.providerId) : '',
        providerEventType: attribute.providerEventType || '',
        active: attribute.active || 'Y',
        defaultInGraph: attribute.defaultInGraph || 'N',
      });
      if (attribute.protocolId) loadProtocolAttributes(String(attribute.protocolId));
    }
  }, [attribute]);

  const loadProtocolAttributes = async (protocolId) => {
    if (!protocolId) { setProtocolAttributes([]); return; }
    try {
      const res = await fetch(`${BASE}/protocolattributes?protocolId=${protocolId}`);
      if (res.ok) setProtocolAttributes(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleProtocolChange = (val) => {
    setForm(p => ({ ...p, protocolId: val, entityTypeAttributeCode: '', entityTypeAttributeUnit: '' }));
    loadProtocolAttributes(val);
  };

  const handleCodeChange = (val) => {
    setForm(p => ({ ...p, entityTypeAttributeCode: val }));
    const match = protocolAttributes.find(a => a.protocolAttributeCode === val);
    if (match?.unit) setForm(p => ({ ...p, entityTypeAttributeUnit: match.unit }));
  };

  const filteredProviderEvents = form.providerId
    ? providerEvents.filter(e => e.providerId === parseInt(form.providerId))
    : [];

  const save = async () => {
    if (!form.entityTypeId) { alert('Entity Type is required'); return; }
    if (!form.entityTypeAttributeCode) { alert('Attribute Code is required'); return; }
    if (!form.entityTypeAttributeName) { alert('Attribute Name is required'); return; }
    setSaving(true);
    try {
      const url = isEditing
        ? `${BASE}/entitytypeattributes/${attribute.entityTypeAttributeId}`
        : `${BASE}/entitytypeattributes`;
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
      onSaved();
    } catch (e) { alert(`Error: ${e.message}`); }
    finally { setSaving(false); }
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <div style={S.title}>{isEditing ? '✏️ Edit Attribute' : '➕ New Attribute'}</div>
          {isEditing && <div style={S.subtitle}>{attribute.entityTypeAttributeName}</div>}
        </div>
      </div>

      <div style={{ padding: '12px 16px', overflowY: 'auto', flex: 1 }}>
        <label style={S.fieldLabel}>Entity Type *</label>
        <select style={S.select} value={form.entityTypeId} onChange={e => setForm(p => ({ ...p, entityTypeId: e.target.value }))}>
          <option value="">Select...</option>
          {entityTypes.map(t => <option key={t.entityTypeId} value={t.entityTypeId}>{t.entityTypeName}</option>)}
        </select>

        <label style={S.fieldLabel}>Protocol</label>
        <select style={S.select} value={form.protocolId} onChange={e => handleProtocolChange(e.target.value)}>
          <option value="">None</option>
          {protocols.map(p => <option key={p.protocolId} value={p.protocolId}>{p.protocolName}</option>)}
        </select>

        <label style={S.fieldLabel}>Attribute Code *</label>
        {protocolAttributes.length > 0 ? (
          <select style={S.select} value={form.entityTypeAttributeCode} onChange={e => handleCodeChange(e.target.value)}>
            <option value="">Select from protocol...</option>
            {protocolAttributes.map(a => (
              <option key={a.protocolAttributeId} value={a.protocolAttributeCode}>
                {a.protocolAttributeCode} — {a.protocolAttributeName}
              </option>
            ))}
          </select>
        ) : (
          <input style={S.input} value={form.entityTypeAttributeCode} onChange={e => setForm(p => ({ ...p, entityTypeAttributeCode: e.target.value }))} placeholder="e.g., heartRate" />
        )}

        <label style={S.fieldLabel}>Attribute Name *</label>
        <input style={S.input} value={form.entityTypeAttributeName} onChange={e => setForm(p => ({ ...p, entityTypeAttributeName: e.target.value }))} placeholder="e.g., Heart Rate" />

        <label style={S.fieldLabel}>Unit</label>
        <input style={S.input} value={form.entityTypeAttributeUnit} onChange={e => setForm(p => ({ ...p, entityTypeAttributeUnit: e.target.value }))} placeholder="e.g., bpm" />

        <label style={S.fieldLabel}>Time Aspect</label>
        <select style={S.select} value={form.entityTypeAttributeTimeAspect} onChange={e => setForm(p => ({ ...p, entityTypeAttributeTimeAspect: e.target.value }))}>
          <option value="Pt">Point (Pt)</option>
          <option value="Range">Range</option>
        </select>

        <label style={S.fieldLabel}>Provider</label>
        <select style={S.select} value={form.providerId} onChange={e => setForm(p => ({ ...p, providerId: e.target.value, providerEventType: '' }))}>
          <option value="">None</option>
          {providers.map(p => <option key={p.providerId} value={p.providerId}>{p.providerName}</option>)}
        </select>

        {form.providerId && (
          <>
            <label style={S.fieldLabel}>Provider Event Type</label>
            <select style={S.select} value={form.providerEventType} onChange={e => setForm(p => ({ ...p, providerEventType: e.target.value }))}>
              <option value="">None</option>
              {filteredProviderEvents.map(e => (
                <option key={e.providerEventId} value={e.providerEventType}>{e.providerEventType}</option>
              ))}
            </select>
          </>
        )}

        <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textPrimary, fontSize: 14 }}>
            <input type="checkbox" checked={form.active === 'Y'} onChange={e => setForm(p => ({ ...p, active: e.target.checked ? 'Y' : 'N' }))} />
            Active
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textPrimary, fontSize: 14 }}>
            <input type="checkbox" checked={form.defaultInGraph === 'Y'} onChange={e => setForm(p => ({ ...p, defaultInGraph: e.target.checked ? 'Y' : 'N' }))} />
            Show in Graph
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={S.cancelBtn} onClick={onBack}>Cancel</button>
          <button style={S.saveBtn} onClick={save} disabled={saving}>{saving ? 'Saving...' : '💾 Save'}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Attribute List Page ────────────────────────────────────────── */
export default function EntityAttributeRNPage() {
  const [subPage, setSubPage] = useState('list'); // 'list' | 'form' | 'scores'
  const [selectedAttr, setSelectedAttr] = useState(null);

  const [attributes, setAttributes] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filter, setFilter] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('all');
  const [filterProtocol, setFilterProtocol] = useState('all');
  const [filterActive, setFilterActive] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [attrRes, etRes, pRes] = await Promise.all([
        fetch(`${BASE}/entitytypeattributes`),
        fetch(`${BASE}/entitytypes`),
        fetch(`${BASE}/protocols`),
      ]);
      if (attrRes.ok) setAttributes(await attrRes.json());
      if (etRes.ok) setEntityTypes(await etRes.json());
      if (pRes.ok) setProtocols(await pRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getEntityTypeName = (id) => entityTypes.find(t => t.entityTypeId === id)?.entityTypeName || '?';
  const getProtocolName = (id) => protocols.find(p => p.protocolId === id)?.protocolName || '';

  const filtered = useMemo(() => attributes.filter(a => {
    if (filterActive !== 'all' && a.active !== filterActive) return false;
    if (filterEntityType !== 'all' && a.entityTypeId !== parseInt(filterEntityType)) return false;
    if (filterProtocol !== 'all' && a.protocolId !== parseInt(filterProtocol)) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (a.entityTypeAttributeName || '').toLowerCase().includes(q)
        || (a.entityTypeAttributeCode || '').toLowerCase().includes(q)
        || (a.entityTypeAttributeUnit || '').toLowerCase().includes(q)
        || getEntityTypeName(a.entityTypeId).toLowerCase().includes(q);
    }
    return true;
  }), [attributes, filter, filterActive, filterEntityType, filterProtocol, entityTypes]);

  const openForm = (attr) => { setSelectedAttr(attr); setSubPage('form'); };
  const openScoring = (attr) => { setSelectedAttr(attr); setSubPage('scores'); };

  const deleteAttr = async (attr) => {
    if (!confirm(`Delete attribute "${attr.entityTypeAttributeName}"?`)) return;
    try {
      await fetch(`${BASE}/entitytypeattributes/${attr.entityTypeAttributeId}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { alert(e.message); }
  };

  const toggleActive = async (attr) => {
    const newActive = attr.active === 'Y' ? 'N' : 'Y';
    try {
      const res = await fetch(`${BASE}/entitytypeattributes/${attr.entityTypeAttributeId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (res.ok) setAttributes(prev => prev.map(a => a.entityTypeAttributeId === attr.entityTypeAttributeId ? { ...a, active: newActive } : a));
    } catch (e) { alert(e.message); }
  };

  // ─── Sub-page routing ───
  if (subPage === 'form') {
    return <AttributeFormView attribute={selectedAttr} onBack={() => setSubPage('list')} onSaved={() => { setSubPage('list'); fetchData(); }} />;
  }
  if (subPage === 'scores' && selectedAttr) {
    return <ScoringView attribute={selectedAttr} onBack={() => setSubPage('list')} />;
  }

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={S.title}>⚙️ Entity Attributes</div>
          <div style={S.subtitle}>
            {filtered.length} shown • {attributes.filter(a => a.active === 'Y').length} active / {attributes.length} total
          </div>
        </div>
        <button style={S.addBtn} onClick={() => openForm(null)}>+ New</button>
      </div>

      {/* Filter bar */}
      <div style={S.filterBar}>
        <input style={S.searchInput} placeholder="Search name, code, unit..." value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      {/* Filter chips row */}
      <div style={S.chipRow}>
        {[{ label: 'All', v: 'all' }, { label: 'Active', v: 'Y' }, { label: 'Inactive', v: 'N' }].map(f => (
          <button key={f.v} style={{ ...S.chip, ...(filterActive === f.v ? S.chipActive : {}) }}
            onClick={() => setFilterActive(f.v)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Dropdown filters */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 8px', flexWrap: 'wrap' }}>
        <select style={{ ...S.select, flex: '1 1 140px' }} value={filterEntityType} onChange={e => setFilterEntityType(e.target.value)}>
          <option value="all">All Entity Types</option>
          {entityTypes.map(t => <option key={t.entityTypeId} value={t.entityTypeId}>{t.entityTypeName}</option>)}
        </select>
        <select style={{ ...S.select, flex: '1 1 140px' }} value={filterProtocol} onChange={e => setFilterProtocol(e.target.value)}>
          <option value="all">All Protocols</option>
          {protocols.map(p => <option key={p.protocolId} value={p.protocolId}>{p.protocolName}</option>)}
        </select>
      </div>

      {/* Attribute list */}
      {loading ? <div style={S.loader}>Loading...</div> : (
        <div style={S.list}>
          {filtered.map(attr => (
            <div key={attr.entityTypeAttributeId} style={{ ...S.card, ...(attr.active === 'N' ? { opacity: 0.55 } : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px' }}>
                <span style={S.cardTitle}>{attr.entityTypeAttributeName}</span>
                <span style={{ fontSize: 12, color: C.blue, fontFamily: 'monospace' }}>{attr.entityTypeAttributeCode}</span>
                {attr.entityTypeAttributeUnit && <span style={{ fontSize: 12, color: C.orange }}>({attr.entityTypeAttributeUnit})</span>}
                <span style={{ fontSize: 12, color: C.textMuted }}>{getEntityTypeName(attr.entityTypeId)}</span>
                {attr.protocolId && <span style={{ fontSize: 11, color: C.green }}>📡 {getProtocolName(attr.protocolId)}</span>}
                {attr.defaultInGraph === 'Y' && <span style={{ fontSize: 11, color: C.blue }}>📈</span>}

                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
                    <input type="checkbox" checked={attr.active === 'Y'} onChange={() => toggleActive(attr)} />
                    <span style={{ color: attr.active === 'Y' ? C.green : C.red, marginLeft: 4, fontSize: 11 }}>
                      {attr.active === 'Y' ? 'Active' : 'Off'}
                    </span>
                  </label>
                  <button style={{ ...S.cardBtn, color: C.orange }} onClick={() => openScoring(attr)}>📊 Thresholds</button>
                  <button style={{ ...S.cardBtn, color: C.blue }} onClick={() => openForm(attr)}>✏️</button>
                  <button style={{ ...S.cardBtn, color: C.red }} onClick={() => deleteAttr(attr)}>🗑️</button>
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ color: C.textMuted, textAlign: 'center', padding: 40 }}>No attributes found</div>}
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
  chipRow: { display: 'flex', gap: 6, padding: '6px 16px 8px', flexWrap: 'wrap' },
  chip: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '6px 12px', color: C.textMuted, fontSize: 12, cursor: 'pointer' },
  chipActive: { borderColor: C.blue, background: C.blue + '22', color: C.blue, fontWeight: 600 },
  loader: { color: C.blue, textAlign: 'center', padding: 40 },
  list: { padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  card: { background: C.card, borderRadius: 10, padding: '10px 14px', border: `1px solid ${C.border}` },
  cardTitle: { fontSize: 15, fontWeight: 600, color: C.textPrimary },
  cardBtn: { background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 13, padding: '4px 8px' },
  // Form
  fieldLabel: { display: 'block', fontSize: 13, color: C.textMuted, marginTop: 14, marginBottom: 6, fontWeight: 600 },
  input: { width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.textPrimary, fontSize: 14, outline: 'none' },
  select: { width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.textPrimary, fontSize: 14, outline: 'none', marginTop: 4 },
  cancelBtn: { background: C.border, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
  saveBtn: { background: C.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
  // Modal / overlay (not used in this page but kept for consistency)
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 60, zIndex: 1000 },
  modal: { background: C.card, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' },
};
