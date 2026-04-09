import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('halos.local', username='pi', password='halos', timeout=10)

def run(cmd, wait=3):
    transport = c.get_transport()
    chan = transport.open_session()
    chan.get_pty()
    chan.exec_command(f'echo halos | sudo -S bash -c \'{cmd}\'')
    time.sleep(wait)
    out = b''
    while chan.recv_ready():
        out += chan.recv(16384)
    chan.close()
    return out.decode()

# Check the full startup logs from the beginning
print('=== Full SignalK startup logs ===')
print(run('docker logs signalk-server 2>&1 | head -30', wait=5))

# Check if propulsion data is now flowing via the API
print('\n=== SignalK API - propulsion data ===')
print(run('curl -s http://localhost:3000/signalk/v1/api/vessels/self/propulsion 2>/dev/null', wait=3))

# Check electrical
print('\n=== SignalK API - electrical data ===')
print(run('curl -s http://localhost:3000/signalk/v1/api/vessels/self/electrical 2>/dev/null', wait=3))

# Check tanks
print('\n=== SignalK API - tanks data ===')
print(run('curl -s http://localhost:3000/signalk/v1/api/vessels/self/tanks 2>/dev/null', wait=3))

c.close()
