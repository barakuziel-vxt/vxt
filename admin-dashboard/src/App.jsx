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
import CustomerSubscriptionPage from './pages/CustomerSubscriptionPage';
import CustomerEntitiesPage from './pages/CustomerEntitiesPage';
import CustomerGeofencePage from './pages/CustomerGeofencePage';

export default function App() {
  const [currentPage, setCurrentPage] = useState('telemetry');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Close sidebar on mobile after selection
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

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
      case 'customerSubscription':
        return <CustomerSubscriptionPage />;
      case 'customerEntities':
        return <CustomerEntitiesPage />;
      case 'customerGeofence':
        return <CustomerGeofencePage />;
      default:
        return <EntityTelemetryAnalyticsPage />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <button 
          className="hamburger-menu"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <h1>VXT Admin Dashboard</h1>
      </header>

      <div className="app-container">
        <nav className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-close">
            <button 
              className="close-button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          <div className="nav-section">
            <h3>Protocol & Provider</h3>
            <button
              className={`nav-button ${currentPage === 'protocol' ? 'active' : ''}`}
              onClick={() => handlePageChange('protocol')}
            >
              📡 Protocols
            </button>
            <button
              className={`nav-button ${currentPage === 'protocolAttribute' ? 'active' : ''}`}
              onClick={() => handlePageChange('protocolAttribute')}
            >
              🔧 Protocol Attributes
            </button>
            <button
              className={`nav-button ${currentPage === 'provider' ? 'active' : ''}`}
              onClick={() => handlePageChange('provider')}
            >
              🔌 Providers
            </button>
            <button
              className={`nav-button ${currentPage === 'providerEvent' ? 'active' : ''}`}
              onClick={() => handlePageChange('providerEvent')}
            >
              📪 Provider Events
            </button>
          </div>

          <div className="nav-section">
            <h3>Configuration</h3>
            <button
              className={`nav-button ${currentPage === 'entityCategory' ? 'active' : ''}`}
              onClick={() => handlePageChange('entityCategory')}
            >
              📁 Entity Categories
            </button>
            <button
              className={`nav-button ${currentPage === 'entityType' ? 'active' : ''}`}
              onClick={() => handlePageChange('entityType')}
            >
              🏷️ Entity Types
            </button>
            <button
              className={`nav-button ${currentPage === 'entityTypeAttribute' ? 'active' : ''}`}
              onClick={() => handlePageChange('entityTypeAttribute')}
            >
              ⚙️ Entity Type Attributes
            </button>
            <button
              className={`nav-button ${currentPage === 'event' ? 'active' : ''}`}
              onClick={() => handlePageChange('event')}
            >
              📢 Events
            </button>
            <button
              className={`nav-button ${currentPage === 'entity' ? 'active' : ''}`}
              onClick={() => handlePageChange('entity')}
            >
              🚢 Entities
            </button>
            <button
              className={`nav-button ${currentPage === 'customerSubscription' ? 'active' : ''}`}
              onClick={() => handlePageChange('customerSubscription')}
            >
              👥 Customer Subscriptions
            </button>
            <button
              className={`nav-button ${currentPage === 'customerEntities' ? 'active' : ''}`}
              onClick={() => handlePageChange('customerEntities')}
            >
              🌍 Customer Entities
            </button>
            <button
              className={`nav-button ${currentPage === 'customerGeofence' ? 'active' : ''}`}
              onClick={() => handlePageChange('customerGeofence')}
            >
              🗺️ Customer Geofences
            </button>
          </div>

          <div className="nav-section">
            <h3>Data</h3>
            <button
              className={`nav-button ${currentPage === 'telemetry' ? 'active' : ''}`}
              onClick={() => handlePageChange('telemetry')}
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
