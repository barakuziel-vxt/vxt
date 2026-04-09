"""Configure signalk-to-influxdb plugin and restart SignalK."""
import paramiko, json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('halos.local', username='pi', password='halos', timeout=10)

# Plugin config for signalk-to-influxdb
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
print(f"Plugin config:\n{config_json}\n")

# Write the config file inside the container
cmd = f"sudo docker exec signalk-server bash -c \"cat > /home/node/.signalk/plugin-config-data/signalk-to-influxdb.json << 'ENDCONFIG'\n{config_json}\nENDCONFIG\""
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
out = stdout.read().decode().strip()
err = stderr.read().decode().strip()
print(f"Write config: {'OK' if not err else err}")

# Verify file was written
cmd2 = "sudo docker exec signalk-server cat /home/node/.signalk/plugin-config-data/signalk-to-influxdb.json"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=15)
out = stdout.read().decode().strip()
print(f"\nVerify written config:\n{out}")

# Restart the SignalK container
print("\nRestarting SignalK container...")
cmd3 = "sudo docker restart signalk-server"
stdin, stdout, stderr = ssh.exec_command(cmd3, timeout=30)
out = stdout.read().decode().strip()
err = stderr.read().decode().strip()
print(f"Restart: {out or err or 'OK'}")

ssh.close()
print("\nDone.")
