"""Quick SSH check of IoT Edge module status on halos-edge Pi."""
import paramiko, time

def run(client, cmd, timeout=15, stdin_data=None):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    if stdin_data:
        stdin.write(stdin_data)
        stdin.flush()
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    return (out + err).strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("halos.local", username="pi", password="halos", timeout=10)

commands = [
    ("IoT Edge modules",     "sudo -S iotedge list 2>&1",                               "halos\n"),
    ("Orchestrator logs",    "sudo -S iotedge logs vxt-orchestrator --tail 30 2>&1",     "halos\n"),
    ("vxt-nodered logs",     "sudo -S iotedge logs vxt-nodered --tail 20 2>&1",          "halos\n"),
    ("EdgeAgent logs",       "sudo -S iotedge logs edgeAgent --tail 20 2>&1",            "halos\n"),
    ("SignalK notifications","curl -s http://localhost:3000/signalk/v1/api/vessels/self/notifications 2>&1", None),
]

for label, cmd, stdin_data in commands:
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    result = run(client, cmd, stdin_data=stdin_data)
    print(result if result else "(no output)")

client.close()


client.close()


client.close()
