"""Deploy VXT Orchestrator to Raspberry Pi 5 (halos.local) via SSH."""
import os
import paramiko

HOST = "halos.local"
USER = "pi"
PASS = "halos"
REMOTE_DIR = "/home/pi/vxt-orchestrator"
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    print(f"Connecting to {USER}@{HOST} ...")
    ssh.connect(HOST, username=USER, password=PASS, timeout=10)
    print("Connected.")

    # Create remote directory
    cmds_setup = [
        f"mkdir -p {REMOTE_DIR}",
    ]
    for cmd in cmds_setup:
        print(f"  $ {cmd}")
        _, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        if out: print(f"    {out}")
        if err: print(f"    (stderr) {err}")

    # SFTP files
    files_to_copy = ["main.py", "requirements.txt"]
    sftp = ssh.open_sftp()
    for f in files_to_copy:
        local_path = os.path.join(LOCAL_DIR, f)
        remote_path = f"{REMOTE_DIR}/{f}"
        print(f"  Uploading {f} -> {remote_path}")
        sftp.put(local_path, remote_path)
    sftp.close()
    print("Files uploaded.")

    # Install venv + deps, create systemd service
    install_cmds = [
        f"cd {REMOTE_DIR} && python3 -m venv .venv",
        f"cd {REMOTE_DIR} && .venv/bin/pip install --upgrade pip",
        f"cd {REMOTE_DIR} && .venv/bin/pip install -r requirements.txt",
    ]
    for cmd in install_cmds:
        print(f"  $ {cmd}")
        _, stdout, stderr = ssh.exec_command(cmd, timeout=120)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        # pip writes progress to stderr, show last few lines
        if out:
            lines = out.split('\n')
            for line in lines[-5:]:
                print(f"    {line}")
        if err:
            lines = err.split('\n')
            for line in lines[-3:]:
                print(f"    {line}")
        if exit_code != 0:
            print(f"    ⚠ exit code {exit_code}")

    # Create systemd service file
    service_content = f"""[Unit]
Description=VXT Orchestrator - Azure IoT Edge Module
After=network-online.target signalk.service
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory={REMOTE_DIR}
ExecStart={REMOTE_DIR}/.venv/bin/python {REMOTE_DIR}/main.py
Restart=always
RestartSec=10
Environment=SIGNALK_BASE_URL=http://localhost:3000
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""
    # Write service file via SSH
    escaped = service_content.replace("'", "'\\''")
    write_cmd = f"echo '{escaped}' | sudo -S tee /etc/systemd/system/vxt-orchestrator.service > /dev/null"
    print("  Creating systemd service ...")
    stdin, stdout, stderr = ssh.exec_command(f"echo 'halos' | sudo -S bash -c \"cat > /etc/systemd/system/vxt-orchestrator.service << 'SERVICEEOF'\n{service_content}SERVICEEOF\"")
    stdout.channel.recv_exit_status()

    # Enable and start
    systemd_cmds = [
        "echo 'halos' | sudo -S systemctl daemon-reload",
        "echo 'halos' | sudo -S systemctl enable vxt-orchestrator.service",
        "echo 'halos' | sudo -S systemctl restart vxt-orchestrator.service",
        "systemctl status vxt-orchestrator.service --no-pager -l",
    ]
    for cmd in systemd_cmds:
        print(f"  $ {cmd.split('|')[-1].strip()}")
        _, stdout, stderr = ssh.exec_command(cmd)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        if out:
            for line in out.split('\n'):
                print(f"    {line}")
        if err and "password" not in err.lower():
            for line in err.split('\n')[-3:]:
                print(f"    {line}")

    print("\n✓ VXT Orchestrator deployed and running on halos.local")
    print(f"  Files: {REMOTE_DIR}/")
    print(f"  Service: vxt-orchestrator.service")
    print(f"  Logs: ssh pi@halos.local 'journalctl -u vxt-orchestrator -f'")

    ssh.close()

if __name__ == "__main__":
    main()
