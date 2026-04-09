import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('halos.local', username='pi', password='halos', timeout=10)

# Remove old influxdb2 container and its orphan volume so edgeAgent recreates clean
cmds = [
    'sudo docker rm -f influxdb2 2>&1',
    'sudo docker volume prune -f 2>&1',
]
for cmd in cmds:
    print(f'=== {cmd} ===')
    stdin, stdout, stderr = c.exec_command(cmd, timeout=15)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip(): print(out)
    if err.strip(): print(err)
    print()

c.close()
print("Done. edgeAgent will recreate influxdb2 with the new mount config.")
