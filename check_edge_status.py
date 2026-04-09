import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('halos.local', username='pi', password='halos', timeout=10)

cmds = [
    'sudo iotedge logs edgeAgent 2>&1 | grep -i -E "edgeHub|error|fail|influx" | tail -20',
    'sudo docker inspect edgeHub 2>&1 | head -40',
    'sudo docker inspect influxdb2 --format "{{json .Mounts}}" 2>&1',
    'sudo iotedge list',
    'sudo iotedge check --output json 2>&1 | head -80',
]
for cmd in cmds:
    print(f'\n=== {cmd} ===')
    stdin, stdout, stderr = c.exec_command(cmd, timeout=15)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip():
        print(out)
    if err.strip():
        print(err)

c.close()
