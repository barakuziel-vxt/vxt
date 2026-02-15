import React, { useState, useEffect } from 'react';
import { entityCategoryAPI } from '../services/api';

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

export default function EntityCategoryPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    entityCategoryName: '',
    active: 'Y',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await entityCategoryAPI.getAll();
      setCategories(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingId(category.entityCategoryId);
      setFormData({
        entityCategoryName: category.entityCategoryName,
        active: category.active,
      });
    } else {
      setEditingId(null);
      setFormData({
        entityCategoryName: '',
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
        await entityCategoryAPI.update(editingId, formData);
        setError(null);
      } else {
        await entityCategoryAPI.create(formData);
        setError(null);
      }
      await loadCategories();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        await entityCategoryAPI.delete(id);
        await loadCategories();
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Entity Categories</h2>
        <p>Manage entity categories (Yacht, Person, Stock, Vehicle)</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="action-bar">
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + Add New Category
        </button>
      </div>

      {loading ? (
        <div className="empty-state">
          <h3>Loading...</h3>
        </div>
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <h3>No categories found</h3>
          <p>Create your first entity category to get started</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Category Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.entityCategoryId}>
                  <td>{category.entityCategoryId}</td>
                  <td>{category.entityCategoryName}</td>
                  <td>
                    <span className={`badge badge-${category.active === 'Y' ? 'active' : 'inactive'}`}>
                      {category.active === 'Y' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(category.createDate)}</td>
                  <td>{formatDate(category.lastUpdateTimestamp)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleOpenModal(category)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => handleDelete(category.entityCategoryId)}
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
              <h3>{editingId ? 'Edit Category' : 'Add New Category'}</h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="entityCategoryName">Category Name *</label>
                <input
                  type="text"
                  id="entityCategoryName"
                  name="entityCategoryName"
                  value={formData.entityCategoryName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Yacht, Person, Stock, Vehicle"
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
                  {editingId ? 'Update' : 'Create'} Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
