import React, { useState, useEffect } from 'react';
import { providerAPI } from '../services/api';

export default function ProviderPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterName, setFilterName] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterApiVersion, setFilterApiVersion] = useState('');
  const [formData, setFormData] = useState({
    providerName: '',
    providerDescription: '',
    providerCategory: '',
    apiVersion: '',
    documentationUrl: '',
    active: 'Y',
  });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const data = await providerAPI.getAll();
      setProviders(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (provider = null) => {
    if (provider) {
      setEditingId(provider.providerId);
      setFormData({
        providerName: provider.providerName,
        providerDescription: provider.providerDescription || '',
        providerCategory: provider.providerCategory || '',
        apiVersion: provider.apiVersion || '',
        documentationUrl: provider.documentationUrl || '',
        active: provider.active || 'Y',
      });
    } else {
      setEditingId(null);
      setFormData({
        providerName: '',
        providerDescription: '',
        providerCategory: '',
        apiVersion: '',
        documentationUrl: '',
        active: 'Y',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      providerName: '',
      providerDescription: '',
      providerCategory: '',
      apiVersion: '',
      documentationUrl: '',
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
        await providerAPI.update(editingId, formData);
      } else {
        await providerAPI.create(formData);
      }
      await loadProviders();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this provider? This may affect associated events.')) {
      try {
        await providerAPI.delete(id);
        await loadProviders();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getFilteredProviders = () => {
    let filtered = providers;
    
    if (filterName) {
      filtered = filtered.filter((p) =>
        p.providerName.toLowerCase().includes(filterName.toLowerCase())
      );
    }
    if (filterDescription) {
      filtered = filtered.filter((p) =>
        p.providerDescription?.toLowerCase().includes(filterDescription.toLowerCase())
      );
    }
    if (filterCategory) {
      filtered = filtered.filter((p) =>
        p.providerCategory?.toLowerCase().includes(filterCategory.toLowerCase())
      );
    }
    if (filterApiVersion) {
      filtered = filtered.filter((p) =>
        p.apiVersion?.toLowerCase().includes(filterApiVersion.toLowerCase())
      );
    }
    
    return filtered;
  };

  return (
    <div className="page">
      <h2>Data Provider Management</h2>
      <p className="page-subtitle">Manage telemetry data providers (Junction, Terra, SignalK, etc.)</p>

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
              Category
            </label>
            <input
              type="text"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              placeholder="Search category..."
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
              API Version
            </label>
            <input
              type="text"
              value={filterApiVersion}
              onChange={(e) => setFilterApiVersion(e.target.value)}
              placeholder="Search version..."
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
      ) : getFilteredProviders().length === 0 ? (
        <div className="empty-state">
          <h3>{providers.length === 0 ? 'No providers found' : 'No providers match the selected filter'}</h3>
          <p>{providers.length === 0 ? 'Create your first data provider to get started' : 'Try adjusting your filters'}</p>
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: '1400px' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Description</th>
                <th>Category</th>
                <th>API Version</th>
                <th style={{ maxWidth: '200px' }}>Doc URL</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredProviders().map((provider) => (
                <tr key={provider.providerId}>
                  <td>{provider.providerId}</td>
                  <td>
                    <strong>{provider.providerName}</strong>
                  </td>
                  <td>
                    <small>{provider.providerDescription || '—'}</small>
                  </td>
                  <td>
                    {provider.providerCategory ? (
                      <span>{provider.providerCategory}</span>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {provider.apiVersion ? (
                      <span>{provider.apiVersion}</span>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <small
                      style={{
                        color: 'var(--text-light)',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={provider.documentationUrl || ''}
                    >
                      {provider.documentationUrl ? (
                        <a href={provider.documentationUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)' }}>
                          Docs
                        </a>
                      ) : (
                        '—'
                      )}
                    </small>
                  </td>
                  <td>
                    <span>
                      {provider.active === 'Y' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleOpenModal(provider)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleDelete(provider.providerId)}
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
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Provider' : 'Add New Provider'}</h3>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="providerName">Provider Name *</label>
                <input
                  type="text"
                  id="providerName"
                  name="providerName"
                  value={formData.providerName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Junction, Terra, SignalK"
                />
              </div>

              <div className="form-group">
                <label htmlFor="providerCategory">Category</label>
                <input
                  type="text"
                  id="providerCategory"
                  name="providerCategory"
                  value={formData.providerCategory}
                  onChange={handleInputChange}
                  placeholder="e.g., HealthData, Wearable, Clinical"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="apiVersion">API Version</label>
                  <input
                    type="text"
                    id="apiVersion"
                    name="apiVersion"
                    value={formData.apiVersion}
                    onChange={handleInputChange}
                    placeholder="e.g., v1, v2"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="providerDescription">Description</label>
                <textarea
                  id="providerDescription"
                  name="providerDescription"
                  value={formData.providerDescription}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Detailed description of this data provider and its data types"
                />
              </div>

              <div className="form-group">
                <label htmlFor="documentationUrl">Documentation URL</label>
                <input
                  type="url"
                  id="documentationUrl"
                  name="documentationUrl"
                  value={formData.documentationUrl}
                  onChange={handleInputChange}
                  placeholder="https://docs.provider.com"
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
                  {editingId ? 'Update' : 'Create'} Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
