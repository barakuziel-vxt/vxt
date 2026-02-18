import React, { useState, useEffect } from 'react';
import { eventAPI, eventAttributeAPI, analyzeFunctionAPI, entityTypeAttributeScoreAPI } from '../services/eventApi';
import { entityTypeAPI } from '../services/api';
import { entityTypeAttributeAPI } from '../services/api';
import '../styles/ManagementPage.css';

export default function EventPage() {
  // State for events
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventFormData, setEventFormData] = useState({
    eventCode: '',
    eventDescription: '',
    entityTypeId: '',
    minCumulatedScore: 0,
    maxCumulatedScore: 100,
    risk: 'NONE',
    AnalyzeFunctionId: '',
    LookbackMinutes: '',
    BaselineDays: '',
    SensitivityThreshold: '',
    MinSamplesRequired: '',
    CustomParams: ''
  });

  // State for filters
  const [filterEntityTypeId, setFilterEntityTypeId] = useState('');

  // State for dropdowns
  const [entityTypes, setEntityTypes] = useState([]);
  const [analyzeFunctions, setAnalyzeFunctions] = useState([]);
  const [entityTypeAttributes, setEntityTypeAttributes] = useState([]);
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [eventAttributesByEvent, setEventAttributesByEvent] = useState({}); // Store attributes grouped by event
  const [selectedAttributeScores, setSelectedAttributeScores] = useState({}); // Store scores for selected attributes

  // State for modals and error handling
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadEntityTypes();
    loadAnalyzeFunctions();
    loadEvents();
  }, []);

  // Load events when filter changes
  useEffect(() => {
    loadEvents();
  }, [filterEntityTypeId]);

  // Load attributes when entity type changes
  useEffect(() => {
    if (eventFormData.entityTypeId) {
      loadEntityTypeAttributesByType(eventFormData.entityTypeId);
      // Clear scores and selected attributes when entity type changes
      setSelectedAttributes([]);
      setSelectedAttributeScores({});
    }
  }, [eventFormData.entityTypeId]);

  // Load event attributes when event changes
  useEffect(() => {
    if (selectedEvent) {
      loadEventAttributes(selectedEvent.eventId);
    }
  }, [selectedEvent]);

  const loadEntityTypes = async () => {
    try {
      const data = await entityTypeAPI.getAll();
      setEntityTypes(data);
    } catch (error) {
      console.error('Error loading entity types:', error);
    }
  };

  const loadAnalyzeFunctions = async () => {
    try {
      const data = await analyzeFunctionAPI.getAll();
      setAnalyzeFunctions(data);
    } catch (error) {
      console.error('Error loading analyze functions:', error);
    }
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading events with filter:', filterEntityTypeId);
      const params = filterEntityTypeId ? parseInt(filterEntityTypeId) : null;
      const data = await eventAPI.getAll(params);
      console.log('Events loaded:', data);
      setEvents(data);
      // Load all event attributes for counting in table
      const allAttributes = await eventAttributeAPI.getAll();
      const attributesByEvent = {};
      allAttributes.forEach((attr) => {
        if (!attributesByEvent[attr.eventId]) {
          attributesByEvent[attr.eventId] = [];
        }
        attributesByEvent[attr.eventId].push(attr);
      });
      setEventAttributesByEvent(attributesByEvent);
    } catch (error) {
      console.error('Error loading events:', error);
      setError('Failed to load events: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadEntityTypeAttributesByType = async (entityTypeId) => {
    try {
      const data = await entityTypeAttributeAPI.getAll(entityTypeId);
      setEntityTypeAttributes(data);
    } catch (error) {
      console.error('Error loading entity type attributes:', error);
    }
  };

  const loadEventAttributes = async (eventId) => {
    try {
      const data = await eventAttributeAPI.getAll(eventId);
      // Store attributes grouped by event
      setEventAttributesByEvent((prev) => ({
        ...prev,
        [eventId]: data
      }));
      // Set selectedAttributes for the edit modal
      setSelectedAttributes(data.map((attr) => attr.entityTypeAttributeId));
    } catch (error) {
      console.error('Error loading event attributes:', error);
    }
  };

  const getFilteredEvents = () => {
    if (!filterEntityTypeId) return events;
    return events.filter((e) => e.entityTypeId === parseInt(filterEntityTypeId));
  };

  const handleOpenEventModal = (event = null) => {
    if (event) {
      setModalMode('edit');
      setSelectedEvent(event);
      setEventFormData({
        eventCode: event.eventCode,
        eventDescription: event.eventDescription,
        entityTypeId: event.entityTypeId,
        minCumulatedScore: event.minCumulatedScore || 0,
        maxCumulatedScore: event.maxCumulatedScore || 100,
        risk: event.risk || 'NONE',
        AnalyzeFunctionId: event.AnalyzeFunctionId || '',
        LookbackMinutes: event.LookbackMinutes || '',
        BaselineDays: event.BaselineDays || '',
        SensitivityThreshold: event.SensitivityThreshold || '',
        MinSamplesRequired: event.MinSamplesRequired || '',
        CustomParams: event.CustomParams || ''
      });
      // selectedAttributes will be set by loadEventAttributes
    } else {
      setModalMode('add');
      setSelectedEvent(null);
      setEventFormData({
        eventCode: '',
        eventDescription: '',
        entityTypeId: '',
        minCumulatedScore: 0,
        maxCumulatedScore: 100,
        risk: 'NONE',
        AnalyzeFunctionId: '',
        LookbackMinutes: '',
        BaselineDays: '',
        SensitivityThreshold: '',
        MinSamplesRequired: '',
        CustomParams: ''
      });
      // Only clear selectedAttributes when adding
      setSelectedAttributes([]);
    }
    setShowEventModal(true);
  };

  const handleCloseEventModal = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
    setEventFormData({
      eventCode: '',
      eventDescription: '',
      entityTypeId: '',
      minCumulatedScore: 0,
      maxCumulatedScore: 100,
      risk: 'NONE',
      AnalyzeFunctionId: '',
      LookbackMinutes: '',
      BaselineDays: '',
      SensitivityThreshold: '',
      MinSamplesRequired: '',
      CustomParams: ''
    });
    setSelectedAttributes([]);
    setSelectedAttributeScores({});
  };

  const handleEventFormChange = (e) => {
    const { name, value } = e.target;
    setEventFormData((prev) => ({
      ...prev,
      [name]: name.includes('Minutes') || name.includes('Days') || name.includes('Samples') 
        ? (value ? parseInt(value) : '')
        : name.includes('Threshold') 
        ? (value ? parseFloat(value) : '')
        : value
    }));
  };

  const handleSaveEvent = async () => {
    try {
      if (modalMode === 'add') {
        await eventAPI.create(eventFormData);
      } else {
        await eventAPI.update(selectedEvent.eventId, eventFormData);
      }

      // Save selected attributes
      if (modalMode === 'add' && eventFormData.eventCode) {
        const newEvent = events.find((e) => e.eventCode === eventFormData.eventCode);
        if (newEvent) {
          for (const attrId of selectedAttributes) {
            await eventAttributeAPI.create(newEvent.eventId, attrId);
          }
        }
      } else if (modalMode === 'edit' && selectedEvent) {
        // Get current attributes for this event
        const currentEventAttrs = eventAttributesByEvent[selectedEvent.eventId] || [];
        const currentAttrIds = currentEventAttrs.map((ea) => ea.entityTypeAttributeId);
        
        // Remove attributes not in selection
        const attrsToRemove = currentAttrIds.filter((id) => !selectedAttributes.includes(id));
        for (const attrId of attrsToRemove) {
          await eventAttributeAPI.delete(selectedEvent.eventId, attrId);
        }

        // Add new attributes
        for (const attrId of selectedAttributes) {
          if (!currentAttrIds.includes(attrId)) {
            await eventAttributeAPI.create(selectedEvent.eventId, attrId);
          }
        }
      }

      await loadEvents();
      handleCloseEventModal();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await eventAPI.delete(eventId);
        await loadEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  const toggleAttribute = (attributeId) => {
    const isCurrentlySelected = selectedAttributes.includes(attributeId);
    
    if (isCurrentlySelected) {
      // Remove the attribute
      setSelectedAttributes((prev) => prev.filter((id) => id !== attributeId));
      // Remove from scores
      setSelectedAttributeScores((prev) => {
        const updated = { ...prev };
        delete updated[attributeId];
        return updated;
      });
    } else {
      // Add the attribute
      setSelectedAttributes((prev) => [...prev, attributeId]);
      // Load scores
      loadAttributeScores(attributeId);
    }
  };

  const loadAttributeScores = async (attributeId) => {
    try {
      const scores = await entityTypeAttributeScoreAPI.getByAttributeId(attributeId);
      setSelectedAttributeScores((prev) => ({
        ...prev,
        [attributeId]: scores
      }));
    } catch (error) {
      console.error('Error loading attribute scores:', error);
    }
  };

  const filteredEvents = getFilteredEvents();

  const getAnalyzeFunctionName = (functionId) => {
    const func = analyzeFunctions.find((f) => f.AnalyzeFunctionId === functionId);
    return func ? func.FunctionName : 'N/A';
  };

  const getEntityTypeName = (typeId) => {
    const type = entityTypes.find((t) => t.entityTypeId === typeId);
    return type ? type.entityTypeName : 'N/A';
  };

  return (
    <div className="management-page">
      <h1>Event Management</h1>
      {error && <div style={{color:'#ff6666', padding:'10px', backgroundColor:'#3a1a1a', marginBottom:'10px', borderRadius:'4px', border:'1px solid #5f2d2d'}}>{error}</div>}
      {loading && <p>Loading...</p>}

      {/* Filters */}
      <div className="filter-section">
        <label htmlFor="filterEntityType">Entity Type:</label>
        <select
          id="filterEntityType"
          value={filterEntityTypeId}
          onChange={(e) => setFilterEntityTypeId(e.target.value)}
          className="filter-select"
        >
          <option value="">ALL</option>
          {entityTypes.map((type) => (
            <option key={type.entityTypeId} value={type.entityTypeId}>
              {type.entityTypeName}
            </option>
          ))}
        </select>
      </div>

      {/* Add Event Button */}
      <button className="add-button" onClick={() => handleOpenEventModal()}>
        + Add New Event
      </button>

      {/* Events Table */}
      <div className="table-container">
        {filteredEvents.length === 0 ? (
          <p className="no-data">No events found</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Event Code</th>
                <th>Description</th>
                <th>Entity Type</th>
                <th>Risk Level</th>
                <th>Analyze Function</th>
                <th>Attributes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.eventId}>
                  <td>{event.eventCode}</td>
                  <td>{event.eventDescription}</td>
                  <td>{getEntityTypeName(event.entityTypeId)}</td>
                  <td>
                    <span className={`risk-badge risk-${event.risk.toLowerCase()}`}>
                      {event.risk}
                    </span>
                  </td>
                  <td>{event.AnalyzeFunctionId ? getAnalyzeFunctionName(event.AnalyzeFunctionId) : '-'}</td>
                  <td>
                    {(eventAttributesByEvent[event.eventId] || []).length} mapped
                  </td>
                  <td>
                    <button
                      className="action-button edit"
                      onClick={() => {
                        setSelectedEvent(event);
                        loadEventAttributes(event.eventId);
                        handleOpenEventModal(event);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="action-button delete"
                      onClick={() => handleDeleteEvent(event.eventId)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                {modalMode === 'add' ? 'Create New Event' : 'Edit Event'}
              </h2>
              <button className="close-button" onClick={handleCloseEventModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <form>
                {/* Event Details Section */}
                <div className="form-section">
                  <h3>Event Details</h3>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Entity Type *</label>
                      <select
                        name="entityTypeId"
                        value={eventFormData.entityTypeId}
                        onChange={handleEventFormChange}
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
                      <label>Event Code *</label>
                      <input
                        type="text"
                        name="eventCode"
                        value={eventFormData.eventCode}
                        onChange={handleEventFormChange}
                        placeholder="e.g., NEWSTemperatureLowMedium"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Event Description *</label>
                    <input
                      type="text"
                      name="eventDescription"
                      value={eventFormData.eventDescription}
                      onChange={handleEventFormChange}
                      placeholder="e.g., NEWS: Body temperature concern"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Risk Level</label>
                      <select
                        name="risk"
                        value={eventFormData.risk}
                        onChange={handleEventFormChange}
                      >
                        <option value="NONE">NONE</option>
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="CRITICAL">CRITICAL</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Min Cumulated Score</label>
                      <input
                        type="number"
                        name="minCumulatedScore"
                        value={eventFormData.minCumulatedScore}
                        onChange={handleEventFormChange}
                      />
                    </div>

                    <div className="form-group">
                      <label>Max Cumulated Score</label>
                      <input
                        type="number"
                        name="maxCumulatedScore"
                        value={eventFormData.maxCumulatedScore}
                        onChange={handleEventFormChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Analysis Configuration Section */}
                <div className="form-section">
                  <h3>Analysis Configuration (Optional)</h3>

                  <div className="form-group">
                    <label>Analyze Function</label>
                    <select
                      name="AnalyzeFunctionId"
                      value={eventFormData.AnalyzeFunctionId}
                      onChange={handleEventFormChange}
                    >
                      <option value="">None</option>
                      {analyzeFunctions.map((func) => (
                        <option key={func.AnalyzeFunctionId} value={func.AnalyzeFunctionId}>
                          {func.FunctionName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Lookback Minutes</label>
                      <input
                        type="number"
                        name="LookbackMinutes"
                        value={eventFormData.LookbackMinutes}
                        onChange={handleEventFormChange}
                        placeholder="e.g., 360"
                      />
                    </div>

                    <div className="form-group">
                      <label>Baseline Days</label>
                      <input
                        type="number"
                        name="BaselineDays"
                        value={eventFormData.BaselineDays}
                        onChange={handleEventFormChange}
                        placeholder="e.g., 30"
                      />
                    </div>

                    <div className="form-group">
                      <label>Sensitivity Threshold (0.0-1.0)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        name="SensitivityThreshold"
                        value={eventFormData.SensitivityThreshold}
                        onChange={handleEventFormChange}
                        placeholder="0.5"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Min Samples Required</label>
                    <input
                      type="number"
                      name="MinSamplesRequired"
                      value={eventFormData.MinSamplesRequired}
                      onChange={handleEventFormChange}
                      placeholder="e.g., 10"
                    />
                  </div>

                  <div className="form-group">
                    <label>Custom Parameters (JSON)</label>
                    <textarea
                      name="CustomParams"
                      value={eventFormData.CustomParams}
                      onChange={handleEventFormChange}
                      placeholder='{"key": "value"}'
                      rows="3"
                    />
                  </div>
                </div>

                {/* Attributes Section */}
                {eventFormData.entityTypeId && (
                  <div className="form-section">
                    <h3>Associated Attributes</h3>
                    <div className="checkbox-group">
                      {entityTypeAttributes.length === 0 ? (
                        <p className="no-data">No attributes available for this entity type</p>
                      ) : (
                        entityTypeAttributes.map((attr) => (
                          <label key={attr.entityTypeAttributeId} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={selectedAttributes.includes(attr.entityTypeAttributeId)}
                              onChange={() => toggleAttribute(attr.entityTypeAttributeId)}
                            />
                            <span>{attr.entityTypeAttributeName} ({attr.entityTypeAttributeCode})</span>
                          </label>
                        ))
                      )}
                    </div>

                    {/* Attribute Scores Display - Dynamic based on event function type */}
                    {Object.keys(selectedAttributeScores).length > 0 && (
                      <div className="scores-display">
                        {/* Check if this is a PYTHON AI function */}
                        {eventFormData.AnalyzeFunctionId && (function() {
                          const func = analyzeFunctions.find((f) => f.AnalyzeFunctionId === eventFormData.AnalyzeFunctionId);
                          const isPythonFunction = func && func.FunctionType === 'PYTHON';
                          
                          if (isPythonFunction) {
                            return (
                              <div>
                                <h4>Analysis Metadata (AI Function)</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                                  Dynamic analysis statistics will be captured when events are triggered. 
                                  This will include baseline comparisons, statistical findings, and confidence metrics.
                                </p>
                                <div style={{ 
                                  backgroundColor: '#1a3a1a', 
                                  padding: '12px', 
                                  borderRadius: '4px',
                                  borderLeft: '4px solid #44dd44',
                                  color: '#44dd44'
                                }}>
                                  <strong>✓ Python/AI Function:</strong> Analysis metadata will be stored in EventLog and displayed when events are triggered.
                                </div>
                              </div>
                            );
                          } else {
                            // TSQL or predefined function - show scoring ranges
                            return (
                              <div>
                                <h4>Value Scores for Selected Attributes</h4>
                                {Object.entries(selectedAttributeScores).map(([attrId, scores]) => {
                                  const attr = entityTypeAttributes.find(
                                    (a) => a.entityTypeAttributeId === parseInt(attrId)
                                  );
                                  return (
                                    <div key={attrId} className="attribute-scores">
                                      <h5>{attr?.entityTypeAttributeName} ({attr?.entityTypeAttributeCode})</h5>
                                      {scores && scores.length > 0 ? (
                                        <table className="scores-table">
                                          <thead>
                                            <tr>
                                              <th>Min Value</th>
                                              <th>Max Value</th>
                                              <th>Score</th>
                                              <th>String Value</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {scores.sort((a, b) => {
                                              if (a.minValue === null) return 1;
                                              if (b.minValue === null) return -1;
                                              return a.minValue - b.minValue;
                                            }).map((score, idx) => (
                                              <tr key={idx}>
                                                <td>{score.minValue !== null ? score.minValue : '-'}</td>
                                                <td>{score.maxValue !== null ? score.maxValue : '-'}</td>
                                                <td><strong>{score.score}</strong></td>
                                                <td>{score.strValue || '-'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      ) : (
                                        <p className="no-data">No value scores configured for this attribute</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
            <div className="modal-footer">
              <button className="button-cancel" onClick={handleCloseEventModal}>
                Cancel
              </button>
              <button className="button-save" onClick={handleSaveEvent}>
                {modalMode === 'add' ? 'Create Event' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
