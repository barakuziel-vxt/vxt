import React, { useEffect } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Polyline, Marker, Popup, useMap, LayersControl } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Component to recenter map — always centers on latest (yacht) position at zoom 15
function RecenterMap({ positions }) {
  const map = useMap();
  
  useEffect(() => {
    if (!positions || positions.length === 0) return;
    const latest = positions[positions.length - 1];
    map.setView([latest.lat, latest.lon], 15);
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

  // If no location data, return null (hide section entirely)
  if (locationPoints.length === 0) {
    return null;
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

  // Sailboat icon for the current position marker
  const sailboatIcon = new DivIcon({
    html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(1px 1px 2px rgba(0,0,0,0.5))">⛵</div>',
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });

  return (
    <div className="analytics-section">
      <h3>📍 {title}</h3>
      <div style={{
        height: '350px',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #334155',
      }}>
        <MapContainer
          center={[centerPoint.lat, centerPoint.lon]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxZoom={19}
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer checked name="OpenTopoMap">
              <TileLayer
                url="https://tile.opentopomap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
                maxZoom={17}
              />
            </LayersControl.BaseLayer>

            {/* Real nautical chart overlay from OpenSeaMap */}
            <LayersControl.Overlay checked name="🌊 Nautical Chart (OpenSeaMap)">
              <TileLayer
                url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a> contributors'
                maxZoom={18}
                opacity={0.9}
              />
            </LayersControl.Overlay>

            {/* EMODnet bathymetric depth contour lines (Mediterranean coverage) */}
            <LayersControl.Overlay name="🔵 Ocean Depth (EMODnet)">
              <WMSTileLayer
                url="https://ows.emodnet-bathymetry.eu/wms?"
                layers="emodnet:contours"
                format="image/png"
                transparent={true}
                opacity={0.75}
                attribution='&copy; <a href="https://www.emodnet-bathymetry.eu">EMODnet Bathymetry</a>'
                version="1.3.0"
              />
            </LayersControl.Overlay>
          </LayersControl>

          {/* Draw smoothly curved path polyline */}
          <Polyline
            positions={smoothedCoordinates}
            color="#ff4444"
            weight={3}
            opacity={0.9}
          />

          {/* Mark current/latest point */}
          <Marker position={[centerPoint.lat, centerPoint.lon]} icon={sailboatIcon}>
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
        {locationPoints.length} position points • Overlays: OpenSeaMap nautical chart, EMODnet depth contours
      </div>
    </div>
  );
}
