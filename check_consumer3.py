import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('halos.local', username='pi', password='halos', timeout=10)

# Get full logs and check the main.py
commands = [
    "sudo journalctl -u vxt-orchestrator -n 200 --no-pager",
    "sudo tail -100 /var/log/syslog | grep -i 'vxt\\|python\\|error'",
]

for cmd in commands:
    print(f"\n{'='*60}")
    print(f"Command: {cmd}")
    print('='*60)
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(out)
    if err:
        print(f"STDERR: {err[:1000]}")

# Also check the main.py to see what it's supposed to do
print(f"\n{'='*60}")
print("Content of main.py:")
print('='*60)
stdin, stdout, stderr = ssh.exec_command("head -100 ~/vxt-orchestrator/main.py", timeout=10)
out = stdout.read().decode().strip()
if out:
    print(out)

ssh.close()
