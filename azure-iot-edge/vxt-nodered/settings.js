// settings.js — VXT Node-RED Alert Engine
// SD-card wear protection: all runtime context stored in RAM (memory module).
// /data is expected to be a tmpfs mount from Docker createOptions.

module.exports = {
    // Flow file relative to userDir (/data)
    flowFile: 'flows.json',

    // ── Context storage: RAM only (no SD card writes) ────────────────────────
    contextStorage: {
        default: {
            module: 'memory'
        }
    },

    // ── HTTP / WebSocket server ───────────────────────────────────────────────
    uiPort: 1880,

    // ── Logging ───────────────────────────────────────────────────────────────
    logging: {
        console: {
            level: 'info',
            metrics: false,
            audit: false
        }
    },

    // ── Disable admin auth (internal edge module, not internet-facing) ────────
    adminAuth: null,

    // ── Editor ────────────────────────────────────────────────────────────────
    editorTheme: {
        projects: {
            enabled: false
        }
    },

    // ── Reconnect timers ─────────────────────────────────────────────────────
    mqttReconnectTime: 15000,
    serialReconnectTime: 15000
};
