import React, { useState } from 'react';
import './App.css';
import EntityCategoryPage from './pages/EntityCategoryPage';
import EntityTypePage from './pages/EntityTypePage';
import EntityTypeAttributePage from './pages/EntityTypeAttributePage';
import EntityPage from './pages/EntityPage';
import EventPage from './pages/EventPage';
import EntityTelemetryAnalyticsPage from './pages/EntityTelemetryAnalyticsPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState('entityCategory');

  const renderPage = () => {
    switch (currentPage) {
      case 'entityCategory':
        return <EntityCategoryPage />;
      case 'entityType':
        return <EntityTypePage />;
      case 'entityTypeAttribute':
        return <EntityTypeAttributePage />;
      case 'entity':
        return <EntityPage />;
      case 'event':
        return <EventPage />;
      case 'telemetry':
        return <EntityTelemetryAnalyticsPage />;
      default:
        return <EntityCategoryPage />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>VXT Admin Dashboard</h1>
        <p>Configuration Management System</p>
      </header>

      <div className="app-container">
        <nav className="app-sidebar">
          <div className="nav-section">
            <h3>Configuration Management</h3>
            <button
              className={`nav-button ${currentPage === 'entityCategory' ? 'active' : ''}`}
              onClick={() => setCurrentPage('entityCategory')}
            >
              📁 Entity Categories
            </button>
            <button
              className={`nav-button ${currentPage === 'entityType' ? 'active' : ''}`}
              onClick={() => setCurrentPage('entityType')}
            >
              🏷️ Entity Types
            </button>
            <button
              className={`nav-button ${currentPage === 'entityTypeAttribute' ? 'active' : ''}`}
              onClick={() => setCurrentPage('entityTypeAttribute')}
            >
              ⚙️ Entity Type Attributes
            </button>
            <button
              className={`nav-button ${currentPage === 'event' ? 'active' : ''}`}
              onClick={() => setCurrentPage('event')}
            >
              📢 Events
            </button>
          </div>

          <div className="nav-section">
            <h3>Data Management</h3>
            <button
              className={`nav-button ${currentPage === 'entity' ? 'active' : ''}`}
              onClick={() => setCurrentPage('entity')}
            >
              🚢 Entities
            </button>
            <button
              className={`nav-button ${currentPage === 'telemetry' ? 'active' : ''}`}
              onClick={() => setCurrentPage('telemetry')}
            >
              📊 Telemetry & Events
            </button>
          </div>

          <div className="nav-section">
            <h3>Quick Links</h3>
            <a href="http://localhost:3000" className="nav-link" target="_blank" rel="noopener noreferrer">
              📊 Boat Dashboard
            </a>
            <a href="http://localhost:3002" className="nav-link" target="_blank" rel="noopener noreferrer">
              🏥 Health Dashboard
            </a>
          </div>
        </nav>

        <main className="app-main">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
