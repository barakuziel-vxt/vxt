"""Utility to execute commands on the Pi via SSH."""
import paramiko
import sys

def ssh_exec(cmd: str, timeout: int = 60) -> tuple[str, str, int]:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('halos.local', username='pi', password='halos', timeout=10)
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    rc = stdout.channel.recv_exit_status()
    ssh.close()
    return out, err, rc

if __name__ == '__main__':
    cmd = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else 'echo hello'
    out, err, rc = ssh_exec(cmd)
    if out: print(out)
    if err: print('STDERR:', err)
    print(f'EXIT: {rc}')
