import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Modal, FlatList, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { DrawerContext } from '../context/DrawerContext';
import { loadDataSource } from '../hooks/useDataSource';
import { useGatewayStore } from '../store/gatewayStore';

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

interface Entity {
  entityId: number | string;
  entityFirstName: string;
  entityLastName?: string;
  entityTypeId: number;
  entityTypeName?: string;
}

interface Attribute {
  entityTypeAttributeId: number;
  entityTypeId: number;
  entityTypeAttributeCode: string;
  entityTypeAttributeName: string;
  entityTypeAttributeUnit: string | null;
  active: string;
}

interface ReportHistoryItem {
  entityName: string;
  attributeName: string;
  value: number;
  unit: string;
  timestamp: string;
  status: 'success' | 'error';
  message: string;
}

export default function ReportManuallyScreen() {
  const { openDrawer } = useContext(DrawerContext);
  const { config: gatewayConfig } = useGatewayStore();
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(true);

  // Data
  const [entities, setEntities] = useState<Entity[]>([]);
  const [allAttributes, setAllAttributes] = useState<Attribute[]>([]);
  const [filteredAttrs, setFilteredAttrs] = useState<Attribute[]>([]);

  // Form state
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedAttr, setSelectedAttr] = useState<Attribute | null>(null);
  const [value, setValue] = useState('');
  const [timestamp, setTimestamp] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}T${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  });
  const [submitting, setSubmitting] = useState(false);

  // Picker visibility
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [showAttrPicker, setShowAttrPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');
  const [attrSearch, setAttrSearch] = useState('');

  // Date picker state
  const years = useMemo(() => {
    const arr: string[] = [];
    for (let y = 2020; y <= 2035; y++) arr.push(String(y));
    return arr;
  }, []);
  const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const [pickYear, setPickYear] = useState(String(new Date().getFullYear()));
  const [pickMonth, setPickMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [pickDay, setPickDay] = useState(String(new Date().getDate()).padStart(2, '0'));
  const [pickHour, setPickHour] = useState(String(new Date().getHours()).padStart(2, '0'));
  const [pickMinute, setPickMinute] = useState(String(new Date().getMinutes()).padStart(2, '0'));

  const daysInMonth = useMemo(() => {
    const m = parseInt(pickMonth || '1', 10);
    const y = parseInt(pickYear || '2026', 10);
    const count = new Date(y, m, 0).getDate();
    const arr: string[] = [];
    for (let d = 1; d <= count; d++) arr.push(String(d).padStart(2, '0'));
    return arr;
  }, [pickYear, pickMonth]);

  const hours = useMemo(() => {
    const arr: string[] = [];
    for (let h = 0; h < 24; h++) arr.push(String(h).padStart(2, '0'));
    return arr;
  }, []);

  const minutes = useMemo(() => {
    const arr: string[] = [];
    for (let m = 0; m < 60; m += 5) arr.push(String(m).padStart(2, '0'));
    return arr;
  }, []);

  // Report history (session only)
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);

  // Load base URL
  useEffect(() => {
    (async () => {
      const ds = await loadDataSource();
      setBaseUrl(ds.baseUrl);
    })();
  }, []);

  // Load entities + attributes
  const fetchData = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true);
    try {
      const userEmail = auth().currentUser?.email || '';
      const emailParam = userEmail ? `?email=${encodeURIComponent(userEmail)}` : '';
      const [entRes, attrRes] = await Promise.all([
        fetch(`${baseUrl}/entities${emailParam}`),
        fetch(`${baseUrl}/entitytypeattributes`),
      ]);
      if (entRes.ok) setEntities(await entRes.json());
      if (attrRes.ok) setAllAttributes(await attrRes.json());
    } catch (e: any) {
      Alert.alert('Error', `Failed to load data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => { if (baseUrl) fetchData(); }, [baseUrl, fetchData]);

  // Filter attributes when entity changes
  useEffect(() => {
    if (!selectedEntity) {
      setFilteredAttrs([]);
      setSelectedAttr(null);
      return;
    }
    const filtered = allAttributes.filter(
      a => a.entityTypeId === selectedEntity.entityTypeId && a.active !== 'N',
    );
    setFilteredAttrs(filtered);
    setSelectedAttr(null);
  }, [selectedEntity, allAttributes]);

  const entityName = (e: Entity) =>
    `${e.entityFirstName || ''}${e.entityLastName ? ' ' + e.entityLastName : ''}`.trim() || String(e.entityId);

  // Submit report
  const handleSubmit = async () => {
    if (!selectedEntity || !selectedAttr || value === '') {
      Alert.alert('Validation', 'Please select Entity, Attribute, and enter a Value.');
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      Alert.alert('Validation', 'Value must be a number.');
      return;
    }

    setSubmitting(true);
    const eName = entityName(selectedEntity);
    try {
      // Treat picker-shown time as UTC (no timezone conversion) — same as admin-dashboard PC behavior
      const tsNormalized = timestamp.length === 16 ? timestamp + ':00.000Z' : timestamp;
      const payload: any = {
        entityId: selectedEntity.entityId,
        entityTypeAttributeCode: selectedAttr.entityTypeAttributeCode,
        entityTypeAttributeId: selectedAttr.entityTypeAttributeId,
        value: numValue,
        timestamp: tsNormalized,
        source: 'Manual',
        gatewayType: 'direct',  // Always direct DB insert for manual reports (no Kafka)
      };

      const res = await fetch(`${baseUrl}/api/manual-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`);

      const historyItem: ReportHistoryItem = {
        entityName: eName,
        attributeName: selectedAttr.entityTypeAttributeName,
        value: numValue,
        unit: selectedAttr.entityTypeAttributeUnit || '',
        timestamp,
        status: 'success',
        message: 'Report submitted',
      };
      setHistory(prev => [historyItem, ...prev]);
      setValue('');
      const n2 = new Date();
      setTimestamp(`${n2.getFullYear()}-${String(n2.getMonth()+1).padStart(2,'0')}-${String(n2.getDate()).padStart(2,'0')}T${String(n2.getHours()).padStart(2,'0')}:${String(n2.getMinutes()).padStart(2,'0')}`);
      Alert.alert('Success', `Report submitted for ${eName} — ${selectedAttr.entityTypeAttributeName}: ${numValue}`);
    } catch (e: any) {
      const historyItem: ReportHistoryItem = {
        entityName: eName,
        attributeName: selectedAttr.entityTypeAttributeName,
        value: numValue,
        unit: selectedAttr.entityTypeAttributeUnit || '',
        timestamp,
        status: 'error',
        message: e.message,
      };
      setHistory(prev => [historyItem, ...prev]);
      Alert.alert('Error', `Submission failed: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = selectedEntity && selectedAttr && value !== '' && !submitting;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>📝 Report Manually</Text>
          <Text style={styles.subtitle}>Submit telemetry measurements</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            {/* Form Card */}
            <View style={styles.formCard}>
              {/* Entity selector */}
              <Text style={styles.fieldLabel}>Entity</Text>
              <TouchableOpacity
                style={styles.dropdownBtn}
                onPress={() => { setEntitySearch(''); setShowEntityPicker(true); }}
              >
                <Text style={styles.dropdownBtnText}>
                  {selectedEntity ? `${entityName(selectedEntity)} (${selectedEntity.entityId})` : 'Select Entity...'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>

              {/* Attribute selector */}
              <Text style={styles.fieldLabel}>Attribute</Text>
              <TouchableOpacity
                style={[styles.dropdownBtn, !selectedEntity && styles.dropdownDisabled]}
                onPress={() => {
                  if (!selectedEntity) {
                    Alert.alert('Info', 'Select an Entity first');
                    return;
                  }
                  setAttrSearch('');
                  setShowAttrPicker(true);
                }}
              >
                <Text style={styles.dropdownBtnText}>
                  {selectedAttr
                    ? `${selectedAttr.entityTypeAttributeName} (${selectedAttr.entityTypeAttributeCode})`
                    : selectedEntity ? 'Select Attribute...' : '— Select Entity first —'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>

              {/* Unit (read-only) */}
              {selectedAttr && (
                <View style={styles.unitRow}>
                  <Text style={styles.unitLabel}>Unit:</Text>
                  <Text style={styles.unitValue}>
                    {selectedAttr.entityTypeAttributeUnit || '—'}
                  </Text>
                </View>
              )}

              {/* Value */}
              <Text style={styles.fieldLabel}>
                Measurement Value
                {selectedAttr?.entityTypeAttributeUnit ? ` (${selectedAttr.entityTypeAttributeUnit})` : ''}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter numeric value"
                placeholderTextColor={C.textMuted}
                value={value}
                onChangeText={setValue}
                keyboardType="numeric"
                editable={!submitting}
              />

              {/* Timestamp */}
              <Text style={styles.fieldLabel}>Measurement Timestamp</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => {
                const d = new Date(timestamp || Date.now());
                setPickYear(String(d.getFullYear()));
                setPickMonth(String(d.getMonth() + 1).padStart(2, '0'));
                setPickDay(String(d.getDate()).padStart(2, '0'));
                setPickHour(String(d.getHours()).padStart(2, '0'));
                setPickMinute(String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, '0'));
                setShowDatePicker(true);
              }}>
                <Text style={styles.dropdownBtnText}>
                  {timestamp ? new Date(timestamp).toLocaleString() : 'Select timestamp...'}
                </Text>
                <Text style={styles.dropdownArrow}>📅</Text>
              </TouchableOpacity>

              {/* Gateway info */}
              <View style={styles.gatewayInfo}>
                <Text style={styles.gatewayLabel}>
                  Gateway: {gatewayConfig?.gatewayType === 'kafka' ? '📡 Kafka' : '☁️ Azure IoT Hub'}
                </Text>
              </View>

              {/* Submit button */}
              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>📤 Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Report history */}
            {history.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.historyTitle}>Recent Reports</Text>
                {history.map((item, i) => (
                  <View key={i} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyEntity}>{item.entityName}</Text>
                        <Text style={styles.historyAttr}>{item.attributeName}</Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: item.status === 'success' ? C.green + '22' : C.red + '22' },
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { color: item.status === 'success' ? C.green : C.red },
                        ]}>
                          {item.status === 'success' ? '✓ Sent' : '✗ Failed'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.historyCardFooter}>
                      <Text style={styles.historyValue}>
                        {item.value} {item.unit}
                      </Text>
                      <Text style={styles.historyTime}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

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
                entityName(e).toLowerCase().includes(entitySearch.toLowerCase()) ||
                String(e.entityId).includes(entitySearch)
              )}
              keyExtractor={item => String(item.entityId)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, selectedEntity?.entityId === item.entityId && styles.pickerItemActive]}
                  onPress={() => { setSelectedEntity(item); setShowEntityPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, selectedEntity?.entityId === item.entityId && styles.pickerItemTextActive]}>
                    {entityName(item)}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>
                    {item.entityTypeName || `Type ${item.entityTypeId}`} • ID: {item.entityId}
                  </Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
              ListEmptyComponent={
                <Text style={{ color: C.textMuted, padding: 16, textAlign: 'center' }}>No entities found</Text>
              }
            />
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowEntityPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Attribute Picker Modal */}
      <Modal visible={showAttrPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Attribute</Text>
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              placeholder="Search attributes..."
              placeholderTextColor={C.textMuted}
              value={attrSearch}
              onChangeText={setAttrSearch}
              autoFocus
            />
            <FlatList
              data={filteredAttrs.filter(a =>
                a.entityTypeAttributeName.toLowerCase().includes(attrSearch.toLowerCase()) ||
                a.entityTypeAttributeCode.toLowerCase().includes(attrSearch.toLowerCase())
              )}
              keyExtractor={item => String(item.entityTypeAttributeId)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, selectedAttr?.entityTypeAttributeId === item.entityTypeAttributeId && styles.pickerItemActive]}
                  onPress={() => { setSelectedAttr(item); setShowAttrPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, selectedAttr?.entityTypeAttributeId === item.entityTypeAttributeId && styles.pickerItemTextActive]}>
                    {item.entityTypeAttributeName}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>
                    {item.entityTypeAttributeCode}{item.entityTypeAttributeUnit ? ` • ${item.entityTypeAttributeUnit}` : ''}
                  </Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
              ListEmptyComponent={
                <Text style={{ color: C.textMuted, padding: 16, textAlign: 'center' }}>
                  {selectedEntity ? 'No attributes for this entity type' : 'Select an entity first'}
                </Text>
              }
            />
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowAttrPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date/Time Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Date & Time</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ flex: 1.2 }}>
                <Text style={styles.dateColLabel}>Year</Text>
                <ScrollView style={{ maxHeight: 180 }}>
                  {years.map(y => (
                    <TouchableOpacity key={y} style={[styles.pickerItem, pickYear === y && styles.pickerItemActive]}
                      onPress={() => setPickYear(y)}>
                      <Text style={[styles.pickerItemText, pickYear === y && styles.pickerItemTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 0.8 }}>
                <Text style={styles.dateColLabel}>Month</Text>
                <ScrollView style={{ maxHeight: 180 }}>
                  {months.map(m => (
                    <TouchableOpacity key={m} style={[styles.pickerItem, pickMonth === m && styles.pickerItemActive]}
                      onPress={() => setPickMonth(m)}>
                      <Text style={[styles.pickerItemText, pickMonth === m && styles.pickerItemTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 0.8 }}>
                <Text style={styles.dateColLabel}>Day</Text>
                <ScrollView style={{ maxHeight: 180 }}>
                  {daysInMonth.map(d => (
                    <TouchableOpacity key={d} style={[styles.pickerItem, pickDay === d && styles.pickerItemActive]}
                      onPress={() => setPickDay(d)}>
                      <Text style={[styles.pickerItemText, pickDay === d && styles.pickerItemTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 0.8 }}>
                <Text style={styles.dateColLabel}>Hour</Text>
                <ScrollView style={{ maxHeight: 180 }}>
                  {hours.map(h => (
                    <TouchableOpacity key={h} style={[styles.pickerItem, pickHour === h && styles.pickerItemActive]}
                      onPress={() => setPickHour(h)}>
                      <Text style={[styles.pickerItemText, pickHour === h && styles.pickerItemTextActive]}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flex: 0.8 }}>
                <Text style={styles.dateColLabel}>Min</Text>
                <ScrollView style={{ maxHeight: 180 }}>
                  {minutes.map(m => (
                    <TouchableOpacity key={m} style={[styles.pickerItem, pickMinute === m && styles.pickerItemActive]}
                      onPress={() => setPickMinute(m)}>
                      <Text style={[styles.pickerItemText, pickMinute === m && styles.pickerItemTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={[styles.pickerCancel, { flex: 1 }]} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerCancel, { flex: 1 }]}
                onPress={() => {
                  const nw = new Date();
                  setTimestamp(`${nw.getFullYear()}-${String(nw.getMonth()+1).padStart(2,'0')}-${String(nw.getDate()).padStart(2,'0')}T${String(nw.getHours()).padStart(2,'0')}:${String(nw.getMinutes()).padStart(2,'0')}`);
                  setShowDatePicker(false);
                }}>
                <Text style={styles.pickerCancelText}>Now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerCancel, { flex: 1, backgroundColor: C.blue }]}
                onPress={() => {
                  setTimestamp(`${pickYear}-${pickMonth}-${pickDay}T${pickHour}:${pickMinute}`);
                  setShowDatePicker(false);
                }}>
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
  // Form
  formCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    padding: 16,
  },
  fieldLabel: { fontSize: 13, color: C.textMuted, marginTop: 14, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 12, color: C.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: C.border,
  },
  unitRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 6,
    paddingHorizontal: 4,
  },
  unitLabel: { fontSize: 13, color: C.textMuted, marginRight: 6 },
  unitValue: { fontSize: 13, color: C.blue, fontWeight: '600' },
  gatewayInfo: {
    marginTop: 14, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border,
  },
  gatewayLabel: { fontSize: 12, color: C.textMuted },
  submitBtn: {
    marginTop: 18, paddingVertical: 14, borderRadius: 10,
    backgroundColor: C.green, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // Dropdown
  dropdownBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 12, borderWidth: 1, borderColor: C.border,
  },
  dropdownDisabled: { opacity: 0.5 },
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
  // History
  historyTitle: {
    fontSize: 16, fontWeight: '700', color: C.textPrimary,
    paddingHorizontal: 16, marginTop: 8, marginBottom: 8,
  },
  historyCard: {
    marginHorizontal: 16, marginBottom: 8, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  historyCardHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
  },
  historyEntity: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
  historyAttr: { fontSize: 13, color: C.green, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  historyCardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  historyValue: { fontSize: 14, fontWeight: '600', color: C.blue },
  historyTime: { fontSize: 12, color: C.textMuted },
});
