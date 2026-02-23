import React, { useState, useEffect } from 'react';
import { customerGeofenceCriteriaAPI, customerAPI, entityTypeAttributeAPI, entityTypeAPI } from '../services/api';

export default function CustomerGeofencePage() {
  const [geofences, setGeofences] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterGeofenceName, setFilterGeofenceName] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [formData, setFormData] = useState({
    customerId: '',
    entityTypeId: '',
    entityTypeAttributeId: '1073',  // Default to Position attribute (navigation.position)
    geofenceName: '',
    geoType: 'Polygon',
    coordinates: '[]',
    description: '',
    active: 'Y',
  });

  // Define getFilteredAttributes before useEffects that use it
  const getFilteredAttributes = () => {
    let filtered = attributes.filter((attr) => {
      const code = attr.entityTypeAttributeCode || attr.attributeCode;
      return code && code.trim();
    });
    
    if (formData.entityTypeId) {
      const entityTypeIdNum = parseInt(formData.entityTypeId);
      filtered = filtered.filter((attr) => {
        const attrTypeId = parseInt(attr.entityTypeId);
        return attrTypeId === entityTypeIdNum;
      });
    }
    
    return filtered;
  };

  useEffect(() => {
    loadCustomers();
    loadEntityTypes();
    loadAttributes();
    loadGeofences();
  }, []);

  useEffect(() => {
    loadGeofences();
  }, [filterStatus]);

  useEffect(() => {
    if (attributes.length > 0) {
      console.log('✅ Attributes loaded - Sample:', attributes.slice(0, 2).map(a => ({
        code: a.entityTypeAttributeCode,
        name: a.entityTypeAttributeName,
        typeId: a.entityTypeId
      })));
    }
  }, [attributes]);

  useEffect(() => {
    if (formData.entityTypeId) {
      const filtered = getFilteredAttributes();
      console.log(`🔍 Filter by entityTypeId=${formData.entityTypeId}: Found ${filtered.length} attributes`);
    }
  }, [formData.entityTypeId, attributes]);

  // Log formData changes for debugging
  useEffect(() => {
    console.log('📋 formData changed:', {
      editingId,
      customerId: formData.customerId,
      entityTypeId: formData.entityTypeId,
      entityTypeAttributeId: formData.entityTypeAttributeId,
      geofenceName: formData.geofenceName,
    });
  }, [formData, editingId]);

  useEffect(() => {
    if (editingId && formData.entityTypeAttributeId) {
      const attrIdNum = parseInt(formData.entityTypeAttributeId);
      const attr = attributes.find(a => parseInt(a.entityTypeAttributeId) === attrIdNum);
      if (attr) {
        console.log(`📝 Editing geofence - Attribute: ${attr.entityTypeAttributeCode}, AutoSet EntityTypeId: ${attr.entityTypeId}`);
      }
    }
  }, [editingId]);

  // Auto-populate entityTypeId when attributes load and we're in edit mode
  useEffect(() => {
    console.log('🔄 Auto-populate useEffect triggered:', {
      editingId,
      attributeId: formData.entityTypeAttributeId,
      attributesLoaded: attributes.length,
      entityTypeId: formData.entityTypeId,
    });
    
    if (editingId && formData.entityTypeAttributeId && attributes.length > 0 && !formData.entityTypeId) {
      console.log('✅ Conditions met, attempting auto-populate');
      const attrIdNum = parseInt(formData.entityTypeAttributeId);
      console.log('🎯 Looking for attribute:', attrIdNum);
      console.log('📦 All attributes:', attributes.map(a => ({
        id: a.entityTypeAttributeId,
        code: a.entityTypeAttributeCode,
        typeId: a.entityTypeId
      })));
      
      const selectedAttr = attributes.find(a => parseInt(a.entityTypeAttributeId) === attrIdNum);
      console.log('✅ Found selectedAttr:', selectedAttr ? {
        id: selectedAttr.entityTypeAttributeId,
        code: selectedAttr.entityTypeAttributeCode,
        typeId: selectedAttr.entityTypeId
      } : 'NOT FOUND');
      
      if (selectedAttr && selectedAttr.entityTypeId) {
        console.log(`🔧 Auto-setting entityTypeId=${selectedAttr.entityTypeId} from attribute`);
        setFormData(prev => ({
          ...prev,
          entityTypeId: selectedAttr.entityTypeId
        }));
      } else {
        console.log('❌ selectedAttr not found or no entityTypeId');
      }
    } else {
      console.log('❌ Conditions not met:', {
        hasEditingId: !!editingId,
        hasAttributeId: !!formData.entityTypeAttributeId,
        hasAttributes: attributes.length > 0,
        hasNoEntityTypeId: !formData.entityTypeId,
      });
    }
  }, [attributes, editingId]);

  const loadCustomers = async () => {
    try {
      const data = await customerAPI.getAll();
      setCustomers(data);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  const loadEntityTypes = async () => {
    try {
      const data = await entityTypeAPI.getAll();
      setEntityTypes(data);
    } catch (err) {
      console.error('Error loading entity types:', err);
    }
  };

  const loadAttributes = async () => {
    try {
      const data = await entityTypeAttributeAPI.getAll();
      setAttributes(data);
    } catch (err) {
      console.error('Error loading attributes:', err);
    }
  };

  const loadGeofences = async () => {
    setLoading(true);
    try {
      const data = await customerGeofenceCriteriaAPI.getAll(null, filterStatus);
      setGeofences(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (geofence = null) => {
    if (geofence) {
      setEditingId(geofence.customerGeofenceCriteriaId);
      
      // Find the entityTypeId from the selected attribute
      let entityTypeIdToSet = '';
      if (geofence.entityTypeAttributeId) {
        const geoAttrIdNum = parseInt(geofence.entityTypeAttributeId);
        const selectedAttr = attributes.find(a => parseInt(a.entityTypeAttributeId) === geoAttrIdNum);
        if (selectedAttr && selectedAttr.entityTypeId) {
          entityTypeIdToSet = selectedAttr.entityTypeId;
        }
      }
      
      setFormData({
        customerId: geofence.customerId || '',
        entityTypeId: entityTypeIdToSet,
        entityTypeAttributeId: geofence.entityTypeAttributeId || '',
        geofenceName: geofence.geofenceName || '',
        geoType: geofence.geoType || 'Polygon',
        coordinates: JSON.stringify(geofence.coordinates || []) || '[]',
        description: geofence.description || '',
        active: geofence.active || 'Y',
      });
    } else {
      setEditingId(null);
      setFormData({
        customerId: '',
        entityTypeId: '',
        entityTypeAttributeId: '',
        geofenceName: '',
        geoType: 'Polygon',
        coordinates: '[]',
        description: '',
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
      entityTypeId: '',
      entityTypeAttributeId: '1073',  // Default to Position attribute
      geofenceName: '',
      geoType: 'Polygon',
      coordinates: '[]',
      description: '',
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
      // Validate required fields
      if (!formData.customerId) {
        setError('Customer is required');
        return;
      }
      if (!formData.entityTypeAttributeId) {
        setError('Entity Type Attribute is required');
        return;
      }
      
      // Validate JSON for coordinates
      let coordsToSave = formData.coordinates;
      try {
        const parsed = JSON.parse(formData.coordinates);
        // Handle both GeoJSON format {type, coordinates} and raw coordinates array
        if (parsed && typeof parsed === 'object' && parsed.coordinates) {
          // GeoJSON format - extract coordinates array
          coordsToSave = parsed.coordinates;
        } else {
          // Raw coordinates array format
          coordsToSave = parsed;
        }
      } catch (parseErr) {
        setError('Invalid JSON in coordinates field. Expected GeoJSON or coordinate array.');
        return;
      }

      const dataToSave = {
        customerId: parseInt(formData.customerId),
        entityTypeAttributeId: formData.entityTypeAttributeId ? parseInt(formData.entityTypeAttributeId) : null,
        geofenceName: formData.geofenceName,
        geoType: formData.geoType,
        coordinates: JSON.stringify(coordsToSave),
        description: formData.description,
        active: formData.active,
      };

      if (editingId) {
        await customerGeofenceCriteriaAPI.update(editingId, dataToSave);
      } else {
        await customerGeofenceCriteriaAPI.create(dataToSave);
      }
      await loadGeofences();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this geofence?')) {
      try {
        await customerGeofenceCriteriaAPI.delete(id);
        await loadGeofences();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getFilteredGeofences = () => {
    let filtered = geofences;

    if (filterCustomer) {
      filtered = filtered.filter((g) => {
        const customer = customers.find((c) => c.customerId === g.customerId);
        return customer?.customerName.toLowerCase().includes(filterCustomer.toLowerCase());
      });
    }
    if (filterGeofenceName) {
      filtered = filtered.filter((g) =>
        g.geofenceName && g.geofenceName.toLowerCase().includes(filterGeofenceName.toLowerCase())
      );
    }

    return filtered;
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find((c) => c.customerId === customerId);
    return customer?.customerName || `Customer ${customerId}`;
  };

  const getAttributeName = (attrId) => {
    if (!attrId) return 'N/A';
    const attrIdNum = parseInt(attrId);
    const attr = attributes.find((a) => parseInt(a.entityTypeAttributeId) === attrIdNum);
    if (!attr) return `Attr ${attrId}`;
    const code = attr.entityTypeAttributeCode || attr.attributeCode;
    const name = attr.entityTypeAttributeName || attr.attributeName;
    return code && code.trim() ? code : name || `Attr ${attrId}`;
  };

  const getEntityTypeName = (entityTypeId) => {
    if (!entityTypeId) return 'N/A';
    const entityType = entityTypes.find((et) => et.entityTypeId === entityTypeId);
    return entityType?.entityTypeName || `Type ${entityTypeId}`;
  };

  return (
    <div className="page">
      <h2>Customer Geofence Management</h2>
      <p className="page-subtitle">Define restricted zones and monitoring areas per customer</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div
        style={{
          backgroundColor: '#252525',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px',
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
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
              Geofence Name
            </label>
            <input
              type="text"
              value={filterGeofenceName}
              onChange={(e) => setFilterGeofenceName(e.target.value)}
              placeholder="Search geofence..."
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

        <button
          onClick={() => handleOpenModal()}
          style={{
            padding: '8px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          + New Geofence
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-color)' }}>Loading...</div>
      ) : (
        <div
          style={{
            backgroundColor: '#1e1e1e',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#252525', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-color)' }}>
                  Customer
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-color)' }}>
                  Geofence Name
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-color)' }}>
                  Type
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-color)' }}>
                  Attribute
                </th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--text-color)' }}>
                  Description
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-color)' }}>
                  Status
                </th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-color)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {getFilteredGeofences().length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: 'var(--text-color-secondary)',
                    }}
                  >
                    No geofences found
                  </td>
                </tr>
              ) : (
                getFilteredGeofences().map((geofence) => (
                  <tr key={geofence.customerGeofenceCriteriaId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', color: 'var(--text-color)' }}>{getCustomerName(geofence.customerId)}</td>
                    <td style={{ padding: '12px', color: 'var(--text-color)' }}>{geofence.geofenceName}</td>
                    <td style={{ padding: '12px', color: 'var(--text-color)' }}>
                      <span
                        style={{
                          backgroundColor: geofence.geoType === 'Polygon' ? '#4CAF50' : '#FF9800',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '3px',
                          fontSize: '12px',
                        }}
                      >
                        {geofence.geoType}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-color)' }}>{getAttributeName(geofence.entityTypeAttributeId)}</td>
                    <td style={{ padding: '12px', color: 'var(--text-color)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {geofence.description || '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span
                        style={{
                          backgroundColor: geofence.active === 'Y' ? '#4CAF50' : '#f44336',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '3px',
                          fontSize: '12px',
                        }}
                      >
                        {geofence.active === 'Y' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleOpenModal(geofence)}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          marginRight: '5px',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(geofence.customerGeofenceCriteriaId)}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleCloseModal}
        >
          {console.log('🎯 Modal render - formData:', {
            editingId,
            customerId: formData.customerId,
            entityTypeId: formData.entityTypeId,
            entityTypeAttributeId: formData.entityTypeAttributeId,
            attributesAvailable: getFilteredAttributes().length,
          })}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1e1e1e',
              borderRadius: '8px',
              padding: '30px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'var(--text-color)' }}>
              {editingId ? 'Edit Geofence' : 'Create New Geofence'}
            </h3>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--text-color)' }}>
                  Customer *
                </label>
                <select
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#252525',
                    color: 'var(--text-color)',
                    fontSize: '14px',
                  }}
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.customerName}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--text-color)' }}>
                  Geofence Name *
                </label>
                <input
                  type="text"
                  name="geofenceName"
                  value={formData.geofenceName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Port Zone A"
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#252525',
                    color: 'var(--text-color)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--text-color)' }}>
                  Geofence Type *
                </label>
                <select
                  name="geoType"
                  value={formData.geoType}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#252525',
                    color: 'var(--text-color)',
                    fontSize: '14px',
                  }}
                >
                  <option value="Polygon">Polygon (Multi-point area)</option>
                  <option value="Circle">Circle (Center point + radius)</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--text-color)' }}>
                  Entity Type
                </label>
                <select
                  name="entityTypeId"
                  value={formData.entityTypeId}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#252525',
                    color: 'var(--text-color)',
                    fontSize: '14px',
                  }}
                >
                  <option value="">All Entity Types</option>
                  {entityTypes.map((entityType) => (
                    <option key={entityType.entityTypeId} value={entityType.entityTypeId}>
                      {entityType.entityTypeName}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--text-color)' }}>
                  Entity Type Attribute * ({getFilteredAttributes().length} available)
                </label>
                <select
                  name="entityTypeAttributeId"
                  value={formData.entityTypeAttributeId}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#252525',
                    color: 'var(--text-color)',
                    fontSize: '14px',
                  }}
                >
                  <option value="">Select an entity type attribute</option>
                  {getFilteredAttributes().length === 0 ? (
                    <option disabled>No attributes available for selected entity type</option>
                  ) : (
                    getFilteredAttributes().map((attr) => (
                      <option key={attr.entityTypeAttributeId} value={attr.entityTypeAttributeId}>
                        {attr.entityTypeAttributeCode || attr.attributeCode} - {attr.entityTypeAttributeName || attr.attributeName || attr.entityTypeAttributeCode || attr.attributeCode}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--text-color)' }}>
                  Coordinates (JSON) *
                </label>
                <textarea
                  name="coordinates"
                  value={formData.coordinates}
                  onChange={handleInputChange}
                  required
                  placeholder={`Polygon (simplest):\n[[[lon,lat],[lon,lat],[lon,lat]]]\n\nExample:\n[[[35.0099602,32.838489],[35.037323,32.8376815],[35.0399837,32.8515948],[35.0101147,32.8531806],[35.009943,32.8387629]]]\n\nOR GeoJSON format accepted`}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#252525',
                    color: 'var(--text-color)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    minHeight: '80px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--text-color)' }}>
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="e.g., Main harbor entry point"
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#252525',
                    color: 'var(--text-color)',
                    fontSize: '14px',
                    minHeight: '60px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--text-color)' }}>
                  Status
                </label>
                <select
                  name="active"
                  value={formData.active}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#252525',
                    color: 'var(--text-color)',
                    fontSize: '14px',
                  }}
                >
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#555',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
