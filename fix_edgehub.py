import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('halos.local', username='pi', password='halos', timeout=10)

cmds = [
    # Check if it's the old container
    'sudo docker inspect edgeHub --format "{{.Id}} {{.State.Error}}" 2>&1',
    # Force remove old edgeHub so edgeAgent recreates it
    'sudo docker rm -f edgeHub 2>&1',
    # Restart iotedge to trigger reconciliation
    'sudo iotedge system restart 2>&1',
]
for cmd in cmds:
    print(f'\n=== {cmd} ===')
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip(): print(out)
    if err.strip(): print(err)

c.close()
