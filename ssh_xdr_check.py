import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('halos.local', username='pi', password='halos', timeout=10)

def run(cmd):
    """Run a command via SSH."""
    transport = c.get_transport()
    chan = transport.open_session()
    chan.get_pty()            # allocate PTY so sudo works
    chan.exec_command(f'echo halos | sudo -S bash -c \'{cmd}\'')
    import time; time.sleep(2)
    out = b''
    while chan.recv_ready():
        out += chan.recv(4096)
    chan.close()
    return out.decode()

# Find XDR related files inside container
SSERVER = '/home/node/signalk/node_modules/signalk-server'
NMEA = f'{SSERVER}/node_modules/@signalk/nmea0183-signalk'
cmds = [
    # Read the custom-sentence-plugin code
    f'docker exec a8c8420c316d cat {NMEA}/custom-sentence-plugin/index.js 2>/dev/null',
    f'docker exec a8c8420c316d cat {NMEA}/custom-sentence-plugin/package.json 2>/dev/null',
    # Check more of the Parser code - the parse method for unknown sentences
    f'docker exec a8c8420c316d cat {NMEA}/lib/CompatParser.js 2>/dev/null',
    # Check the signalk-server npm AppStore / available plugins API
    f'docker exec a8c8420c316d cat {SSERVER}/dist/pipedproviders.js 2>/dev/null | head -80',
]

for cmd in cmds:
    out = run(cmd)
    print(f'=== {cmd[:80]} ===')
    print(out[:5000])

c.close()

# ═══════════════════════════════════════════════════════════════════════════════
# EntityAttribute Code Changes (March 23, 2026)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Apply 10 attribute code updates to match new SignalK paths for all yacht types (4,5,6,7)
# Example: propulsion.main.fuelRate → propulsion.main.fuel.rate
#
# Note: Run this section if you need to update the DB from this script
# Otherwise, run the SQL UPDATE operations directly in Azure/local database
#
# SQL_UPDATES = [
#     # Fuel Rate
#     "UPDATE EntityTypeAttribute SET entityTypeAttributeCode = 'propulsion.main.fuel.rate' WHERE entityTypeAttributeCode = 'propulsion.main.fuelRate' AND entityTypeId IN (4,5,6,7)",
#     # Fuel Pressure
#     "UPDATE EntityTypeAttribute SET entityTypeAttributeCode = 'propulsion.main.fuel.pressure' WHERE entityTypeAttributeCode = 'propulsion.main.fuelPressure' AND entityTypeId IN (4,5,6,7)",
#     # Navigation Latitude
#     "UPDATE EntityTypeAttribute SET entityTypeAttributeCode = 'navigation.position.value.latitude' WHERE entityTypeAttributeCode = 'navigation.position.latitude' AND entityTypeId IN (4,5,6,7)",
#     # Navigation Longitude
#     "UPDATE EntityTypeAttribute SET entityTypeAttributeCode = 'navigation.position.value.longitude' WHERE entityTypeAttributeCode = 'navigation.position.longitude' AND entityTypeId IN (4,5,6,7)",
#     # Water Temperature (→ Coolant Temperature)
#     "UPDATE EntityTypeAttribute SET entityTypeAttributeCode = 'propulsion.main.coolantTemperature' WHERE entityTypeAttributeCode = 'propulsion.main.waterTemperature' AND entityTypeId IN (4,5,6,7)",
#     # Gearbox Oil Temperature
#     "UPDATE EntityTypeAttribute SET entityTypeAttributeCode = 'propulsion.main.transmission.oilTemperature' WHERE entityTypeAttributeCode = 'propulsion.main.gearboxOilTemperature' AND entityTypeId IN (4,5,6,7)",
#     # Fuel Tank Level
#     "UPDATE EntityTypeAttribute SET entityTypeAttributeCode = 'tanks.fuel.0.currentLevel' WHERE entityTypeAttributeCode = 'tanks.fuelTank.level' AND entityTypeId IN (4,5,6,7)",
#     # Fresh Water Tank Level
#     "UPDATE EntityTypeAttribute SET entityTypeAttributeCode = 'tanks.freshWater.0.currentLevel' WHERE entityTypeAttributeCode = 'tanks.freshWaterTank.level' AND entityTypeId IN (4,5,6,7)",
#     # House Battery Voltage
#     "UPDATE EntityTypeAttribute SET entityTypeAttributeCode = 'electrical.batteries.main.voltage' WHERE entityTypeAttributeCode = 'electrical.dc.houseBattery.voltage' AND entityTypeId IN (4,5,6,7)",
#     # Alternator Output
#     "UPDATE EntityTypeAttribute SET entityTypeAttributeCode = 'electrical.alternators.main.voltage' WHERE entityTypeAttributeCode = 'propulsion.main.alternatorOutput' AND entityTypeId IN (4,5,6,7)",
# ]
#
# TO EXECUTE: Run these SQL UPDATE statements in Azure SQL or local database
# Status: ✅ Applied via manual SQL execution (March 23, 2026)
