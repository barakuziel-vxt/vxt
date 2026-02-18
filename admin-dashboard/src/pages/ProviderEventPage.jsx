import React, { useState, useEffect } from 'react';
import { providerEventAPI, providerAPI } from '../services/api';

export default function ProviderEventPage() {
  const [events, setEvents] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterProvider, setFilterProvider] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [formData, setFormData] = useState({
    providerId: '',
    eventName: '',
    eventDescription: '',
    active: 'Y',
  });

  useEffect(() => {
    loadProviders();
    loadEvents();
  }, []);

  const loadProviders = async () => {
    try {
      const data = await providerAPI.getAll();
      setProviders(data);
    } catch (err) {
      console.error('Error loading providers:', err);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await providerEventAPI.getAll();
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (event = null) => {
    if (event) {
      setEditingId(event.providerEventId);
      setFormData({
        providerId: event.providerId || '',
        eventName: event.eventName,
        eventDescription: event.eventDescription || '',
        active: event.active || 'Y',
      });
    } else {
      setEditingId(null);
      setFormData({
        providerId: '',
        eventName: '',
        eventDescription: '',
        active: 'Y',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      providerId: '',
      eventName: '',
      eventDescription: '',
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
        await providerEventAPI.update(editingId, formData);
      } else {
        await providerEventAPI.create(formData);
      }
      await loadEvents();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this provider event?')) {
      try {
        await providerEventAPI.delete(id);
        await loadEvents();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getFilteredEvents = () => {
    let filtered = events;
    
    if (filterProvider) {
      filtered = filtered.filter((e) => {
        const provider = providers.find((p) => p.providerId === e.providerId);
        return provider?.providerName.toLowerCase().includes(filterProvider.toLowerCase());
      });
    }
    if (filterEvent) {
      filtered = filtered.filter((e) =>
        e.eventName.toLowerCase().includes(filterEvent.toLowerCase())
      );
    }
    
    return filtered;
  };

  return (
    <div className="page">
      <h2>Provider Event Management</h2>
      <p className="page-subtitle">Manage data events from telemetry providers</p>

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
              Provider
            </label>
            <input
              type="text"
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              placeholder="Search provider..."
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
              Event Name
            </label>
            <input
              type="text"
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              placeholder="Search event..."
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
        </div>

        <button className="btn btn-sm btn-secondary" onClick={() => handleOpenModal()} style={{ marginLeft: 'auto', flexShrink: 0, alignSelf: 'flex-end' }}>
          + Add New
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <h3>Loading...</h3>
        </div>
      ) : getFilteredEvents().length === 0 ? (
        <div className="empty-state">
          <h3>{events.length === 0 ? 'No events found' : 'No events match the selected filter'}</h3>
          <p>{events.length === 0 ? 'Create your first provider event' : 'Try adjusting your filters'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Provider</th>
                <th>Event Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredEvents().map((event) => {
                const provider = providers.find((p) => p.providerId === event.providerId);
                return (
                  <tr key={event.providerEventId}>
                    <td>{event.providerEventId}</td>
                    <td>
                      <span>{provider?.providerName || 'Unknown'}</span>
                    </td>
                    <td>
                      <strong>{event.eventName}</strong>
                    </td>
                    <td>
                      <small>{event.eventDescription || '—'}</small>
                    </td>
                    <td>
                      <span>
                        {event.active === 'Y' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleOpenModal(event)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleDelete(event.providerEventId)}
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
              <h3>{editingId ? 'Edit Event' : 'Add New Event'}</h3>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="providerId">Provider *</label>
                <select
                  id="providerId"
                  name="providerId"
                  value={formData.providerId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a provider</option>
                  {providers.map((provider) => (
                    <option key={provider.providerId} value={provider.providerId}>
                      {provider.providerName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="eventName">Event Name *</label>
                <input
                  type="text"
                  id="eventName"
                  name="eventName"
                  value={formData.eventName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., BoatTelemetryReceived, HealthUpdate"
                />
              </div>

              <div className="form-group">
                <label htmlFor="eventDescription">Description</label>
                <textarea
                  id="eventDescription"
                  name="eventDescription"
                  value={formData.eventDescription}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Detailed description of this event"
                />
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
                  {editingId ? 'Update' : 'Create'} Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
