import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('halos.local', username='pi', password='halos', timeout=10)

cmds = [
    'curl -s http://localhost:8086/api/v2/setup',
    'curl -s http://localhost:8086/api/v2/health',
    'sudo docker inspect influxdb2 --format "{{json .Mounts}}" 2>&1',
    'sudo docker logs influxdb2 2>&1 | tail -15',
]
for cmd in cmds:
    print(f'\n=== {cmd} ===')
    stdin, stdout, stderr = c.exec_command(cmd, timeout=15)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip(): print(out)
    if err.strip(): print(err)

c.close()
