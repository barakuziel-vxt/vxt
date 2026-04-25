#!/bin/sh
# entrypoint.sh — VXT Node-RED Alert Engine container startup
# /data is a tmpfs mount (RAM-only) — SD card protection.
# Bundled flows/settings are stored in /etc/node-red-bundled (image layer).
# On each start we copy them to /data so Node-RED always runs the latest version.

set -e

echo "[VXT Node-RED] Initialising /data (tmpfs)..."
mkdir -p /data

# Always overwrite so a new image version gets its updated flows
cp -f /etc/node-red-bundled/flows.json  /data/flows.json
cp -f /etc/node-red-bundled/settings.js /data/settings.js

echo "[VXT Node-RED] Starting Node-RED..."
cd /usr/src/node-red
exec node node_modules/node-red/red.js \
     --settings /data/settings.js \
     --userDir  /data \
     "$@"
