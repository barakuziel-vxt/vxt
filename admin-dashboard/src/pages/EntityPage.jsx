import React, { useState, useEffect } from 'react';
import { entityAPI } from '../services/eventApi';
import { entityTypeAPI } from '../services/api';

export default function EntityPage() {
  // State for entities
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityFormData, setEntityFormData] = useState({
    entityId: '',
    entityFirstName: '',
    entityLastName: '',
    entityTypeId: '',
    gender: '',
    birthDate: ''
  });

  // State for filters
  const [filterEntityTypeId, setFilterEntityTypeId] = useState('');

  // State for dropdowns
  const [entityTypes, setEntityTypes] = useState([]);

  // State for modals
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [error, setError] = useState(null);

  // Load initial data
  useEffect(() => {
    loadEntityTypes();
    loadEntities();
  }, []);

  // Load entities when filter changes
  useEffect(() => {
    loadEntities();
  }, [filterEntityTypeId]);

  const loadEntityTypes = async () => {
    try {
      console.log('Loading entity types...');
      const data = await entityTypeAPI.getAll();
      console.log('Entity types loaded:', data);
      setEntityTypes(data);
      setError(null);
    } catch (error) {
      console.error('Error loading entity types:', error);
      setError('Failed to load entity types: ' + error.message);
    }
  };

  const loadEntities = async () => {
    try {
      const params = filterEntityTypeId ? parseInt(filterEntityTypeId) : null;
      console.log('Loading entities with params:', params);
      const data = await entityAPI.getAll(params);
      console.log('Entities loaded:', data);
      setEntities(data);
      setError(null);
    } catch (error) {
      console.error('Error loading entities:', error);
      const msg = 'Failed to load entities: ' + error.message;
      setError(msg);
      console.error('Full error:', error.response || error);
    }
  };

  const handleOpenEntityModal = (entity = null) => {
    if (entity) {
      setModalMode('edit');
      setSelectedEntity(entity);
      setEntityFormData({
        entityId: entity.entityId,
        entityFirstName: entity.entityFirstName,
        entityLastName: entity.entityLastName || '',
        entityTypeId: entity.entityTypeId,
        gender: entity.gender || '',
        birthDate: entity.birthDate ? entity.birthDate.split('T')[0] : ''
      });
    } else {
      setModalMode('add');
      setSelectedEntity(null);
      setEntityFormData({
        entityId: '',
        entityFirstName: '',
        entityLastName: '',
        entityTypeId: '',
        gender: '',
        birthDate: ''
      });
    }
    setShowEntityModal(true);
  };

  const handleCloseEntityModal = () => {
    setShowEntityModal(false);
    setEntityFormData({
      entityId: '',
      entityFirstName: '',
      entityLastName: '',
      entityTypeId: '',
      gender: '',
      birthDate: ''
    });
  };

  const handleSaveEntity = async () => {
    // Validation
    if (!entityFormData.entityId.trim()) {
      alert('Entity ID is required');
      return;
    }
    if (!entityFormData.entityFirstName.trim()) {
      alert('First Name is required');
      return;
    }
    if (!entityFormData.entityTypeId) {
      alert('Entity Type is required');
      return;
    }

    try {
      if (modalMode === 'add') {
        await entityAPI.create(entityFormData);
        alert('Entity created successfully');
      } else {
        await entityAPI.update(entityFormData.entityId, entityFormData);
        alert('Entity updated successfully');
      }
      handleCloseEntityModal();
      loadEntities();
    } catch (error) {
      console.error('Error saving entity:', error);
      alert('Error saving entity: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteEntity = async (entityId) => {
    if (window.confirm('Are you sure you want to delete this entity?')) {
      try {
        await entityAPI.delete(entityId);
        alert('Entity deleted successfully');
        loadEntities();
      } catch (error) {
        console.error('Error deleting entity:', error);
        alert('Error deleting entity: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const getEntityTypeName = (typeId) => {
    const type = entityTypes.find((t) => t.entityTypeId === typeId);
    return type ? type.entityTypeName : '';
  };

  const getFilteredEntities = () => {
    if (!filterEntityTypeId) return entities;
    return entities.filter((e) => e.entityTypeId === parseInt(filterEntityTypeId));
  };

  const filteredEntities = getFilteredEntities();

  const genderOptions = [
    { value: '', label: 'Not Specified' },
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
    { value: 'O', label: 'Other' }
  ];

  return (
    <div className="page">
      <h2>Entity Management</h2>

      {error && (
        <div style={{ padding: '10px', backgroundColor: 'rgba(218, 54, 51, 0.1)', color: '#f85149', borderRadius: '4px', marginBottom: '15px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ backgroundColor: '#161b22', padding: '15px', borderRadius: '6px', marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end', flex: '1' }}>
          <div style={{ flex: '1 1 160px', minWidth: '160px' }}>
            <label htmlFor="entityTypeFilter" style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px', color: 'var(--text-color)' }}>Entity Type</label>
            <select
              id="entityTypeFilter"
              value={filterEntityTypeId}
              onChange={(e) => setFilterEntityTypeId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: '#0d1117', color: 'var(--text-color)' }}
            >
              <option value="">All Entity Types</option>
              {entityTypes.map((type) => (
                <option key={type.entityTypeId} value={type.entityTypeId}>
                  {type.entityTypeName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={() => handleOpenEntityModal()} style={{ marginLeft: 'auto', flexShrink: 0, alignSelf: 'flex-end' }}>
          + Add New Entity
        </button>
      </div>

      {/* Entities Table */}
      <div className="table-container">
        <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--text-light)' }}>
          Total Entities: {entities.length} | Filtered: {filteredEntities.length}
        </div>
        {filteredEntities.length === 0 ? (
          <p className="empty-state">No entities found. Create your first entity!</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Entity Type</th>
                <th>Gender</th>
                <th>Birth Date</th>
                <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntities.map((entity, idx) => (
                <tr key={entity.entityId} className={idx % 2 === 0 ? 'even' : 'odd'}>
                  <td className="code-column">{entity.entityId}</td>
                  <td>{entity.entityFirstName}</td>
                  <td>{entity.entityLastName || '-'}</td>
                  <td>{entity.entityTypeName}</td>
                  <td className="gender-column">
                    {entity.gender === 'M' ? 'Male' : entity.gender === 'F' ? 'Female' : entity.gender === 'O' ? 'Other' : '-'}
                  </td>
                  <td className="date-column">{entity.birthDate ? entity.birthDate.split('T')[0] : '-'}</td>
                  <td className="actions-column">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleOpenEntityModal(entity)}
                      title="Edit entity"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteEntity(entity.entityId)}
                      title="Delete entity"
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Entity Modal */}
      {showEntityModal && (
        <div className="modal" onClick={handleCloseEntityModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === 'add' ? 'Add New Entity' : 'Edit Entity'}</h3>
            </div>

            <div className="modal-body">
              {/* Entity Details Section */}
              <div className="form-section">
                <h4>Entity Details</h4>

                <div className="form-group">
                  <label htmlFor="entityId">Entity ID* {modalMode === 'edit' && <span className="readonly-note">(read-only)</span>}</label>
                  <input
                    id="entityId"
                    type="text"
                    value={entityFormData.entityId}
                    onChange={(e) => setEntityFormData({ ...entityFormData, entityId: e.target.value })}
                    disabled={modalMode === 'edit'}
                    placeholder="e.g., 234567890"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="entityFirstName">First Name*</label>
                  <input
                    id="entityFirstName"
                    type="text"
                    value={entityFormData.entityFirstName}
                    onChange={(e) => setEntityFormData({ ...entityFormData, entityFirstName: e.target.value })}
                    placeholder="e.g., Tomer"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="entityLastName">Last Name</label>
                  <input
                    id="entityLastName"
                    type="text"
                    value={entityFormData.entityLastName}
                    onChange={(e) => setEntityFormData({ ...entityFormData, entityLastName: e.target.value })}
                    placeholder="e.g., Refael"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="entityTypeId">Entity Type*</label>
                  <select
                    id="entityTypeId"
                    value={entityFormData.entityTypeId}
                    onChange={(e) => setEntityFormData({ ...entityFormData, entityTypeId: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">Select Entity Type</option>
                    {entityTypes.map((type) => (
                      <option key={type.entityTypeId} value={type.entityTypeId}>
                        {type.entityTypeName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="gender">Gender</label>
                  <select
                    id="gender"
                    value={entityFormData.gender}
                    onChange={(e) => setEntityFormData({ ...entityFormData, gender: e.target.value })}
                  >
                    {genderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="birthDate">Birth Date</label>
                  <input
                    id="birthDate"
                    type="date"
                    value={entityFormData.birthDate}
                    onChange={(e) => setEntityFormData({ ...entityFormData, birthDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseEntityModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveEntity}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
