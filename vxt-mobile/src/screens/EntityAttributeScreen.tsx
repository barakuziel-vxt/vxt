import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch,
  Alert, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native';
import { DrawerContext } from '../context/DrawerContext';
import { loadDataSource } from '../hooks/useDataSource';

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

type SubPage = 'list' | 'form' | 'scores';

interface Attribute {
  entityTypeAttributeId: number;
  entityTypeId: number;
  protocolId: number | null;
  entityTypeAttributeCode: string;
  entityTypeAttributeName: string;
  entityTypeAttributeTimeAspect: string;
  entityTypeAttributeUnit: string;
  providerId: number | null;
  providerEventType: string | null;
  active: string;
  defaultInGraph: string;
  component?: string;
}

interface Score {
  entityTypeAttributeScoreId: number;
  entityTypeAttributeId: number;
  entityTypeId: number;
  minValue: number | null;
  maxValue: number | null;
  strValue: string | null;
  score: number;
}

interface DropdownItem { id: number | string; label: string; }

const THRESHOLD_STATES = { '0': 'normal', '1': 'warn', '2': 'alarm', '3': 'emergency' };

/* ─── Threshold Sub-Screen ─────────────────────────────────────────────── */
function ScoringScreen({ attribute, baseUrl, onBack }: {
  attribute: Attribute; baseUrl: string; onBack: () => void;
}) {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [strValue, setStrValue] = useState('');
  const [scoreVal, setScoreVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/entitytypeattributescore?attributeId=${attribute.entityTypeAttributeId}`);
      if (res.ok) setScores(await res.json());
    } catch (e: any) { console.error(e); }
    finally { setLoading(false); }
  }, [baseUrl, attribute.entityTypeAttributeId]);

  useEffect(() => {
    fetchScores();
    // Auto-populate ranges from protocol
    if (attribute.protocolId) {
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/protocolattributes?protocolId=${attribute.protocolId}`);
          if (res.ok) {
            const attrs = await res.json();
            const match = attrs.find((a: any) => a.protocolAttributeCode === attribute.entityTypeAttributeCode);
            if (match) {
              if (match.rangeMin != null) setMinValue(String(match.rangeMin));
              if (match.rangeMax != null) setMaxValue(String(match.rangeMax));
            }
          }
        } catch { /* best-effort */ }
      })();
    }
  }, [fetchScores]);

  const resetForm = () => { setMinValue(''); setMaxValue(''); setStrValue(''); setScoreVal(''); setEditingId(null); };

  const saveScore = async () => {
    if (!scoreVal) { Alert.alert('Error', 'State is required'); return; }
    setSaving(true);
    try {
      const body = {
        entityTypeId: attribute.entityTypeId,
        entityTypeAttributeId: attribute.entityTypeAttributeId,
        minValue: minValue || null, maxValue: maxValue || null,
        strValue: strValue || null, score: scoreVal,
      };
      const url = editingId
        ? `${baseUrl}/entitytypeattributescore/${editingId}`
        : `${baseUrl}/entitytypeattributescore`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
      resetForm();
      fetchScores();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const editScore = (s: Score) => {
    setEditingId(s.entityTypeAttributeScoreId);
    setMinValue(s.minValue != null ? String(s.minValue) : '');
    setMaxValue(s.maxValue != null ? String(s.maxValue) : '');
    setStrValue(s.strValue || '');
    setScoreVal(s.score != null ? String(s.score) : '');
  };

  const deleteScore = (s: Score) => {
    Alert.alert('Delete Threshold', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${baseUrl}/entitytypeattributescore/${s.entityTypeAttributeScoreId}`, { method: 'DELETE' });
          fetchScores();
          if (editingId === s.entityTypeAttributeScoreId) resetForm();
        } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>📊 Threshold Values</Text>
          <Text style={styles.subtitle}>{attribute.entityTypeAttributeName}</Text>
        </View>
      </View>

      {/* Add/Edit form */}
      <View style={{ padding: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.textPrimary, marginBottom: 8 }}>
          {editingId ? '✏️ Edit Threshold' : '➕ Add New Threshold'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 80 }}>
            <Text style={styles.fieldLabel}>Min</Text>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="Min" placeholderTextColor={C.textMuted}
              value={minValue} onChangeText={setMinValue} />
          </View>
          <View style={{ flex: 1, minWidth: 80 }}>
            <Text style={styles.fieldLabel}>Max</Text>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="Max" placeholderTextColor={C.textMuted}
              value={maxValue} onChangeText={setMaxValue} />
          </View>
          <View style={{ flex: 1, minWidth: 80 }}>
            <Text style={styles.fieldLabel}>String</Text>
            <TextInput style={styles.input} placeholder="e.g. Normal" placeholderTextColor={C.textMuted}
              value={strValue} onChangeText={setStrValue} />
          </View>
          <View style={{ flex: 1, minWidth: 70 }}>
            <Text style={styles.fieldLabel}>State *</Text>
            <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowStateDropdown(!showStateDropdown)}>
              <Text style={{ color: scoreVal ? C.textPrimary : C.textMuted }}>{scoreVal ? THRESHOLD_STATES[scoreVal] : 'Select state'}</Text>
            </TouchableOpacity>
            {showStateDropdown && (
              <View style={{ position: 'absolute', top: 115, left: 0, right: 0, background: C.card, borderWidth: 1, borderColor: C.blue, borderRadius: 4, zIndex: 10 }}>
                {Object.entries(THRESHOLD_STATES).map(([key, label]) => (
                  <TouchableOpacity key={key} onPress={() => { setScoreVal(key); setShowStateDropdown(false); }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: scoreVal === key ? 'rgba(56, 139, 253, 0.2)' : 'transparent' }}>
                    <Text style={{ color: scoreVal === key ? C.blue : C.textPrimary, fontSize: 14 }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: editingId ? C.blue : C.green }]} onPress={saveScore} disabled={saving}>
            <Text style={styles.actionBtnText}>{saving ? 'Saving...' : editingId ? '💾 Update' : '➕ Add'}</Text>
          </TouchableOpacity>
          {editingId != null && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.border }]} onPress={resetForm}>
              <Text style={styles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Score list */}
      {loading ? (
        <ActivityIndicator color={C.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={scores}
          keyExtractor={item => String(item.entityTypeAttributeScoreId)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={<Text style={{ color: C.textMuted, textAlign: 'center', padding: 40 }}>No thresholds defined yet</Text>}
          renderItem={({ item: s }) => (
            <View style={[styles.card, editingId === s.entityTypeAttributeScoreId && { borderColor: C.blue, backgroundColor: '#0d1f3c' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Text style={{ fontSize: 14, color: C.textPrimary, fontWeight: '600' }}>
                  {s.minValue != null && s.maxValue != null ? `${s.minValue} — ${s.maxValue}` : s.minValue != null ? `≥ ${s.minValue}` : s.maxValue != null ? `≤ ${s.maxValue}` : '—'}
                </Text>
                {s.strValue ? <Text style={{ fontSize: 13, color: C.orange }}>{s.strValue}</Text> : null}
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.blue, marginLeft: 'auto' }}>State: {THRESHOLD_STATES[String(s.score)] || s.score}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 }}>
                <TouchableOpacity onPress={() => editScore(s)}>
                  <Text style={{ color: C.blue, fontSize: 13, padding: 4 }}>✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteScore(s)}>
                  <Text style={{ color: C.red, fontSize: 13, padding: 4 }}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

/* ─── Add/Edit Attribute Sub-Screen ──────────────────────────────────── */
function AttributeFormScreen({ attribute, baseUrl, onBack, onSaved }: {
  attribute: Attribute | null; baseUrl: string; onBack: () => void; onSaved: () => void;
}) {
  const isEditing = !!attribute;
  const [entityTypes, setEntityTypes] = useState<DropdownItem[]>([]);
  const [protocols, setProtocols] = useState<DropdownItem[]>([]);
  const [protocolAttributes, setProtocolAttributes] = useState<any[]>([]);
  const [providers, setProviders] = useState<DropdownItem[]>([]);
  const [providerEvents, setProviderEvents] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Picker visibility
  const [showEntityTypePicker, setShowEntityTypePicker] = useState(false);
  const [showProtocolPicker, setShowProtocolPicker] = useState(false);
  const [showCodePicker, setShowCodePicker] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [showEventTypePicker, setShowEventTypePicker] = useState(false);

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
          fetch(`${baseUrl}/entitytypes`), fetch(`${baseUrl}/protocols`),
          fetch(`${baseUrl}/providers`), fetch(`${baseUrl}/providerevents`),
        ]);
        if (etRes.ok) { const d = await etRes.json(); setEntityTypes(d.map((t: any) => ({ id: t.entityTypeId, label: t.entityTypeName }))); }
        if (pRes.ok) { const d = await pRes.json(); setProtocols(d.map((p: any) => ({ id: p.protocolId, label: p.protocolName }))); }
        if (pvRes.ok) { const d = await pvRes.json(); setProviders(d.map((p: any) => ({ id: p.providerId, label: p.providerName }))); }
        if (peRes.ok) setProviderEvents(await peRes.json());
      } catch (e) { console.error(e); }
    })();
  }, [baseUrl]);

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
      if (attribute.protocolId) loadProtocolAttrs(String(attribute.protocolId));
    }
  }, [attribute]);

  const loadProtocolAttrs = async (protocolId: string) => {
    if (!protocolId) { setProtocolAttributes([]); return; }
    try {
      const res = await fetch(`${baseUrl}/protocolattributes?protocolId=${protocolId}`);
      if (res.ok) setProtocolAttributes(await res.json());
    } catch { /* best-effort */ }
  };

  const filteredProvEvents = form.providerId
    ? providerEvents.filter((e: any) => e.providerId === parseInt(form.providerId))
    : [];

  const selectedEntityType = entityTypes.find(t => String(t.id) === form.entityTypeId)?.label || 'Select...';
  const selectedProtocol = protocols.find(p => String(p.id) === form.protocolId)?.label || 'None';
  const selectedProvider = providers.find(p => String(p.id) === form.providerId)?.label || 'None';

  const save = async () => {
    if (!form.entityTypeId) { Alert.alert('Error', 'Entity Type is required'); return; }
    if (!form.entityTypeAttributeCode) { Alert.alert('Error', 'Attribute Code is required'); return; }
    if (!form.entityTypeAttributeName) { Alert.alert('Error', 'Attribute Name is required'); return; }
    setSaving(true);
    try {
      const url = isEditing
        ? `${baseUrl}/entitytypeattributes/${attribute!.entityTypeAttributeId}`
        : `${baseUrl}/entitytypeattributes`;
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
      onSaved();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const renderPicker = (visible: boolean, onClose: () => void, items: DropdownItem[], onSelect: (item: DropdownItem) => void, title: string, allowNone = false) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: C.blue, fontSize: 16 }}>Done</Text></TouchableOpacity>
          </View>
          {allowNone && (
            <TouchableOpacity style={styles.pickerItem} onPress={() => { onSelect({ id: '', label: 'None' }); onClose(); }}>
              <Text style={styles.pickerItemText}>None</Text>
            </TouchableOpacity>
          )}
          <FlatList
            data={items}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerItem} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={styles.pickerItemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>{isEditing ? '✏️ Edit Attribute' : '➕ New Attribute'}</Text>
          {isEditing && <Text style={styles.subtitle}>{attribute!.entityTypeAttributeName}</Text>}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.fieldLabel}>Entity Type *</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowEntityTypePicker(true)}>
          <Text style={styles.pickerButtonText}>{selectedEntityType}</Text>
          <Text style={{ color: C.textMuted }}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Protocol</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowProtocolPicker(true)}>
          <Text style={styles.pickerButtonText}>{selectedProtocol}</Text>
          <Text style={{ color: C.textMuted }}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Attribute Code *</Text>
        {protocolAttributes.length > 0 ? (
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCodePicker(true)}>
            <Text style={styles.pickerButtonText}>{form.entityTypeAttributeCode || 'Select from protocol...'}</Text>
            <Text style={{ color: C.textMuted }}>▼</Text>
          </TouchableOpacity>
        ) : (
          <TextInput style={styles.input} value={form.entityTypeAttributeCode} placeholderTextColor={C.textMuted}
            onChangeText={v => setForm(p => ({ ...p, entityTypeAttributeCode: v }))} placeholder="e.g., heartRate" />
        )}

        <Text style={styles.fieldLabel}>Attribute Name *</Text>
        <TextInput style={styles.input} value={form.entityTypeAttributeName} placeholderTextColor={C.textMuted}
          onChangeText={v => setForm(p => ({ ...p, entityTypeAttributeName: v }))} placeholder="e.g., Heart Rate" />

        <Text style={styles.fieldLabel}>Unit</Text>
        <TextInput style={styles.input} value={form.entityTypeAttributeUnit} placeholderTextColor={C.textMuted}
          onChangeText={v => setForm(p => ({ ...p, entityTypeAttributeUnit: v }))} placeholder="e.g., bpm" />

        <Text style={styles.fieldLabel}>Time Aspect</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['Pt', 'Range'].map(v => (
            <TouchableOpacity key={v} style={[styles.chipBtn, form.entityTypeAttributeTimeAspect === v && styles.chipBtnActive]}
              onPress={() => setForm(p => ({ ...p, entityTypeAttributeTimeAspect: v }))}>
              <Text style={[styles.chipBtnText, form.entityTypeAttributeTimeAspect === v && { color: '#fff' }]}>
                {v === 'Pt' ? 'Point' : 'Range'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Provider</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowProviderPicker(true)}>
          <Text style={styles.pickerButtonText}>{selectedProvider}</Text>
          <Text style={{ color: C.textMuted }}>▼</Text>
        </TouchableOpacity>

        {form.providerId ? (
          <>
            <Text style={styles.fieldLabel}>Provider Event Type</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowEventTypePicker(true)}>
              <Text style={styles.pickerButtonText}>{form.providerEventType || 'None'}</Text>
              <Text style={{ color: C.textMuted }}>▼</Text>
            </TouchableOpacity>
          </>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 20, marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Switch value={form.active === 'Y'} onValueChange={v => setForm(p => ({ ...p, active: v ? 'Y' : 'N' }))}
              trackColor={{ false: C.border, true: C.green }} thumbColor="#fff" />
            <Text style={{ color: C.textPrimary, fontSize: 14 }}>Active</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Switch value={form.defaultInGraph === 'Y'} onValueChange={v => setForm(p => ({ ...p, defaultInGraph: v ? 'Y' : 'N' }))}
              trackColor={{ false: C.border, true: C.blue }} thumbColor="#fff" />
            <Text style={{ color: C.textPrimary, fontSize: 14 }}>Graph</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.border, flex: 1 }]} onPress={onBack}>
            <Text style={styles.actionBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.blue, flex: 1 }]} onPress={save} disabled={saving}>
            <Text style={styles.actionBtnText}>{saving ? 'Saving...' : '💾 Save'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Pickers */}
      {renderPicker(showEntityTypePicker, () => setShowEntityTypePicker(false), entityTypes, (item) => setForm(p => ({ ...p, entityTypeId: String(item.id) })), 'Entity Type')}
      {renderPicker(showProtocolPicker, () => setShowProtocolPicker(false), protocols, (item) => {
        setForm(p => ({ ...p, protocolId: String(item.id), entityTypeAttributeCode: '', entityTypeAttributeUnit: '' }));
        loadProtocolAttrs(String(item.id));
      }, 'Protocol', true)}
      {renderPicker(showCodePicker, () => setShowCodePicker(false),
        protocolAttributes.map((a: any) => ({ id: a.protocolAttributeCode, label: `${a.protocolAttributeCode} — ${a.protocolAttributeName}` })),
        (item) => {
          setForm(p => ({ ...p, entityTypeAttributeCode: String(item.id) }));
          const match = protocolAttributes.find((a: any) => a.protocolAttributeCode === String(item.id));
          if (match?.unit) setForm(p => ({ ...p, entityTypeAttributeUnit: match.unit }));
        }, 'Attribute Code')}
      {renderPicker(showProviderPicker, () => setShowProviderPicker(false), providers, (item) => {
        setForm(p => ({ ...p, providerId: String(item.id), providerEventType: '' }));
      }, 'Provider', true)}
      {renderPicker(showEventTypePicker, () => setShowEventTypePicker(false),
        filteredProvEvents.map((e: any) => ({ id: e.providerEventType, label: e.providerEventType })),
        (item) => setForm(p => ({ ...p, providerEventType: String(item.id) })),
        'Event Type', true)}
    </View>
  );
}

/* ─── Main Attribute List Screen ─────────────────────────────────────── */
export default function EntityAttributeScreen() {
  const { openDrawer } = useContext(DrawerContext);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [entityTypes, setEntityTypes] = useState<any[]>([]);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'Y' | 'N'>('all');
  const [filterEntityType, setFilterEntityType] = useState<string>('all');
  const [subPage, setSubPage] = useState<SubPage>('list');
  const [selectedAttr, setSelectedAttr] = useState<Attribute | null>(null);
  const [showEntityTypePicker, setShowEntityTypePicker] = useState(false);

  useEffect(() => {
    (async () => {
      const ds = await loadDataSource();
      setBaseUrl(ds.baseUrl);
    })();
  }, []);

  const fetchData = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true);
    try {
      const [attrRes, etRes, pRes] = await Promise.all([
        fetch(`${baseUrl}/entitytypeattributes`),
        fetch(`${baseUrl}/entitytypes`),
        fetch(`${baseUrl}/protocols`),
      ]);
      if (attrRes.ok) setAttributes(await attrRes.json());
      if (etRes.ok) setEntityTypes(await etRes.json());
      if (pRes.ok) setProtocols(await pRes.json());
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }, [baseUrl]);

  useEffect(() => { if (baseUrl) fetchData(); }, [baseUrl, fetchData]);

  const getEntityTypeName = (id: number) => entityTypes.find((t: any) => t.entityTypeId === id)?.entityTypeName || '?';
  const getProtocolName = (id: number | null) => id ? protocols.find((p: any) => p.protocolId === id)?.protocolName || '' : '';

  const filtered = useMemo(() => attributes.filter(a => {
    if (filterActive !== 'all' && a.active !== filterActive) return false;
    if (filterEntityType !== 'all' && a.entityTypeId !== parseInt(filterEntityType)) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (a.entityTypeAttributeName || '').toLowerCase().includes(q)
        || (a.entityTypeAttributeCode || '').toLowerCase().includes(q)
        || (a.entityTypeAttributeUnit || '').toLowerCase().includes(q)
        || getEntityTypeName(a.entityTypeId).toLowerCase().includes(q);
    }
    return true;
  }), [attributes, filter, filterActive, filterEntityType, entityTypes]);

  const toggleActive = async (attr: Attribute) => {
    if (!baseUrl) return;
    const newActive = attr.active === 'Y' ? 'N' : 'Y';
    try {
      const res = await fetch(`${baseUrl}/entitytypeattributes/${attr.entityTypeAttributeId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive }),
      });
      if (res.ok) setAttributes(prev => prev.map(a => a.entityTypeAttributeId === attr.entityTypeAttributeId ? { ...a, active: newActive } : a));
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const deleteAttr = (attr: Attribute) => {
    Alert.alert('Delete Attribute', `Delete "${attr.entityTypeAttributeName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await fetch(`${baseUrl}/entitytypeattributes/${attr.entityTypeAttributeId}`, { method: 'DELETE' });
          fetchData();
        } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  // ─── Sub-page routing ───
  if (subPage === 'form' && baseUrl) {
    return <AttributeFormScreen attribute={selectedAttr} baseUrl={baseUrl}
      onBack={() => setSubPage('list')}
      onSaved={() => { setSubPage('list'); fetchData(); }} />;
  }
  if (subPage === 'scores' && selectedAttr && baseUrl) {
    return <ScoringScreen attribute={selectedAttr} baseUrl={baseUrl}
      onBack={() => setSubPage('list')} />;
  }

  const etPickerItems: DropdownItem[] = entityTypes.map((t: any) => ({ id: t.entityTypeId, label: t.entityTypeName }));

  const renderItem = ({ item: attr }: { item: Attribute }) => (
    <View style={[styles.card, attr.active === 'N' && { opacity: 0.55 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: C.textPrimary, marginRight: 8 }}>{attr.entityTypeAttributeName}</Text>
        <Text style={{ fontSize: 12, color: C.blue, fontFamily: 'monospace' }}>{attr.entityTypeAttributeCode}</Text>
        {attr.entityTypeAttributeUnit ? <Text style={{ fontSize: 12, color: C.orange }}>({attr.entityTypeAttributeUnit})</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <Text style={{ fontSize: 12, color: C.textMuted }}>{getEntityTypeName(attr.entityTypeId)}</Text>
        {attr.protocolId ? <Text style={{ fontSize: 11, color: C.green }}>📡 {getProtocolName(attr.protocolId)}</Text> : null}
        {attr.defaultInGraph === 'Y' ? <Text style={{ fontSize: 11, color: C.blue }}>📈 Graph</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 }}>
        <Switch value={attr.active === 'Y'} onValueChange={() => toggleActive(attr)}
          trackColor={{ false: C.border, true: C.green }} thumbColor="#fff"
          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
        <Text style={{ color: attr.active === 'Y' ? C.green : C.red, fontSize: 11 }}>
          {attr.active === 'Y' ? 'Active' : 'Off'}
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => { setSelectedAttr(attr); setSubPage('scores'); }}>
          <Text style={{ color: C.orange, fontSize: 13, padding: 4 }}>📊 Scores</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setSelectedAttr(attr); setSubPage('form'); }}>
          <Text style={{ color: C.blue, fontSize: 13, padding: 4 }}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteAttr(attr)}>
          <Text style={{ color: C.red, fontSize: 13, padding: 4 }}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.hamburger}>
          <Text style={{ fontSize: 22, color: C.textPrimary }}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>⚙️ Entity Attributes</Text>
          <Text style={styles.subtitle}>
            {filtered.length} shown • {attributes.filter(a => a.active === 'Y').length} active / {attributes.length} total
          </Text>
        </View>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.green }]} onPress={() => { setSelectedAttr(null); setSubPage('form'); }}>
          <Text style={styles.actionBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
        <TextInput style={styles.searchInput} placeholder="Search name, code, unit..."
          placeholderTextColor={C.textMuted} value={filter} onChangeText={setFilter} />
      </View>

      {/* Status chips */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 8, flexWrap: 'wrap' }}>
        {([{ label: 'All', v: 'all' as const }, { label: 'Active', v: 'Y' as const }, { label: 'Inactive', v: 'N' as const }]).map(f => (
          <TouchableOpacity key={f.v}
            style={[styles.chipBtn, filterActive === f.v && styles.chipBtnActive]}
            onPress={() => setFilterActive(f.v)}>
            <Text style={[styles.chipBtnText, filterActive === f.v && { color: C.blue, fontWeight: '600' }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.chipBtn, filterEntityType !== 'all' && styles.chipBtnActive]}
          onPress={() => setShowEntityTypePicker(true)}>
          <Text style={[styles.chipBtnText, filterEntityType !== 'all' && { color: C.blue, fontWeight: '600' }]}>
            {filterEntityType === 'all' ? 'All Types ▼' : `${getEntityTypeName(parseInt(filterEntityType))} ▼`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Attribute List */}
      {loading ? (
        <ActivityIndicator color={C.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.entityTypeAttributeId)}
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 8 }}
          ListEmptyComponent={<Text style={{ color: C.textMuted, textAlign: 'center', padding: 40 }}>No attributes found</Text>}
          renderItem={renderItem}
        />
      )}

      {/* Entity Type filter picker */}
      <Modal visible={showEntityTypePicker} transparent animationType="slide" onRequestClose={() => setShowEntityTypePicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Filter by Entity Type</Text>
              <TouchableOpacity onPress={() => setShowEntityTypePicker(false)}>
                <Text style={{ color: C.blue, fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.pickerItem} onPress={() => { setFilterEntityType('all'); setShowEntityTypePicker(false); }}>
              <Text style={[styles.pickerItemText, filterEntityType === 'all' && { color: C.blue, fontWeight: '600' }]}>All Types</Text>
            </TouchableOpacity>
            <FlatList
              data={etPickerItems}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => { setFilterEntityType(String(item.id)); setShowEntityTypePicker(false); }}>
                  <Text style={[styles.pickerItemText, filterEntityType === String(item.id) && { color: C.blue, fontWeight: '600' }]}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  hamburger: { width: 40, height: 40, borderRadius: 8, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  backBtn: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 8, paddingHorizontal: 12 },
  backBtnText: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
  searchInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, paddingHorizontal: 12, color: C.textPrimary, fontSize: 14 },
  card: { backgroundColor: C.card, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  fieldLabel: { fontSize: 13, color: C.textMuted, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, paddingHorizontal: 12, color: C.textPrimary, fontSize: 14 },
  actionBtn: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  chipBtn: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12 },
  chipBtnActive: { borderColor: C.blue, backgroundColor: C.blue + '22' },
  chipBtnText: { color: C.textMuted, fontSize: 12 },
  pickerButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12 },
  pickerButtonText: { color: C.textPrimary, fontSize: 14 },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerContainer: { backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60%', borderTopWidth: 1, borderTopColor: C.border },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  pickerItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerItemText: { color: C.textPrimary, fontSize: 15 },
});
