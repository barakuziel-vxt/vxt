import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('halos.local', username='pi', password='halos', timeout=10)

SIGNALK_DATA = '/var/lib/container-apps/marine-signalk-server-container/data/data'

def run(cmd, wait=2):
    transport = c.get_transport()
    chan = transport.open_session()
    chan.get_pty()
    chan.exec_command(f'echo halos | sudo -S bash -c \'{cmd}\'')
    import time; time.sleep(wait)
    out = b''
    while chan.recv_ready():
        out += chan.recv(8192)
    chan.close()
    return out.decode()

# Step 1: Create plugin config to enable it
plugin_config = {
    "enabled": True,
    "enableDebug": False,
    "configuration": {}
}

# Write plugin config file
config_json = json.dumps(plugin_config, indent=2)
sftp = c.open_sftp()
with sftp.file('/tmp/xdr-plugin-config.json', 'w') as f:
    f.write(config_json)
sftp.close()

print('=== Creating plugin config ===')
print(run(f'cp /tmp/xdr-plugin-config.json {SIGNALK_DATA}/plugin-config-data/signalk-xdr-parser.json'))
print(run(f'chown pi:pi {SIGNALK_DATA}/plugin-config-data/signalk-xdr-parser.json'))

# Verify
print('=== Plugin config files ===')
print(run(f'ls -la {SIGNALK_DATA}/plugin-config-data/'))
print(run(f'cat {SIGNALK_DATA}/plugin-config-data/signalk-xdr-parser.json'))

# Step 2: Restart the SignalK container
print('\n=== Restarting SignalK container ===')
result = run('docker restart signalk-server', wait=10)
print(result)

# Step 3: Check container status after restart
print('=== Container status ===')
print(run('docker ps --filter name=signalk-server --format "{{.Status}}"'))

c.close()
print('\n=== Done! ===')
