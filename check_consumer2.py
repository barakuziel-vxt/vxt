import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('halos.local', username='pi', password='halos', timeout=10)

# Check what's in the vxt-orchestrator and get running processes
commands = [
    "find ~/vxt-orchestrator -type f -name '*.py' | head -20",
    "ls -lah ~/vxt-orchestrator/",
    "ps aux | grep python",
    "ps aux | head -20",
    "sudo systemctl list-units --type=service | grep -i vxt",
    "sudo journalctl -b --no-pager | tail -100 | grep -i 'consumer\\|event\\|telemetry\\|error'"
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
        print(f"STDERR: {err[:500]}")

ssh.close()
