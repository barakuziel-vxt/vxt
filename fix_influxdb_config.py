"""Write proper JSON plugin config to SignalK container."""
import paramiko
import json
import base64

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
b64 = base64.b64encode(config_json.encode()).decode()

# Use printf + base64 -d inside docker exec
cmd = f"sudo docker exec signalk-server /bin/bash -c 'printf \"%s\" \"{b64}\" | base64 -d > /home/node/.signalk/plugin-config-data/signalk-to-influxdb.json'"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
stdout.read()
err = stderr.read().decode().strip()
print("Write:", "OK" if not err else err)

# Verify
cmd2 = "sudo docker exec signalk-server cat /home/node/.signalk/plugin-config-data/signalk-to-influxdb.json"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=15)
out = stdout.read().decode().strip()
print(out)

# Validate it's proper JSON
parsed = json.loads(out)
print(f"\nValid JSON: {parsed['enabled']}, db={parsed['configuration']['database']}")

# Restart SignalK
print("\nRestarting SignalK...")
cmd3 = "sudo docker restart signalk-server"
stdin, stdout, stderr = ssh.exec_command(cmd3, timeout=30)
print(stdout.read().decode().strip())

ssh.close()
print("Done.")
