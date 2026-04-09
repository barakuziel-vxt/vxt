"""Write proper JSON config to host filesystem and restart SignalK via systemd."""
import paramiko
import json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('halos.local', username='pi', password='halos', timeout=10)

config = {
    "enabled": True,
    "configuration": {
        "host": "localhost",
        "port": 8086,
        "database": "signalk",
        "retention": "seven_days",
        "recordTrack": True,
        "storeOthers": False,
        "resolution": 200,
        "blackOrWhite": "Black",
        "blackOrWhitelist": []
    }
}

config_json = json.dumps(config, indent=2)
config_path = "/var/lib/container-apps/marine-signalk-server-container/data/data/plugin-config-data/signalk-to-influxdb.json"

# Use SFTP to write the file properly
sftp = ssh.open_sftp()
with sftp.open(config_path, 'w') as f:
    f.write(config_json)
sftp.close()
print(f"Written config ({len(config_json)} bytes)")

# Verify
stdin, stdout, stderr = ssh.exec_command(f"cat {config_path}", timeout=10)
out = stdout.read().decode().strip()
parsed = json.loads(out)
print(f"Verified: valid JSON, enabled={parsed['enabled']}, db={parsed['configuration']['database']}")
print(out)

# Restart via systemd
print("\nRestarting SignalK via systemd...")
stdin, stdout, stderr = ssh.exec_command("sudo systemctl restart marine-signalk-server-container", timeout=60)
rc = stdout.channel.recv_exit_status()
print(f"Restart exit code: {rc}")

import time
time.sleep(10)

# Check status
stdin, stdout, stderr = ssh.exec_command("sudo systemctl status marine-signalk-server-container | head -10", timeout=15)
print(stdout.read().decode().strip())

ssh.close()
print("\nDone.")
