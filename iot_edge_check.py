"""Check IoT Edge module deployment status on the Pi."""
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

print("Checking IoT Edge module status...")
run("sudo iotedge list")
run('sudo docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"')
run("sudo ss -tlnp | grep 8086 || echo PORT_8086_NOT_LISTENING_YET")

c.close()
print("\nDone.")
