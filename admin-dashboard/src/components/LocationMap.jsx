import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component to recenter map
function RecenterMap({ positions }) {
  const map = useMap();
  
  useEffect(() => {
    if (!positions || positions.length === 0) return;
    
    // Calculate bounds
    const lats = positions.map(p => p.lat).filter(l => l != null);
    const lons = positions.map(p => p.lon).filter(l => l != null);
    
    if (lats.length === 0 || lons.length === 0) return;
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    
    // Add padding
    const latPad = (maxLat - minLat) * 0.1 || 0.05;
    const lonPad = (maxLon - minLon) * 0.1 || 0.05;
    
    const bounds = [
      [minLat - latPad, minLon - lonPad],
      [maxLat + latPad, maxLon + lonPad]
    ];
    
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [positions, map]);
  
  return null;
}

export default function LocationMap({ telemetryData, title = 'Location History' }) {
  // Extract location data from telemetry
  const locationPoints = React.useMemo(() => {
    if (!Array.isArray(telemetryData) || telemetryData.length === 0) {
      return [];
    }
    
    return telemetryData
      .map(record => {
        // Extract latitude and longitude from record columns
        // Could be stored as direct columns or need to map from attribute codes
        let lat = null;
        let lon = null;
        
        // Check for direct latitude/longitude columns
        if (record.latitude != null && record.longitude != null) {
          lat = record.latitude;
          lon = record.longitude;
        } else {
          // Try to find by attribute name/code patterns
          Object.entries(record).forEach(([key, value]) => {
            // Match latitude patterns
            if ((key.toLowerCase().includes('latitude') || 
                 key.includes('navigation.latitude') ||
                 key === 'latitude') && lat === null &&typeof value === 'number') {
              lat = value;
            }
            // Match longitude patterns
            if ((key.toLowerCase().includes('longitude') || 
                 key.includes('navigation.longitude') ||
                 key === 'longitude') && lon === null && typeof value === 'number') {
              lon = value;
            }
          });
        }
        
        return {
          lat: typeof lat === 'number' ? lat : null,
          lon: typeof lon === 'number' ? lon : null,
          timestamp: record.endTimestampUTC || record.timestamp || record.ts
        };
      })
      .filter(p => p.lat != null && p.lon != null);
  }, [telemetryData]);

  // If no location data, return message
  if (locationPoints.length === 0) {
    return (
      <div className="analytics-section" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
        <p>📍 No location data available for selected time range</p>
      </div>
    );
  }

  // Create polyline coordinates with interpolation for smooth curves
  const interpolatePoint = (p1, p2, t) => [
    p1[0] + (p2[0] - p1[0]) * t,
    p1[1] + (p2[1] - p1[1]) * t
  ];
  
  const smoothedCoordinates = [];
  const baseCoordinates = locationPoints.map(p => [p.lat, p.lon]);
  
  for (let i = 0; i < baseCoordinates.length - 1; i++) {
    smoothedCoordinates.push(baseCoordinates[i]);
    // Add 4 interpolated points between each pair of waypoints for smooth curves
    for (let j = 1; j <= 4; j++) {
      smoothedCoordinates.push(
        interpolatePoint(baseCoordinates[i], baseCoordinates[i + 1], j / 5)
      );
    }
  }
  smoothedCoordinates.push(baseCoordinates[baseCoordinates.length - 1]);
  
  const centerPoint = locationPoints[locationPoints.length - 1] || locationPoints[0];

  return (
    <div className="analytics-section">
      <h3>📍 {title}</h3>
      <div style={{
        height: '300px',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #334155'
      }}>
        <MapContainer
          center={[centerPoint.lat, centerPoint.lon]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          
          {/* Draw smoothly curved path polyline */}
          <Polyline
            positions={smoothedCoordinates}
            color="#000000"
            weight={3}
            opacity={1}
          />
          
          {/* Mark current/latest point */}
          <Marker position={[centerPoint.lat, centerPoint.lon]}>
            <Popup>
              <div style={{ fontSize: '12px' }}>
                <strong>Current Position</strong><br/>
                Lat: {centerPoint.lat.toFixed(4)}<br/>
                Lon: {centerPoint.lon.toFixed(4)}<br/>
                {centerPoint.timestamp ? new Date(centerPoint.timestamp).toLocaleString() : 'N/A'}
              </div>
            </Popup>
          </Marker>
          
          {/* Recenter map when positions change */}
          <RecenterMap positions={locationPoints} />
        </MapContainer>
      </div>
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
        {locationPoints.length} location points in history
      </div>
    </div>
  );
}
