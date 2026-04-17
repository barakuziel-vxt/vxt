import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('halos.local', username='pi', password='halos', timeout=10)

# Get VERY RECENT logs - last 50 lines to see if twin was received
stdin, stdout, stderr = ssh.exec_command('sudo journalctl -u vxt-orchestrator -n 50 --no-pager', timeout=15)
out = stdout.read().decode().strip()
print("Latest 50 journalctl entries:")
print("="*60)
print(out)
print("\n" + "="*60)

# Also check the last few lines more carefully
print("\nLast entries (tail -10):")
stdin, stdout, stderr = ssh.exec_command('sudo journalctl -u vxt-orchestrator --no-pager | tail -10', timeout=15)
out = stdout.read().decode().strip()
print(out)

ssh.close()
