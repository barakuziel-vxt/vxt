import React, { useState } from 'react';
import './App.css';
import EntityCategoryPage from './pages/EntityCategoryPage';
import EntityTypePage from './pages/EntityTypePage';
import EntityTypeAttributePage from './pages/EntityTypeAttributePage';
import EntityPage from './pages/EntityPage';
import EventPage from './pages/EventPage';
import EntityTelemetryAnalyticsPage from './pages/EntityTelemetryAnalyticsPage';
import ProtocolPage from './pages/ProtocolPage';
import ProtocolAttributePage from './pages/ProtocolAttributePage';
import ProviderPage from './pages/ProviderPage';
import ProviderEventPage from './pages/ProviderEventPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState('telemetry');

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
      case 'protocol':
        return <ProtocolPage />;
      case 'protocolAttribute':
        return <ProtocolAttributePage />;
      case 'provider':
        return <ProviderPage />;
      case 'providerEvent':
        return <ProviderEventPage />;
      default:
        return <EntityTelemetryAnalyticsPage />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>VXT Admin Dashboard</h1>
      </header>

      <div className="app-container">
        <nav className="app-sidebar">
          <div className="nav-section">
            <h3>Protocol & Provider</h3>
            <button
              className={`nav-button ${currentPage === 'protocol' ? 'active' : ''}`}
              onClick={() => setCurrentPage('protocol')}
            >
              📡 Protocols
            </button>
            <button
              className={`nav-button ${currentPage === 'protocolAttribute' ? 'active' : ''}`}
              onClick={() => setCurrentPage('protocolAttribute')}
            >
              🔧 Protocol Attributes
            </button>
            <button
              className={`nav-button ${currentPage === 'provider' ? 'active' : ''}`}
              onClick={() => setCurrentPage('provider')}
            >
              🔌 Providers
            </button>
            <button
              className={`nav-button ${currentPage === 'providerEvent' ? 'active' : ''}`}
              onClick={() => setCurrentPage('providerEvent')}
            >
              📪 Provider Events
            </button>
          </div>

          <div className="nav-section">
            <h3>Configuration</h3>
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
            <button
              className={`nav-button ${currentPage === 'entity' ? 'active' : ''}`}
              onClick={() => setCurrentPage('entity')}
            >
              🚢 Entities
            </button>
          </div>

          <div className="nav-section">
            <h3>Data</h3>
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
