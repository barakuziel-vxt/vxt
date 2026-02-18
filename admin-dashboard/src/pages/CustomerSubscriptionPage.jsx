import React, { useState, useEffect } from 'react';
import { customerSubscriptionAPI, customerAPI, entityAPI, eventAPI } from '../services/api';

export default function CustomerSubscriptionPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [entities, setEntities] = useState([]);
  const [events, setEvents] = useState([]);
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
    eventId: '',
    subscriptionStartDate: new Date().toISOString().split('T')[0],
    subscriptionEndDate: '',
    active: 'Y',
  });

  useEffect(() => {
    loadCustomers();
    loadEntities();
    loadEvents();
    loadSubscriptions();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await customerAPI.getAll();
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  const loadEntities = async () => {
    try {
      const data = await entityAPI.getAll();
      setEntities(data);
    } catch (err) {
      console.error('Error loading entities:', err);
    }
  };

  const loadEvents = async () => {
    try {
      const data = await eventAPI.getAll();
      setEvents(data);
    } catch (err) {
      console.error('Error loading events:', err);
    }
  };

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const data = await customerSubscriptionAPI.getAll();
      setSubscriptions(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (subscription = null) => {
    if (subscription) {
      setEditingId(subscription.customerSubscriptionId);
      setFormData({
        customerId: subscription.customerId || '',
        entityId: subscription.entityId || '',
        eventId: subscription.eventId || '',
        subscriptionStartDate: subscription.subscriptionStartDate?.split('T')[0] || '',
        subscriptionEndDate: subscription.subscriptionEndDate?.split('T')[0] || '',
        active: subscription.active || 'Y',
      });
    } else {
      setEditingId(null);
      setFormData({
        customerId: '',
        entityId: '',
        eventId: '',
        subscriptionStartDate: new Date().toISOString().split('T')[0],
        subscriptionEndDate: '',
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
      eventId: '',
      subscriptionStartDate: new Date().toISOString().split('T')[0],
      subscriptionEndDate: '',
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
        await customerSubscriptionAPI.update(editingId, formData);
      } else {
        await customerSubscriptionAPI.create(formData);
      }
      await loadSubscriptions();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this subscription?')) {
      try {
        await customerSubscriptionAPI.delete(id);
        await loadSubscriptions();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getFilteredSubscriptions = () => {
    let filtered = subscriptions;
    
    if (filterCustomer) {
      filtered = filtered.filter((s) => {
        const customer = customers.find((c) => c.customerId === s.customerId);
        return customer?.customerName.toLowerCase().includes(filterCustomer.toLowerCase());
      });
    }
    if (filterEntity) {
      filtered = filtered.filter((s) =>
        s.entityId.toLowerCase().includes(filterEntity.toLowerCase())
      );
    }
    if (filterStatus) {
      filtered = filtered.filter((s) => s.active === filterStatus);
    }
    
    return filtered;
  };

  return (
    <div className="page">
      <h2>Customer Subscription Management</h2>
      <p className="page-subtitle">Manage customer subscriptions to entities and events</p>

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
      ) : getFilteredSubscriptions().length === 0 ? (
        <div className="empty-state">
          <h3>{subscriptions.length === 0 ? 'No subscriptions found' : 'No subscriptions match the selected filter'}</h3>
          <p>{subscriptions.length === 0 ? 'Create your first customer subscription' : 'Try adjusting your filters'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Entity ID</th>
                <th>Event</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredSubscriptions().map((subscription) => {
                const customer = customers.find((c) => c.customerId === subscription.customerId);
                const event = events.find((e) => e.eventId === subscription.eventId);
                return (
                  <tr key={subscription.customerSubscriptionId}>
                    <td>{subscription.customerSubscriptionId}</td>
                    <td>
                      <span>{customer?.customerName || 'Unknown'}</span>
                    </td>
                    <td>
                      <strong>{subscription.entityId}</strong>
                    </td>
                    <td>
                      <span>{event?.eventCode || '—'}</span>
                    </td>
                    <td>
                      <span>{subscription.subscriptionStartDate?.split('T')[0] || '—'}</span>
                    </td>
                    <td>
                      <span>{subscription.subscriptionEndDate?.split('T')[0] || '—'}</span>
                    </td>
                    <td>
                      <span>
                        {subscription.active === 'Y' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleOpenModal(subscription)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleDelete(subscription.customerSubscriptionId)}
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
              <h3>{editingId ? 'Edit Customer Subscription' : 'Add New Customer Subscription'}</h3>
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
                <input
                  type="text"
                  id="entityId"
                  name="entityId"
                  value={formData.entityId}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., 234567890"
                />
              </div>

              <div className="form-group">
                <label htmlFor="eventId">Event</label>
                <select
                  id="eventId"
                  name="eventId"
                  value={formData.eventId}
                  onChange={handleInputChange}
                >
                  <option value="">Select an event (optional)</option>
                  {events.map((event) => (
                    <option key={event.eventId} value={event.eventId}>
                      {event.eventCode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="subscriptionStartDate">Start Date *</label>
                  <input
                    type="date"
                    id="subscriptionStartDate"
                    name="subscriptionStartDate"
                    value={formData.subscriptionStartDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subscriptionEndDate">End Date</label>
                  <input
                    type="date"
                    id="subscriptionEndDate"
                    name="subscriptionEndDate"
                    value={formData.subscriptionEndDate}
                    onChange={handleInputChange}
                  />
                </div>
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
                  {editingId ? 'Update' : 'Create'} Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
