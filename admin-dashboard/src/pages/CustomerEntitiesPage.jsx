import React, { useState, useEffect } from 'react';
import { customerEntityAPI, customerAPI, entityAPI } from '../services/api';

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
  const [formData, setFormData] = useState({
    customerId: '',
    entityId: '',
    active: 'Y',
  });

  useEffect(() => {
    loadCustomers();
    loadAllEntities();
    loadCustomerEntities();
  }, []);

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
      const data = await customerEntityAPI.getAll();
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
    if (filterStatus) {
      filtered = filtered.filter((e) => e.active === filterStatus);
    }
    
    return filtered;
  };

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

        <button className="btn btn-sm btn-secondary" onClick={() => handleOpenModal()} style={{ marginLeft: 'auto', flexShrink: 0, alignSelf: 'flex-end' }}>
          + Add New
        </button>
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
                        onClick={() => handleOpenModal(entity)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
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

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Update' : 'Create'} Entity Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
