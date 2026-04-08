"""Set up InfluxDB database and retention policy on the Pi."""
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('halos.local', username='pi', password='halos', timeout=10)

commands = [
    "influx -execute 'CREATE DATABASE signalk'",
    "influx -execute 'SHOW DATABASES'",
    'influx -execute "CREATE RETENTION POLICY seven_days ON signalk DURATION 7d REPLICATION 1 DEFAULT"',
    'influx -execute "SHOW RETENTION POLICIES ON signalk"',
]

for cmd in commands:
    print(f">>> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(out)
    if err:
        print(f"ERR: {err}")
    print()

ssh.close()
print("Done.")
