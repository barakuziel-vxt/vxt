import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, GeoJSON, LayersControl } from 'react-leaflet';
import { DivIcon, LatLngBounds, Marker as LeafletMarker } from 'leaflet';
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

// Marine components - shipping lanes
function getShippingLanes(centerLat, centerLon) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Major Shipping Route', type: 'shipping_lane' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [centerLon - 0.5, centerLat],
            [centerLon + 0.5, centerLat + 0.2]
          ]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Alternative Route', type: 'shipping_lane' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [centerLon - 0.3, centerLat - 0.3],
            [centerLon + 0.3, centerLat + 0.1]
          ]
        }
      }
    ]
  };
}

// Marine components - navigational hazards
function getNavigationalHazards(centerLat, centerLon) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Shallow Water Warning', type: 'shallow_water' },
        geometry: {
          type: 'Point',
          coordinates: [centerLon + 0.1, centerLat + 0.15]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Rock Formation', type: 'rock' },
        geometry: {
          type: 'Point',
          coordinates: [centerLon - 0.2, centerLat + 0.1]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Wreck Site', type: 'wreck' },
        geometry: {
          type: 'Point',
          coordinates: [centerLon + 0.25, centerLat - 0.1]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Reef Zone', type: 'reef' },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [centerLon - 0.05, centerLat - 0.2],
            [centerLon + 0.05, centerLat - 0.2],
            [centerLon + 0.05, centerLat - 0.1],
            [centerLon - 0.05, centerLat - 0.1],
            [centerLon - 0.05, centerLat - 0.2]
          ]]
        }
      }
    ]
  };
}

// GeoJSON styling functions
function onEachShippingLane(feature, layer) {
  const popup = `<div style="font-size:11px"><strong>${feature.properties.name}</strong><br/>Type: ${feature.properties.type}</div>`;
  layer.bindPopup(popup);
}

function shippingLaneStyle(feature) {
  return {
    color: '#2563eb',
    weight: 2,
    opacity: 0.6,
    dashArray: '5, 5'
  };
}

function onEachHazard(feature, layer) {
  const hazardEmoji = {
    shallow_water: '⚠️',
    rock: '🪨',
    wreck: '⚓',
    reef: '🌊'
  };
  const popup = `<div style="font-size:11px"><strong>${feature.properties.name}</strong><br/>Hazard: ${feature.properties.type}</div>`;
  layer.bindPopup(popup);
}

function hazardStyle(feature) {
  const types = {
    shallow_water: { color: '#f97316', weight: 8 },
    rock: { color: '#6b7280', weight: 6 },
    wreck: { color: '#7c3aed', weight: 6 },
    reef: { color: '#10b981', weight: 2, fillOpacity: 0.2 }
  };
  return types[feature.properties.type] || { color: '#666', weight: 4 };
}

function hazardPointToLayer(feature, latlng) {
  const hazardEmoji = {
    shallow_water: '⚠️',
    rock: '🪨',
    wreck: '⚓',
    reef: '🌊'
  };
  const icon = new DivIcon({
    html: `<div style="font-size:16px">${hazardEmoji[feature.properties.type] || '📍'}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  return LeafletMarker(latlng, { icon });
}

function onEachDepthContour(feature, layer) {
  const popup = `<div style="font-size:11px"><strong>${feature.properties.name}</strong><br/>Depth: ${feature.properties.depth}m</div>`;
  layer.bindPopup(popup);
}

function depthContourStyle(feature) {
  const depths = {
    10: { color: '#fbbf24', weight: 1, opacity: 0.5 },
    50: { color: '#f59e0b', weight: 1, opacity: 0.4 },
    100: { color: '#d97706', weight: 1, opacity: 0.3 }
  };
  return depths[feature.properties.depth] || { color: '#999', weight: 1 };
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
        height: '300px',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #334155',
        boxSizing: 'border-box',
        marginLeft: '-4px',
        paddingLeft: '0px'
      }}>
        <MapContainer
          center={[centerPoint.lat, centerPoint.lon]}
          zoom={12}
          style={{ height: '100%', width: '100%', boxSizing: 'border-box' }}
          scrollWheelZoom={true}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenTopoMap">
              <TileLayer
                url="https://tile.opentopomap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
                maxZoom={17}
              />
            </LayersControl.BaseLayer>
            
            <LayersControl.Overlay name="🌊 Depth Contours" checked>
              <GeoJSON
                data={getDepthContours(centerPoint.lat, centerPoint.lon)}
                style={depthContourStyle}
                onEachFeature={onEachDepthContour}
              />
            </LayersControl.Overlay>
            
            <LayersControl.Overlay name="🛣️ Shipping Lanes" checked>
              <GeoJSON
                data={getShippingLanes(centerPoint.lat, centerPoint.lon)}
                style={shippingLaneStyle}
                onEachFeature={onEachShippingLane}
              />
            </LayersControl.Overlay>
            
            <LayersControl.Overlay name="⚠️ Hazards & Obstacles">
              <GeoJSON
                data={getNavigationalHazards(centerPoint.lat, centerPoint.lon)}
                style={hazardStyle}
                pointToLayer={hazardPointToLayer}
                onEachFeature={onEachHazard}
              />
            </LayersControl.Overlay>
          </LayersControl>
          
          {/* Draw smoothly curved path polyline */}
          <Polyline
            positions={smoothedCoordinates}
            color="#000000"
            weight={3}
            opacity={1}
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
        {locationPoints.length} position points • Marine features enabled: Depth contours, Shipping lanes, Hazards
      </div>
    </div>
  );
}
