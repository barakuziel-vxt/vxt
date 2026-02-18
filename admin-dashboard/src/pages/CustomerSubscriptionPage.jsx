import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './CustomerSubscriptionPage.css';

const CustomerSubscriptionPage = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [entities, setEntities] = useState([]);
  const [events, setEvents] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterEntityId, setFilterEntityId] = useState('');
  const [filterEventId, setFilterEventId] = useState('');
  
  const [formData, setFormData] = useState({
    customerId: '',
    entityId: '',
    eventId: '',
    subscriptionStartDate: new Date().toISOString().split('T')[0],
    subscriptionEndDate: '',
    active: 'Y'
  });

  // Load all data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subRes, custRes, entRes, evRes] = await Promise.all([
        api.get('/customersubscriptions'),
        api.get('/customers'),
        api.get('/entities'),
        api.get('/events')
      ]);
      setSubscriptions(subRes.data || []);
      setCustomers(custRes.data || []);
      setEntities(entRes.data || []);
      setEvents(evRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectEvent = async (eventId) => {
    try {
      const response = await api.get(`/events/${eventId}/details`);
      setSelectedEventDetails(response.data || response);
      setShowEventDetails(true);
    } catch (error) {
      console.error('Error loading event details:', error);
      alert('Failed to load event details');
    }
  };

  const handleOpenModal = (subscription = null) => {
    if (subscription) {
      setEditingId(subscription.customerSubscriptionId);
      setFormData({
        customerId: String(subscription.customerId || ''),
        entityId: String(subscription.entityId || ''),
        eventId: String(subscription.eventId || ''),
        subscriptionStartDate: subscription.subscriptionStartDate?.split('T')[0] || '',
        subscriptionEndDate: subscription.subscriptionEndDate?.split('T')[0] || '',
        active: subscription.active || 'Y'
      });
    } else {
      setEditingId(null);
      setFormData({
        customerId: '',
        entityId: '',
        eventId: '',
        subscriptionStartDate: new Date().toISOString().split('T')[0],
        subscriptionEndDate: '',
        active: 'Y'
      });
    }
    setShowEventDetails(false);
    setSelectedEventDetails(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.customerId || !formData.entityId || !formData.eventId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/customersubscriptions/${editingId}`, formData);
        alert('Subscription updated successfully');
      } else {
        await api.post('/customersubscriptions', formData);
        alert('Subscription created successfully');
      }
      handleCloseModal();
      loadData();
    } catch (error) {
      console.error('Error saving subscription:', error);
      alert(`Failed to save subscription: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subscription?')) {
      return;
    }

    try {
      await api.delete(`/customersubscriptions/${id}`);
      alert('Subscription deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting subscription:', error);
      alert(`Failed to delete subscription: ${error.response?.data?.detail || error.message}`);
    }
  };

  const getCustomerName = (id) => {
    const customer = customers.find(c => c.customerId === id);
    return customer ? customer.customerName : 'N/A';
  };

  const getEntityName = (id) => {
    const entity = entities.find(e => e.entityId === id);
    return entity ? entity.entityName : 'N/A';
  };

  const getEventCode = (id) => {
    const event = events.find(e => e.eventId === id);
    return event ? event.eventCode : 'N/A';
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (filterCustomerId && sub.customerId !== parseInt(filterCustomerId)) return false;
    if (filterEntityId && sub.entityId !== parseInt(filterEntityId)) return false;
    if (filterEventId && sub.eventId !== parseInt(filterEventId)) return false;
    return true;
  });

  return (
    <div className="customer-subscription-page">
      <div className="page-header">
        <h1>Customer Subscriptions</h1>
      </div>

      {/* Filters */}
      <div className="filter-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '15px', flex: '1', minWidth: '300px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label htmlFor="filterCustomer" style={{ whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-color)', fontSize: '13px' }}>Subscriber:</label>
            <select
              id="filterCustomer"
              value={filterCustomerId}
              onChange={(e) => setFilterCustomerId(e.target.value)}
              className="filter-select"
              style={{ minWidth: '150px' }}
            >
              <option value="">ALL</option>
              {customers.map(cust => (
                <option key={cust.customerId} value={cust.customerId}>
                  {cust.customerName}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label htmlFor="filterEntity" style={{ whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-color)', fontSize: '13px' }}>Entity:</label>
            <select
              id="filterEntity"
              value={filterEntityId}
              onChange={(e) => setFilterEntityId(e.target.value)}
              className="filter-select"
              style={{ minWidth: '150px' }}
            >
              <option value="">ALL</option>
              {entities.map(ent => (
                <option key={ent.entityId} value={ent.entityId}>
                  {ent.entityName || `${ent.entityFirstName} ${ent.entityLastName || ''}`.trim()}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label htmlFor="filterEvent" style={{ whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-color)', fontSize: '13px' }}>Event:</label>
            <select
              id="filterEvent"
              value={filterEventId}
              onChange={(e) => setFilterEventId(e.target.value)}
              className="filter-select"
              style={{ minWidth: '150px' }}
            >
              <option value="">ALL</option>
              {events.map(evt => (
                <option key={evt.eventId} value={evt.eventId}>
                  {evt.eventCode}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn-primary" onClick={() => handleOpenModal()} style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>
          + Add New Subscription
        </button>
      </div>

      {/* Subscriptions Table */}
      <div className="subscriptions-table">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Entity</th>
              <th>Event</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubscriptions.map(sub => (
              <tr key={sub.customerSubscriptionId}>
                <td>{sub.customerName}</td>
                <td>{sub.entityName} ({sub.entityId})</td>
                <td>
                  <button 
                    className="link-button"
                    onClick={() => handleSelectEvent(sub.eventId)}
                    title="Click to view event details"
                  >
                    {sub.eventCode}
                  </button>
                </td>
                <td>{sub.subscriptionStartDate?.split('T')[0]}</td>
                <td>{sub.subscriptionEndDate?.split('T')[0] || 'Never'}</td>
                <td>
                  <span className={`status ${sub.active === 'Y' ? 'active' : 'inactive'}`}>
                    {sub.active === 'Y' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button 
                    className="action-button edit-button"
                    onClick={() => handleOpenModal(sub)}
                    title="Edit subscription"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="action-button delete-button"
                    onClick={() => handleDelete(sub.customerSubscriptionId)}
                    title="Delete subscription"
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSubscriptions.length === 0 && (
          <div className="no-data">No subscriptions found</div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={handleCloseModal}>
          <div className="modal" style={{ zIndex: 1001 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Subscription' : 'Create New Subscription'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              {/* Customer Selection */}
              <div className="form-group">
                <label>Customer *</label>
                <select 
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a customer...</option>
                  {customers.map(cust => (
                    <option key={cust.customerId} value={String(cust.customerId)}>
                      {cust.customerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity Selection */}
              <div className="form-group">
                <label>Entity *</label>
                <select 
                  name="entityId"
                  value={formData.entityId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select an entity...</option>
                  {entities.map(ent => (
                    <option key={ent.entityId} value={String(ent.entityId)}>
                      {ent.entityName || `${ent.entityFirstName} ${ent.entityLastName || ''}`.trim()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Selection */}
              <div className="form-group">
                <label>Event *</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <select 
                    name="eventId"
                    value={String(formData.eventId || '')}
                    onChange={handleInputChange}
                    required
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <option value="">Select an event...</option>
                    {events.map(evt => (
                      <option key={`evt-${evt.eventId}`} value={String(evt.eventId)}>
                        {evt.eventDescription}
                      </option>
                    ))}
                  </select>
                  {formData.eventId && (
                    <button 
                      className="btn-view-details"
                      onClick={() => handleSelectEvent(parseInt(formData.eventId))}
                      type="button"
                    >
                      View Details
                    </button>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input 
                    type="date"
                    name="subscriptionStartDate"
                    value={formData.subscriptionStartDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input 
                    type="date"
                    name="subscriptionEndDate"
                    value={formData.subscriptionEndDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Active Status */}
              <div className="form-group">
                <label>Status</label>
                <select 
                  name="active"
                  value={formData.active}
                  onChange={handleInputChange}
                >
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </select>
              </div>


            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSave}>
                {editingId ? 'Update' : 'Create'} Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Event Details Modal */}
      {showEventDetails && selectedEventDetails && (
        <div className="modal-backdrop" style={{ zIndex: 2000 }} onClick={() => setShowEventDetails(false)}>
          <div className="modal" style={{ zIndex: 2001 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Event Details: {selectedEventDetails.eventCode}</h2>
              <button className="close-btn" onClick={() => setShowEventDetails(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="details-group">
                <h4>Description</h4>
                <p>{selectedEventDetails.eventDescription}</p>
              </div>

              {/* Analysis Function */}
              {selectedEventDetails.functionName && (
                <div className="details-group">
                  <h4>Analysis Function</h4>
                  <div className="function-info">
                    <div className="function-name">
                      <strong>Function:</strong> {selectedEventDetails.functionName}
                    </div>
                    <div className="function-type">
                      <strong>Type:</strong> {selectedEventDetails.functionType}
                    </div>
                    {selectedEventDetails.functionDescription && (
                      <div className="function-description">
                        <strong>Description:</strong>
                        <p>{selectedEventDetails.functionDescription}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Event Parameters */}
              <div className="details-group">
                <h4>Event Parameters</h4>
                <div className="parameters-grid">
                  <div className="param">
                    <strong>Min Score:</strong> {selectedEventDetails.minCumulatedScore}
                  </div>
                  <div className="param">
                    <strong>Max Score:</strong> {selectedEventDetails.maxCumulatedScore}
                  </div>
                  <div className="param">
                    <strong>Risk Level:</strong> {selectedEventDetails.risk}
                  </div>
                  <div className="param">
                    <strong>Lookback Minutes:</strong> {selectedEventDetails.LookbackMinutes}
                  </div>
                  <div className="param">
                    <strong>Baseline Days:</strong> {selectedEventDetails.BaselineDays}
                  </div>
                  <div className="param">
                    <strong>Sensitivity:</strong> {selectedEventDetails.SensitivityThreshold}
                  </div>
                  <div className="param">
                    <strong>Min Samples:</strong> {selectedEventDetails.MinSamplesRequired}
                  </div>
                </div>
              </div>

              {/* Attributes */}
              {selectedEventDetails.attributes && selectedEventDetails.attributes.length > 0 && (
                <div className="details-group">
                  <h4>Associated Attributes ({selectedEventDetails.attributes.length})</h4>
                  <div className="attributes-list">
                    {selectedEventDetails.attributes.map(attr => (
                      <div key={attr.eventAttributeId} className="attribute-item">
                        <div className="attr-header">
                          <strong>{attr.attributeName}</strong>
                          <span className="attr-code">{attr.attributeCode}</span>
                        </div>
                        {attr.attributeDescription && (
                          <div className="attr-description">
                            {attr.attributeDescription}
                          </div>
                        )}
                        <div className="attr-meta">
                          {attr.timeAspect && <span>Time Aspect: {attr.timeAspect}</span>}
                          {attr.unit && <span>Unit: {attr.unit}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEventDetails(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSubscriptionPage;
