"""Verify SignalK is up, start simulator, and check InfluxDB receives data."""
import urllib.request
import ssl
import json
import time
import socket

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def get_json(url):
    req = urllib.request.Request(url)
    resp = urllib.request.urlopen(req, timeout=5)
    return json.loads(resp.read().decode())


# 1. Wait for SignalK
print("Waiting for SignalK to start...")
for i in range(15):
    try:
        data = get_json("http://halos.local:3000/signalk")
        ver = data["server"]["version"]
        print(f"SignalK v{ver} is UP")
        break
    except Exception:
        time.sleep(3)
else:
    print("SignalK not responding after 45s!")
    exit(1)

time.sleep(2)

# 2. Check sources
sources = get_json("http://halos.local:3000/signalk/v1/api/sources")
print(f"Sources: {list(sources.keys())}")

# 3. Send a few NMEA bursts via UDP
target = socket.gethostbyname("halos.local")
print(f"\nSending NMEA via UDP to {target}:10113...")
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)


def nmea_ck(s):
    ck = 0
    for ch in s:
        ck ^= ord(ch)
    return "%02X" % ck


from datetime import datetime, timezone

for i in range(5):
    now = datetime.now(timezone.utc)
    ts = now.strftime("%H%M%S.00")
    dt = now.strftime("%d%m%y")

    sentences = []
    body = f"GPRMC,{ts},A,3205.1180,N,03446.9080,E,5.5,137.0,{dt},,,A"
    sentences.append(f"${body}*{nmea_ck(body)}\r\n")
    body = f"GPGGA,{ts},3205.1180,N,03446.9080,E,1,09,0.9,15.0,M,17.0,M,,"
    sentences.append(f"${body}*{nmea_ck(body)}\r\n")
    body = "HEHDT,137.0,T"
    sentences.append(f"${body}*{nmea_ck(body)}\r\n")
    body = "SDDBT,49.2,f,15.0,M,8.2,F"
    sentences.append(f"${body}*{nmea_ck(body)}\r\n")
    body = "WIMWV,045.0,R,12.5,N,A"
    sentences.append(f"${body}*{nmea_ck(body)}\r\n")
    body = "IIMTW,22.5,C"
    sentences.append(f"${body}*{nmea_ck(body)}\r\n")

    for s in sentences:
        sock.sendto(s.encode("ascii"), (target, 10113))
    print(f"  Burst {i + 1}: sent {len(sentences)} sentences")
    time.sleep(1)

sock.close()
print("\nWaiting 5s for InfluxDB writes...")
time.sleep(5)

# 4. Check SignalK sources again
sources = get_json("http://halos.local:3000/signalk/v1/api/sources")
print(f"Sources after NMEA: {list(sources.keys())}")
if "nmea-simulator" in sources:
    print("  nmea-simulator source is ACTIVE")

# 5. Check InfluxDB for data
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("halos.local", username="pi", password="halos", timeout=10)

cmd = 'influx -database signalk -execute "SHOW MEASUREMENTS" 2>&1'
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
out = stdout.read().decode().strip()
print(f"\nInfluxDB measurements:\n{out}")

cmd2 = 'influx -database signalk -execute "SELECT * FROM /./ LIMIT 3" 2>&1'
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=15)
out2 = stdout.read().decode().strip()
print(f"\nInfluxDB sample data:\n{out2[:500]}")

ssh.close()
print("\nDone.")
