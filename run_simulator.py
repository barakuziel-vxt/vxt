#!/usr/bin/env python3
"""
IoT Hub Device Connection String Fetcher
Gets the connection string for the device without hanging azure CLI
"""

import subprocess
import json
import sys
import os

def run_command(cmd, timeout=10):
    """Run shell command with timeout"""
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            capture_output=True, 
            text=True, 
            timeout=timeout,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        )
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timeout", 1
    except Exception as e:
        return "", str(e), 1

def main():
    print("=" * 70)
    print("IoT Hub Device Setup and Simulator")
    print("=" * 70)
    
    # Get connection string
    print("\n[1] Retrieving IoT Hub device connection string...")
    
    cmd = (
        'az iot hub device-identity connection-string show '
        '--device-id TomerRefael --hub-name vxt-hub '
        '--resource-group VXT-IoT-Hub --query "connectionString" -o tsv'
    )
    
    stdout, stderr, rc = run_command(cmd, timeout=20)
    
    if rc == 0 and stdout:
        conn_str = stdout
        print(f"✓ Connection string retrieved")
        print(f"  Device: TomerRefael")
        print(f"  Start: {conn_str[:60]}...")
    else:
        print(f"✗ Failed to get connection string")
        print(f"  Error: {stderr}")
        print(f"\nTrying to create device...")
        
        # Try to create device
        create_cmd = (
            'az iot hub device-identity create --device-id TomerRefael '
            '--hub-name vxt-hub --resource-group VXT-IoT-Hub --auth-method shared_private_key'
        )
        stdout, stderr, rc = run_command(create_cmd, timeout=20)
        
        if rc == 0:
            print("✓ Device created")
            
            # Try again to get connection string
            stdout, stderr, rc = run_command(cmd, timeout=20)
            if rc == 0 and stdout:
                conn_str = stdout
                print("✓ Connection string retrieved")
                print(f"  Start: {conn_str[:60]}...")
            else:
                print("✗ Still cannot get connection string")
                sys.exit(1)
        else:
            print(f"✗ Failed to create device: {stderr}")
            sys.exit(1)
    
    # Set environment variable and run simulator
    print("\n[2] Running telemetry simulator...")
    
    os.environ['IOT_DEVICE_CONNECTION_STRING'] = conn_str
    
    # Run Python simulator
    import asyncio
    from pathlib import Path
    
    # Import the simulator
    sys.path.insert(0, str(Path(__file__).parent))
    
    try:
        # Import and run simulator directly
        from simulate_iot_hub_telemetry import IoTHubTelemetrySimulator
        
        async def run():
            simulator = IoTHubTelemetrySimulator()
            try:
                await simulator.connect()
                await simulator.run_simulation(duration_minutes=5, interval_seconds=10)
            finally:
                await simulator.disconnect()
        
        asyncio.run(run())
        
    except ImportError as e:
        print(f"✗ Failed to import simulator: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Simulation failed: {e}")
        sys.exit(1)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
