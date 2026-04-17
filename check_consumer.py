import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('halos.local', username='pi', password='halos', timeout=10)

# Check for consumer processes and logs
commands = [
    "ps aux | grep -i consumer | grep -v grep",
    "find ~ -name '*consumer*' -type f 2>/dev/null | head -10",
    "find ~ -name '*.log' -type f 2>/dev/null | head -10",
    "ls -lah ~/",
    "systemctl status consumer 2>/dev/null || echo 'No systemd service found'",
    "tail -50 ~/consumer.log 2>/dev/null || echo 'Consumer log not found'",
    "journalctl -u consumer -n 50 --no-pager 2>/dev/null || echo 'No journalctl entry'"
]

for cmd in commands:
    print(f"\n{'='*60}")
    print(f"Command: {cmd}")
    print('='*60)
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=10)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(out)
    if err and 'No' not in err:
        print(f"STDERR: {err}")

ssh.close()
