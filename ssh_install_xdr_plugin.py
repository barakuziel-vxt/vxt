import paramiko
import json
import os

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('halos.local', username='pi', password='halos', timeout=10)

SIGNALK_DATA = '/var/lib/container-apps/marine-signalk-server-container/data/data'
PLUGIN_DIR = f'{SIGNALK_DATA}/node_modules/signalk-xdr-parser'

def run(cmd):
    transport = c.get_transport()
    chan = transport.open_session()
    chan.get_pty()
    chan.exec_command(f'echo halos | sudo -S bash -c \'{cmd}\'')
    import time; time.sleep(2)
    out = b''
    while chan.recv_ready():
        out += chan.recv(8192)
    chan.close()
    return out.decode()

# Step 1: Create the plugin directory
print('=== Creating plugin directory ===')
print(run(f'mkdir -p {PLUGIN_DIR}'))

# Step 2: Upload index.js
with open(r'c:\VXT\signalk-xdr-parser-plugin\index.js', 'r') as f:
    index_js = f.read()

with open(r'c:\VXT\signalk-xdr-parser-plugin\package.json', 'r') as f:
    package_json = f.read()

# Write files via SSH using cat/heredoc
sftp = c.open_sftp()

# Write to /tmp first, then sudo move
sftp.put(r'c:\VXT\signalk-xdr-parser-plugin\index.js', '/tmp/xdr-index.js')
sftp.put(r'c:\VXT\signalk-xdr-parser-plugin\package.json', '/tmp/xdr-package.json')
sftp.close()

print('=== Copying files to plugin directory ===')
print(run(f'cp /tmp/xdr-index.js {PLUGIN_DIR}/index.js'))
print(run(f'cp /tmp/xdr-package.json {PLUGIN_DIR}/package.json'))
print(run(f'chown -R pi:pi {PLUGIN_DIR}'))

# Step 3: Verify files are in place
print('=== Verifying plugin files ===')
print(run(f'ls -la {PLUGIN_DIR}/'))
print(run(f'cat {PLUGIN_DIR}/package.json'))

# Step 4: Check the existing package.json in the SignalK data dir to see plugins
print('=== Current SignalK package.json ===')
pkg_out = run(f'cat {SIGNALK_DATA}/package.json')
print(pkg_out)

# Step 5: Add our plugin to the SignalK package.json dependencies
# Parse the package.json (skip sudo password prompt line)
lines = pkg_out.split('\n')
# Find the JSON content (skip any sudo prompt lines)
json_start = None
for i, line in enumerate(lines):
    if line.strip().startswith('{'):
        json_start = i
        break

if json_start is not None:
    pkg_json_str = '\n'.join(lines[json_start:])
    try:
        pkg = json.loads(pkg_json_str)
        if 'dependencies' not in pkg:
            pkg['dependencies'] = {}
        pkg['dependencies']['signalk-xdr-parser'] = f'file:{PLUGIN_DIR}'
        new_pkg = json.dumps(pkg, indent=2)
        
        # Write updated package.json
        with open(r'c:\VXT\signalk-xdr-parser-plugin\signalk-package.json', 'w') as f:
            f.write(new_pkg)
        
        sftp2 = c.open_sftp()
        sftp2.put(r'c:\VXT\signalk-xdr-parser-plugin\signalk-package.json', '/tmp/signalk-package.json')
        sftp2.close()
        
        print('=== Updating SignalK package.json ===')
        print(run(f'cp /tmp/signalk-package.json {SIGNALK_DATA}/package.json'))
        print(run(f'chown pi:pi {SIGNALK_DATA}/package.json'))
        print('=== Updated package.json ===')
        print(run(f'cat {SIGNALK_DATA}/package.json'))
    except json.JSONDecodeError as e:
        print(f'JSON parse error: {e}')
        print(f'Raw JSON: {pkg_json_str[:500]}')

c.close()
print('\n=== Done! Plugin installed. ===')
