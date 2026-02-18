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
  const [filterCode, setFilterCode] = useState('');
  const [filterComponent, setFilterComponent] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterDataType, setFilterDataType] = useState('');
  const [formData, setFormData] = useState({
    protocolId: '',
    protocolAttributeCode: '',
    protocolAttributeName: '',
    description: '',
    component: '',
    unit: '',
    dataType: '',
    rangeMin: '',
    rangeMax: '',
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
        protocolAttributeCode: attribute.protocolAttributeCode || '',
        protocolAttributeName: attribute.protocolAttributeName || '',
        description: attribute.description || '',
        component: attribute.component || '',
        unit: attribute.unit || '',
        dataType: attribute.dataType || '',
        rangeMin: attribute.rangeMin || '',
        rangeMax: attribute.rangeMax || '',
        active: attribute.active || 'Y',
      });
    } else {
      setEditingId(null);
      setFormData({
        protocolId: '',
        protocolAttributeCode: '',
        protocolAttributeName: '',
        description: '',
        component: '',
        unit: '',
        dataType: '',
        rangeMin: '',
        rangeMax: '',
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
    if (filterCode) {
      filtered = filtered.filter((a) =>
        a.protocolAttributeCode?.toLowerCase().includes(filterCode.toLowerCase())
      );
    }
    if (filterComponent) {
      filtered = filtered.filter((a) =>
        a.component?.toLowerCase().includes(filterComponent.toLowerCase())
      );
    }
    if (filterUnit) {
      filtered = filtered.filter((a) =>
        a.unit?.toLowerCase().includes(filterUnit.toLowerCase())
      );
    }
    if (filterDataType) {
      filtered = filtered.filter((a) =>
        a.dataType?.toLowerCase().includes(filterDataType.toLowerCase())
      );
    }
    if (filterAttribute) {
      filtered = filtered.filter((a) =>
        a.protocolAttributeName?.toLowerCase().includes(filterAttribute.toLowerCase())
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
              Attribute Code
            </label>
            <input
              type="text"
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value)}
              placeholder="Search code..."
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
              Component
            </label>
            <input
              type="text"
              value={filterComponent}
              onChange={(e) => setFilterComponent(e.target.value)}
              placeholder="Search component..."
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
              Unit
            </label>
            <input
              type="text"
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              placeholder="Search unit..."
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
              Data Type
            </label>
            <input
              type="text"
              value={filterDataType}
              onChange={(e) => setFilterDataType(e.target.value)}
              placeholder="Search type..."
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
                <th>Code</th>
                <th>Description</th>
                <th>Component</th>
                <th>Unit</th>
                <th>Data Type</th>
                <th>Range</th>
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
                      <strong>{attribute.protocolAttributeName}</strong>
                    </td>
                    <td>
                      <small>{attribute.protocolAttributeCode || '—'}</small>
                    </td>
                    <td>
                      <small>{attribute.description || '—'}</small>
                    </td>
                    <td>
                      <small>{attribute.component || '—'}</small>
                    </td>
                    <td>
                      <small>{attribute.unit || '—'}</small>
                    </td>
                    <td>
                      <small>{attribute.dataType || '—'}</small>
                    </td>
                    <td>
                      <small>
                        {attribute.rangeMin || attribute.rangeMax
                          ? `${attribute.rangeMin || '—'} - ${attribute.rangeMax || '—'}`
                          : '—'}
                      </small>
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
                <label htmlFor="protocolAttributeCode">Attribute Code *</label>
                <input
                  type="text"
                  id="protocolAttributeCode"
                  name="protocolAttributeCode"
                  value={formData.protocolAttributeCode}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., ATTR_001, temperature"
                />
              </div>

              <div className="form-group">
                <label htmlFor="protocolAttributeName">Attribute Name *</label>
                <input
                  type="text"
                  id="protocolAttributeName"
                  name="protocolAttributeName"
                  value={formData.protocolAttributeName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Temperature, Humidity"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Detailed description of this attribute"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="component">Component</label>
                  <input
                    type="text"
                    id="component"
                    name="component"
                    value={formData.component}
                    onChange={handleInputChange}
                    placeholder="e.g., sensor, actuator"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="unit">Unit</label>
                  <input
                    type="text"
                    id="unit"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    placeholder="e.g., Celsius, %"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="dataType">Data Type</label>
                  <input
                    type="text"
                    id="dataType"
                    name="dataType"
                    value={formData.dataType}
                    onChange={handleInputChange}
                    placeholder="e.g., float, string, integer"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="rangeMin">Range Min</label>
                  <input
                    type="text"
                    id="rangeMin"
                    name="rangeMin"
                    value={formData.rangeMin}
                    onChange={handleInputChange}
                    placeholder="e.g., 0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rangeMax">Range Max</label>
                  <input
                    type="text"
                    id="rangeMax"
                    name="rangeMax"
                    value={formData.rangeMax}
                    onChange={handleInputChange}
                    placeholder="e.g., 100"
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
