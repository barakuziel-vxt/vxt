import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('halos.local', username='pi', password='halos', timeout=10)

# Get the admin token from inside the container
cmds = [
    # List tokens using influx CLI inside the container
    'sudo docker exec influxdb2 influx auth list --json 2>&1',
    # List buckets
    'sudo docker exec influxdb2 influx bucket list --json 2>&1',
    # List orgs
    'sudo docker exec influxdb2 influx org list --json 2>&1',
]
for cmd in cmds:
    print(f'\n=== {cmd} ===')
    stdin, stdout, stderr = c.exec_command(cmd, timeout=15)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip(): print(out)
    if err.strip(): print(err)

c.close()
