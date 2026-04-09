"""Force-provision IoT Edge with halos-edge connection string."""
import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('halos.local', username='pi', password='halos', timeout=10)

def run(cmd, t=30):
    print(f'\n>>> {cmd}')
    stdin, stdout, stderr = c.exec_command(cmd, timeout=t)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out: print(out)
    if err: print(f'STDERR: {err}')

CONN_STR = "HostName=VXT-IoT-Hub.azure-devices.net;DeviceId=halos-edge;SharedAccessKey=1+kbZvMIuiXdCDn0hoG+dLP7bQekhpWDxkqFRXsr75g="

run(f"sudo iotedge config mp --force --connection-string '{CONN_STR}'")
run("sudo iotedge config apply", t=30)
print("\nWaiting 10s for services to start...")
time.sleep(10)
run("sudo iotedge system status")
run("sudo iotedge list")

c.close()
print("\nDone.")
