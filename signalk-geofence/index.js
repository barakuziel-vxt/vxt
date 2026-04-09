'use strict';

const PLUGIN_ID = 'signalk-geofence';
const R_EARTH = 6371000; // metres

module.exports = function (app) {
  let unsubscribe = null;
  let fences = [];
  let insideState = {}; // fenceId -> boolean

  // ---------- geometry helpers ----------
  function toRad(d) { return d * Math.PI / 180; }

  function haversine(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function pointInPolygon(lat, lon, coords) {
    // coords = [[lon, lat], ...] (GeoJSON order)
    let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][1], yi = coords[i][0];
      const xj = coords[j][1], yj = coords[j][0];
      if (((yi > lon) !== (yj > lon)) &&
          (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function isInsideFence(lat, lon, fence) {
    if (fence.type === 'circle') {
      const center = fence.center; // [lon, lat]
      const dist = haversine(lat, lon, center[1], center[0]);
      return dist <= (fence.radius || 0);
    }
    if (fence.type === 'polygon') {
      return pointInPolygon(lat, lon, fence.coordinates);
    }
    return false;
  }

  // ---------- plugin interface ----------
  const plugin = {
    id: PLUGIN_ID,
    name: 'Geofence Monitor',
    description: 'Monitors vessel position against geofence zones and sends notifications on enter/exit.',

    schema: {
      type: 'object',
      required: ['enabled'],
      properties: {
        enabled: { type: 'boolean', title: 'Enable geofence monitoring', default: true },
        fences: {
          type: 'array',
          title: 'Geofence definitions',
          items: {
            type: 'object',
            properties: {
              id:          { type: 'number',  title: 'Fence ID' },
              name:        { type: 'string',  title: 'Fence name' },
              enabled:     { type: 'boolean', title: 'Enabled', default: true },
              type:        { type: 'string',  title: 'Type (polygon / circle)' },
              coordinates: { type: 'array',   title: 'Polygon coordinates [[lon,lat],...]' },
              center:      { type: 'array',   title: 'Circle centre [lon,lat]' },
              radius:      { type: 'number',  title: 'Circle radius (metres)' }
            }
          }
        }
      }
    },

    start: function (config) {
      fences = (config.fences || []).filter(f => f.enabled !== false);
      insideState = {};
      app.debug(`Geofence plugin started with ${fences.length} fence(s)`);

      if (fences.length === 0) return;

      const localSubscription = {
        context: 'vessels.self',
        subscribe: [{ path: 'navigation.position', period: 5000 }]
      };

      app.subscriptionmanager.subscribe(
        localSubscription,
        unsubscribe = {
          unsubscribe: null
        },
        (err) => { if (err) app.error('Subscription error: ' + err); },
        (delta) => {
          if (!delta.updates) return;
          for (const update of delta.updates) {
            for (const val of (update.values || [])) {
              if (val.path === 'navigation.position' && val.value) {
                checkPosition(val.value.latitude, val.value.longitude);
              }
            }
          }
        }
      );
    },

    stop: function () {
      if (unsubscribe && unsubscribe.unsubscribe) {
        unsubscribe.unsubscribe();
      }
      unsubscribe = null;
      fences = [];
      insideState = {};
      app.debug('Geofence plugin stopped');
    }
  };

  function checkPosition(lat, lon) {
    for (const fence of fences) {
      const fid = fence.id || fence.name;
      const inside = isInsideFence(lat, lon, fence);
      const wasInside = insideState[fid] || false;

      if (inside && !wasInside) {
        app.debug(`ENTERED fence "${fence.name}"`);
        sendNotification(fence, 'enter', lat, lon);
      } else if (!inside && wasInside) {
        app.debug(`EXITED fence "${fence.name}"`);
        sendNotification(fence, 'exit', lat, lon);
      }
      insideState[fid] = inside;
    }
  }

  function sendNotification(fence, event, lat, lon) {
    const path = `notifications.navigation.geofence.${fence.id || 0}`;
    const msg = `Vessel ${event === 'enter' ? 'entered' : 'exited'} geofence "${fence.name}"`;
    app.handleMessage(PLUGIN_ID, {
      updates: [{
        values: [{
          path: path,
          value: {
            state: event === 'enter' ? 'alert' : 'normal',
            method: ['visual', 'sound'],
            message: msg,
            data: { fenceId: fence.id, fenceName: fence.name, event, lat, lon }
          }
        }]
      }]
    });
  }

  return plugin;
};
