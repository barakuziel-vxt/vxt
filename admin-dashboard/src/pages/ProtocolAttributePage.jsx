import React, { useState, useEffect } from 'react';
import { protocolAttributeAPI, protocolAPI } from '../services/api';

export default function ProtocolAttributePage() {
  const [attributes, setAttributes] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterProtocol, setFilterProtocol] = useState('');
  const [filterAttribute, setFilterAttribute] = useState('');
  const [formData, setFormData] = useState({
    protocolId: '',
    attributeName: '',
    attributeDescription: '',
    active: 'Y',
  });

  useEffect(() => {
    loadProtocols();
    loadAttributes();
  }, []);

  const loadProtocols = async () => {
    try {
      const data = await protocolAPI.getAll();
      setProtocols(data);
    } catch (err) {
      console.error('Error loading protocols:', err);
    }
  };

  const loadAttributes = async () => {
    setLoading(true);
    try {
      const data = await protocolAttributeAPI.getAll();
      setAttributes(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (attribute = null) => {
    if (attribute) {
      setEditingId(attribute.protocolAttributeId);
      setFormData({
        protocolId: attribute.protocolId || '',
        attributeName: attribute.attributeName,
        attributeDescription: attribute.attributeDescription || '',
        active: attribute.active || 'Y',
      });
    } else {
      setEditingId(null);
      setFormData({
        protocolId: '',
        attributeName: '',
        attributeDescription: '',
        active: 'Y',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      protocolId: '',
      attributeName: '',
      attributeDescription: '',
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
        await protocolAttributeAPI.update(editingId, formData);
      } else {
        await protocolAttributeAPI.create(formData);
      }
      await loadAttributes();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this protocol attribute?')) {
      try {
        await protocolAttributeAPI.delete(id);
        await loadAttributes();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getFilteredAttributes = () => {
    let filtered = attributes;
    
    if (filterProtocol) {
      filtered = filtered.filter((a) => {
        const protocol = protocols.find((p) => p.protocolId === a.protocolId);
        return protocol?.protocolName.toLowerCase().includes(filterProtocol.toLowerCase());
      });
    }
    if (filterAttribute) {
      filtered = filtered.filter((a) =>
        a.attributeName.toLowerCase().includes(filterAttribute.toLowerCase())
      );
    }
    
    return filtered;
  };

  return (
    <div className="page">
      <h2>Protocol Attribute Management</h2>
      <p className="page-subtitle">Define attributes and properties for communication protocols</p>

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
              Protocol
            </label>
            <input
              type="text"
              value={filterProtocol}
              onChange={(e) => setFilterProtocol(e.target.value)}
              placeholder="Search protocol..."
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
              Attribute Name
            </label>
            <input
              type="text"
              value={filterAttribute}
              onChange={(e) => setFilterAttribute(e.target.value)}
              placeholder="Search attribute..."
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
      ) : getFilteredAttributes().length === 0 ? (
        <div className="empty-state">
          <h3>{attributes.length === 0 ? 'No attributes found' : 'No attributes match the selected filter'}</h3>
          <p>{attributes.length === 0 ? 'Create your first protocol attribute' : 'Try adjusting your filters'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Protocol</th>
                <th>Attribute Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredAttributes().map((attribute) => {
                const protocol = protocols.find((p) => p.protocolId === attribute.protocolId);
                return (
                  <tr key={attribute.protocolAttributeId}>
                    <td>{attribute.protocolAttributeId}</td>
                    <td>
                      <span>{protocol?.protocolName || 'Unknown'}</span>
                    </td>
                    <td>
                      <strong>{attribute.attributeName}</strong>
                    </td>
                    <td>
                      <small>{attribute.attributeDescription || '—'}</small>
                    </td>
                    <td>
                      <span>
                        {attribute.active === 'Y' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleOpenModal(attribute)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleDelete(attribute.protocolAttributeId)}
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
              <h3>{editingId ? 'Edit Attribute' : 'Add New Attribute'}</h3>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="protocolId">Protocol *</label>
                <select
                  id="protocolId"
                  name="protocolId"
                  value={formData.protocolId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a protocol</option>
                  {protocols.map((protocol) => (
                    <option key={protocol.protocolId} value={protocol.protocolId}>
                      {protocol.protocolName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="attributeName">Attribute Name *</label>
                <input
                  type="text"
                  id="attributeName"
                  name="attributeName"
                  value={formData.attributeName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Topic, QoS Level"
                />
              </div>

              <div className="form-group">
                <label htmlFor="attributeDescription">Description</label>
                <textarea
                  id="attributeDescription"
                  name="attributeDescription"
                  value={formData.attributeDescription}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Detailed description of this attribute"
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
                  {editingId ? 'Update' : 'Create'} Attribute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
