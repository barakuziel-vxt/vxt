import React, { useState, useEffect } from 'react';
import { pushNotificationAPI } from '../services/api';

export default function PushNotificationPage() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterEmail, setFilterEmail] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await pushNotificationAPI.getAll();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (setting) => {
    try {
      const newEnabled = setting.enabled === 'Y' ? 'N' : 'Y';
      await pushNotificationAPI.update(setting.userAppPushNotificationId, { enabled: newEnabled });
      await loadSettings();
    } catch (err) {
      setError(err.message);
    }
  };

  const getFiltered = () => {
    let filtered = settings;
    if (filterEmail) {
      filtered = filtered.filter((s) =>
        (s.email || '').toLowerCase().includes(filterEmail.toLowerCase()) ||
        (s.displayName || '').toLowerCase().includes(filterEmail.toLowerCase())
      );
    }
    if (filterEntity) {
      filtered = filtered.filter((s) =>
        (s.entityId || '').toLowerCase().includes(filterEntity.toLowerCase())
      );
    }
    if (filterEnabled) {
      filtered = filtered.filter((s) => s.enabled === filterEnabled);
    }
    return filtered;
  };

  return (
    <div className="page">
      <h2>Push Notification Settings</h2>
      <p className="page-subtitle">Manage push notification preferences for all users and devices</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ backgroundColor: '#252525', padding: '15px', borderRadius: '6px', marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px', minWidth: '160px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: 'var(--text-color)' }}>User</label>
          <input
            type="text"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            placeholder="Search email or name..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: '#353535', color: 'var(--text-color)' }}
          />
        </div>
        <div style={{ flex: '1 1 160px', minWidth: '160px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: 'var(--text-color)' }}>Entity ID</label>
          <input
            type="text"
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            placeholder="Search entity..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: '#353535', color: 'var(--text-color)' }}
          />
        </div>
        <div style={{ flex: '1 1 160px', minWidth: '160px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: 'var(--text-color)' }}>Enabled</label>
          <select
            value={filterEnabled}
            onChange={(e) => setFilterEnabled(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: '#353535', color: 'var(--text-color)' }}
          >
            <option value="">All</option>
            <option value="Y">Enabled</option>
            <option value="N">Disabled</option>
          </select>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={loadSettings} style={{ flexShrink: 0, alignSelf: 'flex-end' }}>
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><h3>Loading...</h3></div>
      ) : getFiltered().length === 0 ? (
        <div className="empty-state">
          <h3>{settings.length === 0 ? 'No push notification settings found' : 'No settings match the selected filter'}</h3>
          <p>{settings.length === 0 ? 'Push notification settings are created when users configure notifications on their devices' : 'Try adjusting your filters'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Entity</th>
                <th>Customer</th>
                <th>Platform</th>
                <th>Device</th>
                <th>Severity</th>
                <th>Channel</th>
                <th>Enabled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFiltered().map((s) => (
                <tr key={s.userAppPushNotificationId}>
                  <td>{s.userAppPushNotificationId}</td>
                  <td>
                    <div><strong>{s.displayName || '—'}</strong></div>
                    <div style={{ fontSize: '12px', color: '#999' }}>{s.email}</div>
                  </td>
                  <td><strong>{s.entityName || s.entityId || 'All Entities'}</strong></td>
                  <td>{s.customerName || '—'}</td>
                  <td>{s.platform || '—'}</td>
                  <td>{s.deviceModel || '—'}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
                      backgroundColor: s.minSeverity === 'CRITICAL' ? '#dc354522' : s.minSeverity === 'HIGH' ? '#fd7e1422' : '#28a74522',
                      color: s.minSeverity === 'CRITICAL' ? '#dc3545' : s.minSeverity === 'HIGH' ? '#fd7e14' : '#28a745',
                    }}>
                      {s.minSeverity || 'MEDIUM'}
                    </span>
                  </td>
                  <td>{s.deliveryChannel || 'fcm'}</td>
                  <td>
                    <span style={{ color: s.enabled === 'Y' ? '#28a745' : '#dc3545', fontWeight: '600' }}>
                      {s.enabled === 'Y' ? '✓ On' : '✗ Off'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleToggle(s)}>
                      {s.enabled === 'Y' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
