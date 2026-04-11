/**
 * ReportManuallyRNPage — web version matching RN ReportManuallyScreen
 * Same dark theme, same API calls, same layout.
 */
import React, { useState, useEffect, useCallback } from 'react';

const C = {
  bg: '#0d1117', card: '#161b22', border: '#30363d',
  textPrimary: '#e6edf3', textMuted: '#8b949e',
  blue: '#388bfd', green: '#3fb950', red: '#da3633', orange: '#d29922',
};

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function toLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function ReportManuallyRNPage() {
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState([]);
  const [allAttributes, setAllAttributes] = useState([]);
  const [filteredAttrs, setFilteredAttrs] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedAttr, setSelectedAttr] = useState(null);
  const [value, setValue] = useState('');
  const [timestamp, setTimestamp] = useState(toLocalISO);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [entitySearch, setEntitySearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [eRes, aRes] = await Promise.all([fetch(`${BASE}/entities`), fetch(`${BASE}/entitytypeattributes`)]);
        if (eRes.ok) setEntities(await eRes.json());
        if (aRes.ok) setAllAttributes(await aRes.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedEntity) { setFilteredAttrs([]); setSelectedAttr(null); return; }
    setFilteredAttrs(allAttributes.filter(a => a.entityTypeId === selectedEntity.entityTypeId && a.active !== 'N'));
    setSelectedAttr(null);
  }, [selectedEntity, allAttributes]);

  const entityName = (e) => `${e.entityFirstName || ''}${e.entityLastName ? ' ' + e.entityLastName : ''}`.trim() || String(e.entityId);

  const handleSubmit = async () => {
    if (!selectedEntity || !selectedAttr || value === '') { alert('Please select Entity, Attribute, and enter a Value.'); return; }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) { alert('Value must be a number.'); return; }
    setSubmitting(true);
    const eName = entityName(selectedEntity);
    try {
      const payload = {
        entityId: selectedEntity.entityId,
        entityTypeAttributeCode: selectedAttr.entityTypeAttributeCode,
        entityTypeAttributeId: selectedAttr.entityTypeAttributeId,
        value: numValue, timestamp: new Date(timestamp).toISOString(), source: 'Manual',
      };
      const res = await fetch(`${BASE}/api/manual-report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`);
      setHistory(prev => [{ entityName: eName, attributeName: selectedAttr.entityTypeAttributeName, value: numValue, unit: selectedAttr.entityTypeAttributeUnit || '', timestamp, status: 'success', message: 'Report submitted' }, ...prev]);
      setValue(''); setTimestamp(toLocalISO());
      alert(`Report submitted for ${eName} — ${selectedAttr.entityTypeAttributeName}: ${numValue}`);
    } catch (e) {
      setHistory(prev => [{ entityName: eName, attributeName: selectedAttr.entityTypeAttributeName, value: numValue, unit: selectedAttr.entityTypeAttributeUnit || '', timestamp, status: 'error', message: e.message }, ...prev]);
      alert(`Submission failed: ${e.message}`);
    } finally { setSubmitting(false); }
  };

  const canSubmit = selectedEntity && selectedAttr && value !== '' && !submitting;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={S.title}>📝 Report Manually</div>
          <div style={S.subtitle}>Submit telemetry measurements</div>
        </div>
      </div>

      {loading ? <div style={S.loader}>Loading...</div> : (
        <div style={{ padding: '0 16px 20px' }}>
          {/* Form Card */}
          <div style={S.formCard}>
            <label style={S.fieldLabel}>Entity</label>
            <input style={S.input} placeholder="Search entities..." value={entitySearch} onChange={e => setEntitySearch(e.target.value)} />
            <select style={S.select} value={selectedEntity ? selectedEntity.entityId : ''} onChange={e => {
              const ent = entities.find(en => String(en.entityId) === e.target.value);
              setSelectedEntity(ent || null); setEntitySearch('');
            }}>
              <option value="">Select Entity...</option>
              {entities.filter(en => !entitySearch || entityName(en).toLowerCase().includes(entitySearch.toLowerCase()) || String(en.entityId).includes(entitySearch))
                .map(en => <option key={en.entityId} value={en.entityId}>{entityName(en)} ({en.entityId})</option>)}
            </select>

            <label style={S.fieldLabel}>Attribute</label>
            <select style={{ ...S.select, ...(selectedEntity ? {} : { opacity: 0.5 }) }} disabled={!selectedEntity}
              value={selectedAttr ? selectedAttr.entityTypeAttributeId : ''} onChange={e => {
                setSelectedAttr(filteredAttrs.find(a => String(a.entityTypeAttributeId) === e.target.value) || null);
              }}>
              <option value="">{selectedEntity ? 'Select Attribute...' : '— Select Entity first —'}</option>
              {filteredAttrs.map(a => <option key={a.entityTypeAttributeId} value={a.entityTypeAttributeId}>{a.entityTypeAttributeName} ({a.entityTypeAttributeCode})</option>)}
            </select>

            {selectedAttr && (
              <div style={S.unitRow}>
                <span style={{ color: C.textMuted, fontSize: 13 }}>Unit:</span>
                <span style={{ color: C.blue, fontSize: 13, fontWeight: 600, marginLeft: 6 }}>{selectedAttr.entityTypeAttributeUnit || '—'}</span>
              </div>
            )}

            <label style={S.fieldLabel}>Measurement Value{selectedAttr?.entityTypeAttributeUnit ? ` (${selectedAttr.entityTypeAttributeUnit})` : ''}</label>
            <input style={S.input} type="number" placeholder="Enter numeric value" value={value} onChange={e => setValue(e.target.value)} />

            <label style={S.fieldLabel}>Measurement Timestamp</label>
            <input type="datetime-local" style={S.input} value={timestamp} onChange={e => setTimestamp(e.target.value)} />

            <button style={{ ...S.submitBtn, ...(canSubmit ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }} disabled={!canSubmit} onClick={handleSubmit}>
              {submitting ? 'Submitting...' : '📤 Submit Report'}
            </button>
          </div>

          {/* History */}
          {history.length > 0 && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginTop: 16, marginBottom: 8 }}>Recent Reports</div>
              {history.map((item, i) => (
                <div key={i} style={S.historyCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{item.entityName}</div>
                      <div style={{ fontSize: 13, color: C.green, marginTop: 2 }}>{item.attributeName}</div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: item.status === 'success' ? C.green + '22' : C.red + '22', color: item.status === 'success' ? C.green : C.red }}>
                      {item.status === 'success' ? '✓ Sent' : '✗ Failed'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.blue }}>{item.value} {item.unit}</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </>
          )}
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
  loader: { color: C.blue, textAlign: 'center', padding: 40 },
  formCard: { marginTop: 16, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, padding: 16 },
  fieldLabel: { display: 'block', fontSize: 13, color: C.textMuted, marginTop: 14, marginBottom: 6, fontWeight: 600 },
  input: { width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px', color: C.textPrimary, fontSize: 14, outline: 'none' },
  select: { width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px', color: C.textPrimary, fontSize: 14, outline: 'none', marginTop: 4 },
  unitRow: { display: 'flex', alignItems: 'center', marginTop: 6, paddingLeft: 4 },
  submitBtn: { width: '100%', marginTop: 18, padding: '14px', borderRadius: 10, background: C.green, border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  historyCard: { background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 8, overflow: 'hidden' },
};
