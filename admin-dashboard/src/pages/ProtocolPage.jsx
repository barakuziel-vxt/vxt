import React, { useState, useEffect } from 'react';
import { protocolAPI } from '../services/api';

export default function ProtocolPage() {
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterName, setFilterName] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [formData, setFormData] = useState({
    protocolName: '',
    protocolDescription: '',
    active: 'Y',
  });

  useEffect(() => {
    loadProtocols();
  }, []);

  const loadProtocols = async () => {
    setLoading(true);
    try {
      const data = await protocolAPI.getAll();
      setProtocols(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (protocol = null) => {
    if (protocol) {
      setEditingId(protocol.protocolId);
      setFormData({
        protocolName: protocol.protocolName,
        protocolDescription: protocol.protocolDescription || '',
        active: protocol.active || 'Y',
      });
    } else {
      setEditingId(null);
      setFormData({
        protocolName: '',
        protocolDescription: '',
        active: 'Y',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      protocolName: '',
      protocolDescription: '',
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
        await protocolAPI.update(editingId, formData);
      } else {
        await protocolAPI.create(formData);
      }
      await loadProtocols();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this protocol? This may affect associated attributes and events.')) {
      try {
        await protocolAPI.delete(id);
        await loadProtocols();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getFilteredProtocols = () => {
    let filtered = protocols;
    
    if (filterName) {
      filtered = filtered.filter((p) =>
        p.protocolName.toLowerCase().includes(filterName.toLowerCase())
      );
    }
    if (filterDescription) {
      filtered = filtered.filter((p) =>
        p.protocolDescription?.toLowerCase().includes(filterDescription.toLowerCase())
      );
    }
    
    return filtered;
  };

  return (
    <div className="page">
      <h2>Protocol Management</h2>
      <p className="page-subtitle">Define communication protocols and data exchange standards</p>

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
              Name
            </label>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Search name..."
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
              Description
            </label>
            <input
              type="text"
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
              placeholder="Search description..."
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
      ) : getFilteredProtocols().length === 0 ? (
        <div className="empty-state">
          <h3>{protocols.length === 0 ? 'No protocols found' : 'No protocols match the selected filter'}</h3>
          <p>{protocols.length === 0 ? 'Create your first protocol to get started' : 'Try adjusting your filters'}</p>
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredProtocols().map((protocol) => (
                <tr key={protocol.protocolId}>
                  <td>{protocol.protocolId}</td>
                  <td>
                    <strong>{protocol.protocolName}</strong>
                  </td>
                  <td>
                    <small>{protocol.protocolDescription || '—'}</small>
                  </td>
                  <td>
                    <span>
                      {protocol.active === 'Y' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleOpenModal(protocol)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleDelete(protocol.protocolId)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingId ? 'Edit Protocol' : 'Add New Protocol'}</h3>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="protocolName">Protocol Name *</label>
                <input
                  type="text"
                  id="protocolName"
                  name="protocolName"
                  value={formData.protocolName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., MQTT, REST, gRPC"
                />
              </div>

              <div className="form-group">
                <label htmlFor="protocolDescription">Description</label>
                <textarea
                  id="protocolDescription"
                  name="protocolDescription"
                  value={formData.protocolDescription}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Detailed description of this protocol"
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
                  {editingId ? 'Update' : 'Create'} Protocol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
