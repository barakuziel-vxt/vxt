import React, { useState, useEffect } from 'react';
import { entityTypeAPI, entityCategoryAPI } from '../services/api';

// Format date to local timezone (UTC->local conversion)
const formatDate = (dateString) => {
  try {
    // Database returns UTC timestamps without 'Z' suffix
    // Add 'Z' to ensure JavaScript parses as UTC, then convert to local time
    const utcString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
    const date = new Date(utcString);
    return date.toLocaleString();
  } catch {
    return dateString;
  }
};

export default function EntityTypePage() {
  const [entityTypes, setEntityTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    entityTypeName: '',
    entityCategoryId: '',
    active: 'Y',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [typesData, categoriesData] = await Promise.all([
        entityTypeAPI.getAll(),
        entityCategoryAPI.getAll(),
      ]);
      setEntityTypes(typesData);
      setCategories(categoriesData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (entityType = null) => {
    if (entityType) {
      setEditingId(entityType.entityTypeId);
      setFormData({
        entityTypeName: entityType.entityTypeName,
        entityCategoryId: entityType.entityCategoryId,
        active: entityType.active,
      });
    } else {
      setEditingId(null);
      setFormData({
        entityTypeName: '',
        entityCategoryId: '',
        active: 'Y',
      });
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await entityTypeAPI.update(editingId, formData);
      } else {
        await entityTypeAPI.create(formData);
      }
      await loadData();
      handleCloseModal();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this entity type?')) {
      try {
        await entityTypeAPI.delete(id);
        await loadData();
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find((c) => c.entityCategoryId === categoryId);
    return category ? category.entityCategoryName : 'Unknown';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Entity Types</h2>
        <p>Manage entity types (Person, Yacht, Boat models, etc.)</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="action-bar">
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + Add New Entity Type
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <h3>Loading...</h3>
        </div>
      ) : entityTypes.length === 0 ? (
        <div className="empty-state">
          <h3>No entity types found</h3>
          <p>Create your first entity type to get started</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Entity Type Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entityTypes.map((type) => (
                <tr key={type.entityTypeId}>
                  <td>{type.entityTypeId}</td>
                  <td>{type.entityTypeName}</td>
                  <td>{getCategoryName(type.entityCategoryId)}</td>
                  <td>
                    <span className={`badge badge-${type.active === 'Y' ? 'active' : 'inactive'}`}>
                      {type.active === 'Y' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(type.createDate)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleOpenModal(type)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => handleDelete(type.entityTypeId)}
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
              <h3>{editingId ? 'Edit Entity Type' : 'Add New Entity Type'}</h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="entityTypeName">Entity Type Name *</label>
                <input
                  type="text"
                  id="entityTypeName"
                  name="entityTypeName"
                  value={formData.entityTypeName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Person, Lagoon 380, Elan Impression 40"
                />
              </div>

              <div className="form-group">
                <label htmlFor="entityCategoryId">Category *</label>
                <select
                  id="entityCategoryId"
                  name="entityCategoryId"
                  value={formData.entityCategoryId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.entityCategoryId} value={category.entityCategoryId}>
                      {category.entityCategoryName}
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
                  {editingId ? 'Update' : 'Create'} Entity Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
