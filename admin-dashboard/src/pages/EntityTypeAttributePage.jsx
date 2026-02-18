import React, { useState, useEffect } from 'react';
import {
  entityTypeAttributeAPI,
  entityTypeAPI,
  protocolAPI,
  protocolAttributeAPI,
  entityTypeAttributeScoreAPI,
  providerAPI,
  providerEventAPI,
} from '../services/api';

export default function EntityTypeAttributePage() {
  const [attributes, setAttributes] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [protocolAttributes, setProtocolAttributes] = useState([]);
  const [providers, setProviders] = useState([]);
  const [providerEvents, setProviderEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [filterEntityTypeId, setFilterEntityTypeId] = useState(''); // ALL by default
  const [filterComponent, setFilterComponent] = useState(''); // ALL by default
  const [formData, setFormData] = useState({
    entityTypeId: '',
    protocolId: '',
    entityTypeAttributeCode: '',
    entityTypeAttributeName: '',
    entityTypeAttributeTimeAspect: 'Pt',
    entityTypeAttributeUnit: '',
    providerId: '',
    providerEventType: '',
    active: 'Y',
  });
  const [criteriaFormData, setCriteriaFormData] = useState({
    minValue: '',
    maxValue: '',
    strValue: '',
    score: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [attrData, typeData, protData, provData, eventData] = await Promise.all([
        entityTypeAttributeAPI.getAll(),
        entityTypeAPI.getAll(),
        protocolAPI.getAll(),
        providerAPI.getAll(),
        providerEventAPI.getAll(),
      ]);
      setAttributes(attrData);
      setEntityTypes(typeData);
      setProtocols(protData);
      setProviders(provData);
      setProviderEvents(eventData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProtocolChange = async (protocolId) => {
    if (protocolId) {
      try {
        const attrs = await protocolAttributeAPI.getByProtocolId(protocolId);
        setProtocolAttributes(attrs);
      } catch (err) {
        console.error('Error loading protocol attributes:', err);
      }
    } else {
      setProtocolAttributes([]);
    }
  };

  const handleProviderChange = (providerId) => {
    setFormData((prev) => ({
      ...prev,
      providerId,
      providerEventType: '', // Reset event type when provider changes
    }));
  };

  const getProviderEventTypes = () => {
    if (formData.providerId) {
      return providerEvents.filter(
        (event) => event.providerId === parseInt(formData.providerId)
      );
    }
    return [];
  };

  const handleOpenModal = (attribute = null) => {
    if (attribute) {
      setEditingId(attribute.entityTypeAttributeId);
      setFormData({
        entityTypeId: attribute.entityTypeId,
        protocolId: attribute.protocolId || '',
        entityTypeAttributeCode: attribute.entityTypeAttributeCode,
        entityTypeAttributeName: attribute.entityTypeAttributeName,
        entityTypeAttributeTimeAspect: attribute.entityTypeAttributeTimeAspect,
        entityTypeAttributeUnit: attribute.entityTypeAttributeUnit,
        providerId: attribute.providerId || '',
        providerEventType: attribute.providerEventType || '',
        active: attribute.active,
      });
      if (attribute.protocolId) {
        handleProtocolChange(attribute.protocolId);
      }
    } else {
      setEditingId(null);
      setFormData({
        entityTypeId: '',
        protocolId: '',
        entityTypeAttributeCode: '',
        entityTypeAttributeName: '',
        entityTypeAttributeTimeAspect: 'Pt',
        entityTypeAttributeUnit: '',
        providerId: '',
        providerEventType: '',
        active: 'Y',
      });
      setProtocolAttributes([]);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === 'protocolId') {
      handleProtocolChange(value);
    }
    if (name === 'providerId') {
      handleProviderChange(value);
    }
    // Auto-populate Unit when protocol attribute code is selected
    if (name === 'entityTypeAttributeCode' && formData.protocolId) {
      const selectedAttr = protocolAttributes.find(
        (attr) => attr.protocolAttributeCode === value
      );
      if (selectedAttr && selectedAttr.unit) {
        setFormData((prev) => ({
          ...prev,
          entityTypeAttributeUnit: selectedAttr.unit,
        }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await entityTypeAttributeAPI.update(editingId, formData);
      } else {
        await entityTypeAttributeAPI.create(formData);
      }
      await loadData();
      handleCloseModal();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this attribute?')) {
      try {
        await entityTypeAttributeAPI.delete(id);
        await loadData();
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleOpenCriteriaModal = async (attribute) => {
    setSelectedAttribute(attribute);
    try {
      const crit = await entityTypeAttributeScoreAPI.getByAttributeId(attribute.entityTypeAttributeId);
      setCriteria(crit);
    } catch (err) {
      console.error('Error loading criteria:', err);
    }
    
    // Auto-populate minValue and maxValue from protocol attribute's rangeMin and rangeMax
    if (attribute.protocolId) {
      try {
        const attrs = await protocolAttributeAPI.getByProtocolId(attribute.protocolId);
        const matchingAttr = attrs.find(
          (attr) => attr.protocolAttributeCode === attribute.entityTypeAttributeCode
        );
        if (matchingAttr) {
          setCriteriaFormData((prev) => ({
            ...prev,
            minValue: matchingAttr.rangeMin !== null ? matchingAttr.rangeMin : '',
            maxValue: matchingAttr.rangeMax !== null ? matchingAttr.rangeMax : '',
          }));
        } else {
          setCriteriaFormData({ minValue: '', maxValue: '', strValue: '', score: '' });
        }
      } catch (err) {
        console.error('Error loading protocol attributes for ranges:', err);
        setCriteriaFormData({ minValue: '', maxValue: '', strValue: '', score: '' });
      }
    } else {
      setCriteriaFormData({ minValue: '', maxValue: '', strValue: '', score: '' });
    }
    
    setShowCriteriaModal(true);
  };

  const handleCloseCriteriaModal = () => {
    setShowCriteriaModal(false);
    setSelectedAttribute(null);
    setCriteria([]);
  };

  const handleCriteriaInputChange = (e) => {
    const { name, value } = e.target;
    setCriteriaFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddCriteria = async (e) => {
    e.preventDefault();
    try {
      const newCriteria = {
        entityTypeId: selectedAttribute.entityTypeId,
        entityTypeAttributeId: selectedAttribute.entityTypeAttributeId,
        ...criteriaFormData,
      };
      await entityTypeAttributeScoreAPI.create(newCriteria);
      setCriteriaFormData({ minValue: '', maxValue: '', strValue: '', score: '' });
      const crit = await entityTypeAttributeScoreAPI.getByAttributeId(selectedAttribute.entityTypeAttributeId);
      setCriteria(crit);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteCriteria = async (id) => {
    if (window.confirm('Are you sure you want to delete this criterion?')) {
      try {
        await entityTypeAttributeScoreAPI.delete(id);
        const crit = await entityTypeAttributeScoreAPI.getByAttributeId(selectedAttribute.entityTypeAttributeId);
        setCriteria(crit);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getEntityTypeName = (typeId) => {
    const type = entityTypes.find((t) => t.entityTypeId === typeId);
    return type ? type.entityTypeName : 'Unknown';
  };

  const getProtocolName = (protocolId) => {
    const protocol = protocols.find((p) => p.protocolId === protocolId);
    return protocol ? protocol.protocolName : 'None';
  };

  const getProviderName = (providerId) => {
    const provider = providers.find((p) => p.providerId === providerId);
    return provider ? provider.providerName : 'None';
  };

  const getUniqueComponents = () => {
    let filteredAttrs = attributes.filter((attr) => attr.protocolId); // Only include attributes with protocols
    
    // If entity type is selected, further filter by that entity type
    if (filterEntityTypeId) {
      filteredAttrs = filteredAttrs.filter((attr) => attr.entityTypeId === parseInt(filterEntityTypeId));
    }
    
    const components = filteredAttrs
      .map((attr) => attr.component)
      .filter((component, index, self) => component && self.indexOf(component) === index);
    return components.sort();
  };

  const getFilteredAttributes = () => {
    let filtered = attributes;

    // Filter by Entity Type
    if (filterEntityTypeId) {
      filtered = filtered.filter((attr) => attr.entityTypeId === parseInt(filterEntityTypeId));
    }

    // Filter by Component
    if (filterComponent) {
      filtered = filtered.filter((attr) => attr.component === filterComponent);
    }

    return filtered;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Entity Type Attributes</h2>
        <p>Define attributes for entity types with protocol mappings and scoring criteria</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters Section */}
      <div style={{ 
        backgroundColor: '#252525', 
        padding: '15px 20px', 
        borderRadius: '5px', 
        marginBottom: '20px',
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        alignItems: 'flex-end'
      }}>
        <div style={{ marginBottom: '0' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: 'var(--text-color)' }}>
              Entity Type
            </label>
            <select
              value={filterEntityTypeId}
              onChange={(e) => {
                setFilterEntityTypeId(e.target.value);
                setFilterComponent(''); // Reset component filter when entity type changes
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                fontSize: '14px',
                cursor: 'pointer',
                backgroundColor: '#353535',
                color: 'var(--text-color)'
              }}
            >
              <option value="">ALL</option>
              {entityTypes.map((type) => (
                <option key={type.entityTypeId} value={type.entityTypeId}>
                  {type.entityTypeName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '0' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: 'var(--text-color)' }}>
              Category (Component)
            </label>
            <select
              value={filterComponent}
              onChange={(e) => setFilterComponent(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                fontSize: '14px',
                cursor: 'pointer',
                backgroundColor: '#353535',
                color: 'var(--text-color)'
              }}
            >
              <option value="">ALL</option>
              {getUniqueComponents().map((component) => (
                <option key={component} value={component}>
                  {component}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button className="add-button" onClick={() => handleOpenModal()}>
          + Add New Attribute
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <h3>Loading...</h3>
        </div>
      ) : getFilteredAttributes().length === 0 ? (
        <div className="empty-state">
          <h3>{attributes.length === 0 ? 'No attributes found' : 'No attributes match the selected filters'}</h3>
          <p>{attributes.length === 0 ? 'Create your first entity type attribute to get started' : 'Try adjusting your filters'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Attribute Name</th>
                <th>Code</th>
                <th>Entity Type</th>
                <th>Protocol</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredAttributes().map((attr) => (
                <tr key={attr.entityTypeAttributeId}>
                  <td>{attr.entityTypeAttributeId}</td>
                  <td>{attr.entityTypeAttributeName}</td>
                  <td>
                    <code>{attr.entityTypeAttributeCode}</code>
                  </td>
                  <td>{getEntityTypeName(attr.entityTypeId)}</td>
                  <td>
                    <span className="badge badge-primary">{getProtocolName(attr.protocolId)}</span>
                  </td>
                  <td>{attr.entityTypeAttributeUnit}</td>
                  <td>
                    {attr.component ? (
                      <span className="badge badge-secondary">{attr.component}</span>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${attr.active === 'Y' ? 'active' : 'inactive'}`}>
                      {attr.active === 'Y' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleOpenModal(attr)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleOpenCriteriaModal(attr)}
                      >
                        Scores
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => handleDelete(attr.entityTypeAttributeId)}
                      >
                        Delete
                      </button>
                    </div>
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
              <h3>{editingId ? 'Edit Attribute' : 'Add New Attribute'}</h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="entityTypeId">Entity Type *</label>
                <select
                  id="entityTypeId"
                  name="entityTypeId"
                  value={formData.entityTypeId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select an entity type</option>
                  {entityTypes.map((type) => (
                    <option key={type.entityTypeId} value={type.entityTypeId}>
                      {type.entityTypeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="entityTypeAttributeName">Attribute Name *</label>
                <input
                  type="text"
                  id="entityTypeAttributeName"
                  name="entityTypeAttributeName"
                  value={formData.entityTypeAttributeName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Heart Rate, Engine RPM"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="providerId">Provider</label>
                  <select
                    id="providerId"
                    name="providerId"
                    value={formData.providerId}
                    onChange={handleInputChange}
                  >
                    <option value="">Select a provider (optional)</option>
                    {providers.map((provider) => (
                      <option key={provider.providerId} value={provider.providerId}>
                        {provider.providerName}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.providerId && (
                  <div className="form-group">
                    <label htmlFor="providerEventType">Provider Event Type</label>
                    <select
                      id="providerEventType"
                      name="providerEventType"
                      value={formData.providerEventType}
                      onChange={handleInputChange}
                    >
                      <option value="">Select an event type (optional)</option>
                      {getProviderEventTypes().map((event) => (
                        <option key={event.providerEventId} value={event.providerEventType}>
                          {event.providerEventType}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: 'var(--text-light)', marginTop: '5px', display: 'block' }}>
                      Event types from selected provider
                    </small>
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="protocolId">Protocol</label>
                  <select
                    id="protocolId"
                    name="protocolId"
                    value={formData.protocolId}
                    onChange={handleInputChange}
                  >
                    <option value="">Select a protocol (optional)</option>
                    {protocols.map((protocol) => (
                      <option key={protocol.protocolId} value={protocol.protocolId}>
                        {protocol.protocolName}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.protocolId && (
                  <div className="form-group">
                    <label htmlFor="entityTypeAttributeCode">Protocol Attribute Code *</label>
                    <select
                      id="entityTypeAttributeCode"
                      name="entityTypeAttributeCode"
                      value={formData.entityTypeAttributeCode}
                      onChange={handleInputChange}
                      required={!!formData.protocolId}
                    >
                      <option value="">Select attribute code</option>
                      {protocolAttributes.map((attr) => (
                        <option key={attr.protocolAttributeId} value={attr.protocolAttributeCode}>
                          {attr.protocolAttributeCode} - {attr.protocolAttributeName}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: 'var(--text-light)', marginTop: '5px', display: 'block' }}>
                      Selected protocol attributes available for mapping
                    </small>
                  </div>
                )}

                {!formData.protocolId && (
                  <div className="form-group">
                    <label htmlFor="entityTypeAttributeCode">Attribute Code *</label>
                    <input
                      type="text"
                      id="entityTypeAttributeCode"
                      name="entityTypeAttributeCode"
                      value={formData.entityTypeAttributeCode}
                      onChange={handleInputChange}
                      required={!formData.protocolId}
                      placeholder="e.g., AvgHR, EngineRPM"
                    />
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="entityTypeAttributeTimeAspect">Time Aspect</label>
                  <select
                    id="entityTypeAttributeTimeAspect"
                    name="entityTypeAttributeTimeAspect"
                    value={formData.entityTypeAttributeTimeAspect}
                    onChange={handleInputChange}
                  >
                    <option value="Pt">Point in Time</option>
                    <option value="Mean">Mean</option>
                    <option value="Max">Maximum</option>
                    <option value="Min">Minimum</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="entityTypeAttributeUnit">Unit</label>
                  <input
                    type="text"
                    id="entityTypeAttributeUnit"
                    name="entityTypeAttributeUnit"
                    value={formData.entityTypeAttributeUnit}
                    onChange={handleInputChange}
                    placeholder="e.g., bpm, mmHg, °C"
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

      {showCriteriaModal && selectedAttribute && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Scoring Values for {selectedAttribute.entityTypeAttributeName}</h3>
            </div>

            <div className="form-section">
              <h3>Add New Value Score</h3>
              <form onSubmit={handleAddCriteria}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="minValue">Min Value</label>
                    <input
                      type="number"
                      id="minValue"
                      name="minValue"
                      value={criteriaFormData.minValue}
                      onChange={handleCriteriaInputChange}
                      step="0.01"
                      placeholder="e.g., 60"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="maxValue">Max Value</label>
                    <input
                      type="number"
                      id="maxValue"
                      name="maxValue"
                      value={criteriaFormData.maxValue}
                      onChange={handleCriteriaInputChange}
                      step="0.01"
                      placeholder="e.g., 100"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="strValue">String Value (optional)</label>
                  <input
                    type="text"
                    id="strValue"
                    name="strValue"
                    value={criteriaFormData.strValue}
                    onChange={handleCriteriaInputChange}
                    placeholder="e.g., Normal, Abnormal"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="score">Score (points)</label>
                  <input
                    type="number"
                    id="score"
                    name="score"
                    value={criteriaFormData.score}
                    onChange={handleCriteriaInputChange}
                    required
                    placeholder="e.g., 10"
                  />
                </div>

                <button type="submit" className="btn btn-success">
                  Add ValueScore
                </button>
              </form>
            </div>

            {criteria.length > 0 && (
              <div>
                <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Existing ValueScores</h3>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Min Value</th>
                        <th>Max Value</th>
                        <th>String Value</th>
                        <th>Score</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criteria.map((c) => (
                        <tr key={c.entityTypeCriteriaId}>
                          <td>{c.minValue}</td>
                          <td>{c.maxValue}</td>
                          <td>{c.strValue || 'N/A'}</td>
                          <td>
                            <span style={{ fontWeight: 'bold', color: '#667eea' }}>{c.score}</span>
                          </td>
                          <td>
                            <button
                              className="btn btn-danger btn-small"
                              onClick={() => handleDeleteCriteria(c.entityTypeCriteriaId)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseCriteriaModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
