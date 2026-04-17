#!/bin/bash
set -e
NEW_TOKEN='lQXkJm-sBN_7NTog0EMRKMQjGX-vKvAFBUhMzJYxrwMS1n19cgrDMXc4lMY0zlOfLmrCb5IPVH1tch-EAmOipg=='

echo '=== Step 1: Update SignalK plugin config ==='
sudo docker exec signalk-server cat /home/node/.signalk/plugin-config-data/signalk-to-influxdb2.json > /tmp/sk_influx.json
python3 << 'PYEOF'
import json
NEW_TOKEN = 'lQXkJm-sBN_7NTog0EMRKMQjGX-vKvAFBUhMzJYxrwMS1n19cgrDMXc4lMY0zlOfLmrCb5IPVH1tch-EAmOipg=='
with open('/tmp/sk_influx.json') as f:
    cfg = json.load(f)
cfg['configuration']['influxes'][0]['token'] = NEW_TOKEN
with open('/tmp/sk_influx_new.json', 'w') as f:
    json.dump(cfg, f, indent=2)
print('Token updated in plugin config')
PYEOF
sudo docker cp /tmp/sk_influx_new.json signalk-server:/home/node/.signalk/plugin-config-data/signalk-to-influxdb2.json
echo 'Plugin config copied back to container'

echo '=== Step 2: Update orchestrator service ==='
sudo sed -i "s|Environment=INFLUXDB_TOKEN=.*|Environment=INFLUXDB_TOKEN=${NEW_TOKEN}|" /etc/systemd/system/vxt-orchestrator.service
grep INFLUXDB_TOKEN /etc/systemd/system/vxt-orchestrator.service

echo '=== Step 3: Increase bucket retention to 30 days ==='
sudo docker exec influxdb2 influx bucket update --id 1eaab757b99ca2f1 --retention 2592000s 2>&1 || echo 'Bucket update failed (may need different approach)'

echo '=== Step 4: Reload and restart services ==='
sudo systemctl daemon-reload
sudo systemctl restart vxt-orchestrator
echo 'Orchestrator restarted'
sudo docker restart signalk-server
echo 'SignalK restarted'

echo '=== All done ==='
