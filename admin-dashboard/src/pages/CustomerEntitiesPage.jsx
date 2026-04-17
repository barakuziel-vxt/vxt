import React, { useState, useEffect, useCallback } from 'react';
import { customerEntityAPI, customerAPI, entityAPI } from '../services/api';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const ROLES = ['viewer', 'admin', 'owner'];

/* ─── Invite User sub-page (bulk invite to customer entities) ──── */
function InviteUserView({ onBack }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [allEntities, setAllEntities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [entRes, custRes] = await Promise.all([
          fetch(`${BASE}/customerentities?status=Y`),
          fetch(`${BASE}/customers`),
        ]);
        if (entRes.ok) setAllEntities(await entRes.json());
        if (custRes.ok) setCustomers(await custRes.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filteredByCustomer = allEntities.filter(e => !selectedCustomerId || String(e.customerId) === String(selectedCustomerId));

  const filtered = filteredByCustomer.filter(e => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (e.customerName || '').toLowerCase().includes(q)
      || (e.entityName || e.entityId || '').toLowerCase().includes(q)
      || (e.entityId || '').toLowerCase().includes(q);
  });

  const toggleEntity = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(e => e.customerEntityId)));
  };

  // Derive customerId from selected entities
  const deriveCustomerId = () => {
    if (selectedCustomerId) return Number(selectedCustomerId);
    const firstSelected = allEntities.find(e => selected.has(e.customerEntityId));
    return firstSelected?.customerId || null;
  };

  const sendInvite = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { alert('Please enter an email address'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { alert('Please enter a valid email address'); return; }
    if (selected.size === 0) { alert('Please select at least one entity'); return; }
    const customerId = deriveCustomerId();
    if (!customerId) { alert('Could not determine customer. Please select a customer filter.'); return; }

    // Collect entityIds from selected customerEntityIds
    const entityIds = allEntities
      .filter(e => selected.has(e.customerEntityId))
      .map(e => e.entityId);

    setSending(true);
    try {
      const res = await fetch(`${BASE}/invite-bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, role, customerId, entityIds }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `HTTP ${res.status}`); }
      const result = await res.json();
      alert(`\u2705 ${result.message}\n\nThe user can now open the VXT app and sign in with ${trimmedEmail}.\nThey will receive a verification email on first login.`);
      onBack();
    } catch (e) { alert(e.message); }
    finally { setSending(false); }
  };

  const IS = {
    root: { background: '#0d1117', minHeight: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#e6edf3' },
    header: { display: 'flex', alignItems: 'center', padding: '14px 16px', background: '#161b22', borderBottom: '1px solid #30363d' },
    backBtn: { background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '8px 12px', color: '#e6edf3', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    fieldLabel: { display: 'block', fontSize: 13, fontWeight: 600, color: '#8b949e', marginTop: 12, marginBottom: 4 },
    input: { width: '100%', boxSizing: 'border-box', background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '10px 12px', color: '#e6edf3', fontSize: 14, outline: 'none' },
    select: { width: '100%', boxSizing: 'border-box', background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '10px 12px', color: '#e6edf3', fontSize: 14, outline: 'none' },
    saveBtn: { background: '#3fb950', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
    card: { background: '#161b22', borderRadius: 10, padding: '10px 14px', border: '1px solid #30363d' },
    loader: { color: '#388bfd', textAlign: 'center', padding: 40 },
    list: { padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 },
  };

  return (
    <div style={IS.root}>
      <div style={IS.header}>
        <button style={IS.backBtn} onClick={onBack}>← Back</button>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#e6edf3', marginLeft: 12 }}>📨 Invite User</div>
      </div>

      <div style={{ padding: '10px 16px', background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <label style={IS.fieldLabel}>Email Address</label>
        <input style={IS.input} placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} />

        <label style={{ ...IS.fieldLabel, marginTop: 12 }}>Role</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {ROLES.map(r => (
            <button key={r} style={{
              padding: '8px 14px', borderRadius: 16, border: '1px solid #30363d', background: '#0d1117',
              color: '#8b949e', fontSize: 13, cursor: 'pointer',
              ...(role === r ? { background: '#388bfd', borderColor: '#388bfd', color: '#fff', fontWeight: 600 } : {}),
            }} onClick={() => setRole(r)}>{r === 'viewer' ? '👁️ Viewer' : r === 'admin' ? '🔧 Admin' : '👑 Owner'}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '10px 16px', background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <label style={IS.fieldLabel}>Customer</label>
        <select style={IS.select} value={selectedCustomerId} onChange={e => { setSelectedCustomerId(e.target.value); setSelected(new Set()); }}>
          <option value="">All Customers</option>
          {customers.map(c => <option key={c.customerId} value={c.customerId}>{c.customerName}</option>)}
        </select>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: '#e6edf3', fontWeight: 600 }}>Select Entities ({selected.size}/{filtered.length})</span>
          <button style={{ background: 'none', border: 'none', color: '#388bfd', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={selectAll}>
            {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <input style={{ ...IS.input, marginBottom: 8 }} placeholder="Filter entities..." value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      {loading ? <div style={IS.loader}>Loading...</div> : (
        <div style={IS.list}>
          {filtered.map(e => {
            const isSel = selected.has(e.customerEntityId);
            return (
              <div key={e.customerEntityId}
                style={{ ...IS.card, cursor: 'pointer', ...(isSel ? { borderColor: '#3fb950', background: '#0d2818' } : {}) }}
                onClick={() => toggleEntity(e.customerEntityId)}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3' }}>{e.customerName || 'Customer ' + e.customerId}</div>
                    <div style={{ fontSize: 13, color: '#3fb950', marginTop: 2 }}>{e.entityName || e.entityId}</div>
                    {e.entityTypeCode && <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>Type: {e.entityTypeCode}</div>}
                  </div>
                  <input type="checkbox" checked={isSel} readOnly />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: '12px 16px', background: '#161b22', borderTop: '1px solid #30363d' }}>
        <button style={{
          ...IS.saveBtn, width: '100%', padding: 14, fontSize: 15,
          ...(!email.trim() || selected.size === 0 ? { background: '#30363d', opacity: 0.6 } : {}),
        }} onClick={sendInvite} disabled={sending || !email.trim() || selected.size === 0}>
          {sending ? 'Sending...' : `📨 Invite ${email.trim() ? email.trim().split('@')[0] : 'User'} to ${selected.size} entit${selected.size !== 1 ? 'ies' : 'y'}`}
        </button>
      </div>
    </div>
  );
}

export default function CustomerEntitiesPage() {
  const [entities, setEntities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [allEntities, setAllEntities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [subPage, setSubPage] = useState('list');
  const [formData, setFormData] = useState({
    customerId: '',
    entityId: '',
    active: 'Y',
  });
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  useEffect(() => {
    loadCustomers();
    loadAllEntities();
    loadCustomerEntities();
  }, []);

  useEffect(() => {
    loadCustomerEntities();
  }, [filterStatus]);

  const loadCustomers = async () => {
    try {
      const data = await customerAPI.getAll();
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  const loadAllEntities = async () => {
    try {
      const data = await entityAPI.getAll();
      setAllEntities(data);
    } catch (err) {
      console.error('Error loading entities:', err);
    }
  };

  const loadCustomerEntities = async () => {
    setLoading(true);
    try {
      const data = await customerEntityAPI.getAll(filterStatus);
      setEntities(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (entity = null) => {
    if (entity) {
      setEditingId(entity.customerEntityId);
      setFormData({
        customerId: entity.customerId || '',
        entityId: entity.entityId || '',
        active: entity.active || 'Y',
      });
    } else {
      setEditingId(null);
      setFormData({
        customerId: '',
        entityId: '',
        active: 'Y',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      customerId: '',
      entityId: '',
      iotDeviceId: '',
      active: 'Y',
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await customerEntityAPI.update(editingId, formData);
      } else {
        await customerEntityAPI.create(formData);
      }
      await loadCustomerEntities();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer entity assignment?')) {
      try {
        await customerEntityAPI.delete(id);
        await loadCustomerEntities();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleSyncSetup = async () => {
    if (!editingId) {
      setSyncMessage({ type: 'error', text: 'No entity selected' });
      return;
    }

    setSyncLoading(true);
    setSyncMessage(null);
    
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${baseUrl}/customerentities/${editingId}/sync-setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_name: 'N2KToSignalK' // Default provider; can be made dynamic if needed
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Sync failed with status ${response.status}`);
      }

      const result = await response.json();
      setSyncMessage({ 
        type: 'success', 
        text: `✓ Successfully synced setup for entity ${formData.entityId}` 
      });
    } catch (err) {
      setSyncMessage({ 
        type: 'error', 
        text: `Failed to sync: ${err.message}` 
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const getFilteredEntities = () => {
    let filtered = entities;
    
    if (filterCustomer) {
      filtered = filtered.filter((e) => {
        const customer = customers.find((c) => c.customerId === e.customerId);
        return customer?.customerName.toLowerCase().includes(filterCustomer.toLowerCase());
      });
    }
    if (filterEntity) {
      filtered = filtered.filter((e) =>
        e.entityId.toLowerCase().includes(filterEntity.toLowerCase())
      );
    }
    
    return filtered;
  };

  if (subPage === 'inviteUser') {
    return <InviteUserView onBack={() => { setSubPage('list'); loadCustomerEntities(); }} />;
  }

  return (
    <div className="page">
      <h2>Customer Entities Management</h2>
      <p className="page-subtitle">Manage which entities (boats, people) belong to each customer</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ backgroundColor: '#252525', padding: '15px', borderRadius: '6px', marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end', flex: '1' }}>
          <div style={{ flex: '1 1 160px', minWidth: '160px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                fontSize: '14px',
                color: 'var(--text-color)',
              }}
            >
              Customer
            </label>
            <input
              type="text"
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              placeholder="Search customer..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                fontSize: '14px',
                backgroundColor: '#353535',
                color: 'var(--text-color)',
              }}
            />
          </div>

          <div style={{ flex: '1 1 160px', minWidth: '160px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                fontSize: '14px',
                color: 'var(--text-color)',
              }}
            >
              Entity ID
            </label>
            <input
              type="text"
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              placeholder="Search entity..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                fontSize: '14px',
                backgroundColor: '#353535',
                color: 'var(--text-color)',
              }}
            />
          </div>

          <div style={{ flex: '1 1 160px', minWidth: '160px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                fontSize: '14px',
                color: 'var(--text-color)',
              }}
            >
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                fontSize: '14px',
                backgroundColor: '#353535',
                color: 'var(--text-color)',
              }}
            >
              <option value="">All</option>
              <option value="Y">Active</option>
              <option value="N">Inactive</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', flexShrink: 0, alignSelf: 'flex-end' }}>
          <button className="btn btn-sm btn-primary" onClick={() => setSubPage('inviteUser')} style={{ backgroundColor: '#388bfd', borderColor: '#388bfd' }}>
            🔗 Invite User
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => handleOpenModal()}>
            + Add New
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <h3>Loading...</h3>
        </div>
      ) : getFilteredEntities().length === 0 ? (
        <div className="empty-state">
          <h3>{entities.length === 0 ? 'No customer entities found' : 'No customer entities match the selected filter'}</h3>
          <p>{entities.length === 0 ? 'Create your first customer entity assignment' : 'Try adjusting your filters'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Entity ID</th>
                <th>Entity Name</th>
                <th>Entity Type</th>
                <th>Status</th>
                <th>IoT</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredEntities().map((entity) => {
                const customer = customers.find((c) => c.customerId === entity.customerId);
                return (
                  <tr key={entity.customerEntityId}>
                    <td>{entity.customerEntityId}</td>
                    <td>
                      <span>{customer?.customerName || 'Unknown'}</span>
                    </td>
                    <td>
                      <strong>{entity.entityId}</strong>
                    </td>
                    <td>
                      <span>{entity.entityName || '—'}</span>
                    </td>
                    <td>
                      <span>{entity.entityTypeCode || '—'}</span>
                    </td>
                    <td>
                      <span>
                        {entity.active === 'Y' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}
                        onClick={() => window.dispatchEvent(new CustomEvent('vxt:navigate', { detail: { page: 'entityIoTDevice', data: { entityId: entity.entityId, entityName: entity.entityName || entity.entityId } } }))}
                      >
                        📡 IoT Devices
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleOpenModal(entity)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(entity.customerEntityId)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingId ? 'Edit Customer Entity' : 'Add New Customer Entity'}</h3>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="customerId">Customer *</label>
                <select
                  id="customerId"
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.customerName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="entityId">Entity ID *</label>
                <select
                  id="entityId"
                  name="entityId"
                  value={formData.entityId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select an entity</option>
                  {allEntities.map((entity) => (
                    <option key={entity.entityId} value={entity.entityId}>
                      {entity.entityName} ({entity.entityId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="active">Status</label>
                <select
                  id="active"
                  name="active"
                  value={formData.active}
                  onChange={handleInputChange}
                >
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </select>
              </div>

              {syncMessage && (
                <div style={{
                  padding: '12px',
                  marginBottom: '16px',
                  borderRadius: '4px',
                  backgroundColor: syncMessage.type === 'success' ? '#1e4d2b' : '#4d2222',
                  color: syncMessage.type === 'success' ? '#4ade80' : '#f87171',
                  border: `1px solid ${syncMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
                  fontSize: '13px'
                }}>
                  {syncMessage.text}
                </div>
              )}

              <div className="modal-footer" style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '16px'
              }}>
                <div style={{ flex: '1' }}>
                  {editingId && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSyncSetup}
                      disabled={syncLoading}
                      style={{
                        width: '100%',
                        backgroundColor: '#2563eb',
                        borderColor: '#2563eb',
                        fontWeight: '600'
                      }}
                    >
                      {syncLoading ? '⏳ Syncing Setup...' : '🚀 SYNC to Device'}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingId ? 'Update' : 'Create'} Entity Assignment
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
