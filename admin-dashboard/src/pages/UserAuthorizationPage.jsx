import React, { useState, useEffect } from 'react';
import { userAuthorizationAPI } from '../services/api';

export default function UserAuthorizationPage() {
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterEmail, setFilterEmail] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    loadAuthorizations();
  }, []);

  const loadAuthorizations = async () => {
    setLoading(true);
    try {
      const data = await userAuthorizationAPI.getAll();
      setAuthorizations(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (authId, newRole) => {
    try {
      await userAuthorizationAPI.update(authId, { role: newRole });
      await loadAuthorizations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (auth) => {
    try {
      const newActive = auth.active === 'Y' ? 'N' : 'Y';
      await userAuthorizationAPI.update(auth.userAuthorizationId, { active: newActive });
      await loadAuthorizations();
    } catch (err) {
      setError(err.message);
    }
  };

  const getFiltered = () => {
    let filtered = authorizations;
    if (filterEmail) {
      filtered = filtered.filter((a) =>
        (a.email || '').toLowerCase().includes(filterEmail.toLowerCase()) ||
        (a.displayName || '').toLowerCase().includes(filterEmail.toLowerCase())
      );
    }
    if (filterRole) {
      filtered = filtered.filter((a) => a.role === filterRole);
    }
    if (filterStatus) {
      filtered = filtered.filter((a) => a.active === filterStatus);
    }
    return filtered;
  };

  return (
    <div className="page">
      <h2>User Authorizations</h2>
      <p className="page-subtitle">Manage user access roles for customer subscriptions</p>

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
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: 'var(--text-color)' }}>Role</label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: '#353535', color: 'var(--text-color)' }}
          >
            <option value="">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <div style={{ flex: '1 1 160px', minWidth: '160px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: 'var(--text-color)' }}>Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: '#353535', color: 'var(--text-color)' }}
          >
            <option value="">All</option>
            <option value="Y">Active</option>
            <option value="N">Inactive</option>
          </select>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={loadAuthorizations} style={{ flexShrink: 0, alignSelf: 'flex-end' }}>
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><h3>Loading...</h3></div>
      ) : getFiltered().length === 0 ? (
        <div className="empty-state">
          <h3>{authorizations.length === 0 ? 'No user authorizations found' : 'No authorizations match the selected filter'}</h3>
          <p>{authorizations.length === 0 ? 'User authorizations are created when users are invited to subscriptions' : 'Try adjusting your filters'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Customer</th>
                <th>Entity ID</th>
                <th>Event</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFiltered().map((a) => (
                <tr key={a.userAuthorizationId}>
                  <td>{a.userAuthorizationId}</td>
                  <td>
                    <div><strong>{a.displayName || '—'}</strong></div>
                    <div style={{ fontSize: '12px', color: '#999' }}>{a.email}</div>
                  </td>
                  <td>{a.customerName || '—'}</td>
                  <td><strong>{a.entityId}</strong></td>
                  <td>{a.eventCode || '—'}</td>
                  <td>
                    <select
                      value={a.role}
                      onChange={(e) => handleUpdateRole(a.userAuthorizationId, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px', backgroundColor: '#353535', color: 'var(--text-color)' }}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  </td>
                  <td>
                    <span style={{ color: a.active === 'Y' ? '#28a745' : '#dc3545', fontWeight: '600' }}>
                      {a.active === 'Y' ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{a.createDate?.split('T')[0] || '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleToggleActive(a)}>
                      {a.active === 'Y' ? 'Deactivate' : 'Activate'}
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
