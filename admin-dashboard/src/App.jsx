import React, { useState, useEffect } from 'react';
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
import CustomerEntitiesPage from './pages/CustomerEntitiesPage';
import CustomerGeofenceRNPage from './pages/CustomerGeofenceRNPage';
import EntityTelemetryRNPage from './pages/EntityTelemetryRNPage';
import ReportManuallyRNPage from './pages/ReportManuallyRNPage';
import GatewayConfigPage from './pages/GatewayConfigPage';
import EntityIoTDevicePage from './pages/EntityIoTDevicePage';
import RegisterDevicePage from './pages/RegisterDevicePage';
import PushNotificationRNPage from './pages/PushNotificationRNPage';
import UserAuthorizationRNPage from './pages/UserAuthorizationRNPage';
import SubscriptionManagementRNPage from './pages/SubscriptionManagementRNPage';
import EntityAttributeRNPage from './pages/EntityAttributeRNPage';

export default function App() {
  const [navData, setNavData] = useState(null);

  // Listen for in-page navigation events (e.g., from ReportManuallyPage link to GatewayConfig)
  // Accepts string OR { page, data } for passing context between pages
  useEffect(() => {
    const handler = (e) => {
      const payload = e.detail;
      if (typeof payload === 'string') {
        setNavData(null);
        setCurrentPage(payload);
      } else if (payload && payload.page) {
        setNavData(payload.data || null);
        setCurrentPage(payload.page);
      }
    };
    window.addEventListener('vxt:navigate', handler);
    return () => window.removeEventListener('vxt:navigate', handler);
  }, []);
  // Support URL hash navigation (e.g. #telemetryRN) and embedded mode (?embedded=true)
  const urlParams = new URLSearchParams(window.location.search);
  const embedded = urlParams.get('embedded') === 'true';
  const hashPage = window.location.hash.replace('#', '');

  const [currentPage, setCurrentPage] = useState(hashPage || 'telemetryRN');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  const handlePageChange = (page) => {
    // In embedded mode (WebView), navigate to RN native screens
    if (embedded) {
      const rnScreenMap = {
        reportManually: 'ReportManually',
        userAuthorization: 'UserAuthorizations',
        pushNotification: 'PushNotifications',
      };
      if (rnScreenMap[page] && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'navigateRN', screen: rnScreenMap[page] }));
        return;
      }
    }
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
      case 'telemetryRN':
        return <EntityTelemetryRNPage />;
      case 'reportManually':
        return <ReportManuallyRNPage />;
      case 'gatewayConfig':
        return <GatewayConfigPage />;
      case 'entityIoTDevice':
        return <EntityIoTDevicePage entityId={navData?.entityId} entityName={navData?.entityName} />;
      case 'registerDevice':
        return <RegisterDevicePage entityId={navData?.entityId} entityName={navData?.entityName} />;
      case 'protocol':
        return <ProtocolPage />;
      case 'protocolAttribute':
        return <ProtocolAttributePage />;
      case 'provider':
        return <ProviderPage />;
      case 'providerEvent':
        return <ProviderEventPage />;
      case 'entityAttributeRN':
        return <EntityAttributeRNPage />;
      case 'customerSubscription':
        return <SubscriptionManagementRNPage />;
      case 'customerEntities':
        return <CustomerEntitiesPage />;
      case 'customerGeofence':
        return <CustomerGeofenceRNPage />;
      case 'pushNotification':
        return <PushNotificationRNPage />;
      case 'userAuthorization':
        return <UserAuthorizationRNPage />;
      default:
        return <EntityTelemetryRNPage />;
    }
  };

  // Embedded mode: render only the page without header/sidebar (for WebView)
  if (embedded) {
    return (
      <div className="app" style={{ padding: 0 }}>
        <main className="app-main" style={{ marginLeft: 0 }}>
          {renderPage()}
        </main>
      </div>
    );
  }

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
              className={`nav-button ${currentPage === 'entityAttributeRN' ? 'active' : ''}`}
              onClick={() => handlePageChange('entityAttributeRN')}
            >
              📱 Entity Attributes (RN)
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
              📋 Customer Subscriptions
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
              🗺️ Geofences
            </button>
          </div>

          <div className="nav-section">
            <h3>Users & Notifications</h3>
            <button
              className={`nav-button ${currentPage === 'userAuthorization' ? 'active' : ''}`}
              onClick={() => handlePageChange('userAuthorization')}
            >
              🔑 User Authorizations
            </button>
            <button
              className={`nav-button ${currentPage === 'pushNotification' ? 'active' : ''}`}
              onClick={() => handlePageChange('pushNotification')}
            >
              🔔 Push Notifications
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
            <button
              className={`nav-button ${currentPage === 'telemetryRN' ? 'active' : ''}`}
              onClick={() => handlePageChange('telemetryRN')}
            >
              📱 Entity Telemetry
            </button>
            <button
              className={`nav-button ${currentPage === 'reportManually' ? 'active' : ''}`}
              onClick={() => handlePageChange('reportManually')}
            >
              📝 Report Manually
            </button>
          </div>

          <div className="nav-section">
            <h3>Gateway</h3>
            <button
              className={`nav-button ${currentPage === 'gatewayConfig' ? 'active' : ''}`}
              onClick={() => handlePageChange('gatewayConfig')}
            >
              ⚡ Gateway Config
            </button>
            <button
              className={`nav-button ${currentPage === 'entityIoTDevice' ? 'active' : ''}`}
              onClick={() => handlePageChange('entityIoTDevice')}
            >
              📡 IoT Devices
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
