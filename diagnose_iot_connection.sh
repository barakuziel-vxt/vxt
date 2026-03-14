#!/bin/bash
# IoT Edge Connection Diagnostic Script
# Run on Raspberry Pi: bash diagnose_iot_connection.sh

echo "=========================================="
echo "IoT Edge Connection Diagnostics"
echo "=========================================="

echo ""
echo "1. CHECK CONFIG FILE"
echo "---"
if [ -f /etc/aziot/config.toml ]; then
    echo "✅ Config file exists"
    echo "Connection string in config:"
    grep -A1 "^\[provisioning\]" /etc/aziot/config.toml | grep "connection_string"
else
    echo "❌ Config file NOT found"
    exit 1
fi

echo ""
echo "2. CHECK SERVICE STATUS"
echo "---"
if systemctl is-active --quiet aziot-edged; then
    echo "✅ Service is ACTIVE"
    systemctl status aziot-edged | head -5
else
    echo "❌ Service is NOT running"
fi

echo ""
echo "3. CHECK SERVICE LOGS (LAST 20 LINES)"
echo "---"
journalctl -u aziot-edged -n 20 --no-pager

echo ""
echo "4. CHECK AUTH STATUS"
echo "---"
curl -s -H "Content-Type: application/json" \
    --unix-socket /var/run/iotedge/mgmt.sock \
    http://localhost/identity/identity/TomerRefael/renew-sas 2>&1 | head -5

echo ""
echo "5. SUMMARY"
echo "---"
echo "If connection_string shows the NEW key ending in ...FRpg= ✅"
echo "If service shows Active (running) ✅"
echo "If logs show NO authentication errors ✅"
echo "Then wait 2-3 minutes and refresh Azure Portal"
echo ""
echo "If any issues, send output above to support"
