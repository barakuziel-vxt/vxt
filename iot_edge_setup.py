"""Azure IoT Edge setup helper — runs commands on Pi via SSH."""
import paramiko
import sys
import time

def get_ssh():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect('halos.local', username='pi', password='halos', timeout=10)
    return c

def run(c, cmd, timeout=30):
    print(f'\n>>> {cmd}')
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    rc = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err:
        print(f'STDERR: {err}')
    print(f'EXIT: {rc}')
    return out, err, rc

def main():
    step = sys.argv[1] if len(sys.argv) > 1 else 'assess'
    c = get_ssh()

    if step == 'assess':
        run(c, 'uname -m')
        run(c, 'cat /etc/os-release | grep VERSION_CODENAME')
        run(c, 'sudo docker ps -a --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}"')
        run(c, 'docker --version')
        run(c, 'sudo ss -tlnp | grep 8086')
        run(c, 'systemctl is-active influxdb')
        run(c, 'dpkg -l | grep -i influx')
        run(c, 'ls /etc/apt/sources.list.d/ 2>/dev/null')
        run(c, 'dpkg -l | grep -iE "moby|aziot" || echo NO_IOTEDGE')

    elif step == 'stop-influxdb':
        run(c, 'sudo systemctl stop influxdb')
        run(c, 'sudo systemctl disable influxdb')
        run(c, 'sudo systemctl mask influxdb')
        run(c, 'systemctl is-active influxdb')
        run(c, 'sudo ss -tlnp | grep 8086 || echo PORT_8086_FREE')

    elif step == 'add-msft-repo':
        # Add Microsoft package signing key and repo for Debian arm64
        run(c, 'curl -sSL https://packages.microsoft.com/keys/microsoft.asc | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc > /dev/null', timeout=30)
        # Use bookworm (Debian 12) packages — closest supported release for trixie (13)
        run(c, 'echo "deb [arch=arm64 signed-by=/etc/apt/trusted.gpg.d/microsoft.asc] https://packages.microsoft.com/debian/12/prod bookworm main" | sudo tee /etc/apt/sources.list.d/microsoft-prod.list', timeout=15)
        run(c, 'cat /etc/apt/sources.list.d/microsoft-prod.list')
        run(c, 'sudo apt-get update 2>&1 | tail -5', timeout=120)

    elif step == 'install-iotedge':
        # Install moby-engine (Docker replacement managed by IoT Edge) and aziot-edge
        run(c, 'sudo apt-get install -y moby-engine 2>&1 | tail -10', timeout=300)
        run(c, 'sudo apt-get install -y aziot-edge 2>&1 | tail -10', timeout=300)
        run(c, 'iotedge version')

    elif step == 'provision':
        conn_str = sys.argv[2] if len(sys.argv) > 2 else ''
        if not conn_str:
            print('ERROR: Pass connection string as second argument')
            c.close()
            return
        run(c, f"sudo iotedge config mp --connection-string '{conn_str}'", timeout=15)
        run(c, 'sudo iotedge config apply', timeout=30)
        time.sleep(5)
        run(c, 'sudo iotedge system status', timeout=15)
        run(c, 'sudo iotedge list', timeout=15)

    elif step == 'check':
        run(c, 'sudo iotedge system status', timeout=15)
        run(c, 'sudo iotedge list', timeout=15)
        run(c, 'sudo iotedge check --output json 2>/dev/null | head -50 || sudo iotedge check 2>&1 | head -30', timeout=60)

    c.close()

if __name__ == '__main__':
    main()
