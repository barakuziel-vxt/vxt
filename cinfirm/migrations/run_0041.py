"""
Migration 0041: Rename hex OBD PID codes to obd.* named codes.
Steps:
  1. INSERT new ProtocolAttribute rows for obd.* codes (satisfies FK constraint)
  2. UPDATE EntityTypeAttribute codes from hex to obd.*
Idempotent — safe to run multiple times.
"""
import os, sys
import pyodbc
from dotenv import load_dotenv

load_dotenv()
server   = os.getenv('DB_SERVER',   '127.0.0.1')
database = os.getenv('DB_NAME',     'BoatTelemetryDB')
username = os.getenv('DB_USER',     'sa')
password = os.getenv('DB_PASSWORD', 'Real_Password_123!')

conn_str = f'DRIVER={{SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password};'
conn = pyodbc.connect(conn_str, autocommit=True, timeout=10)
cur  = conn.cursor()

# Mapping: (old hex code, new obd.* code, name, description)
RENAMES = [
    ('010C', 'obd.engineRpm',        'Engine RPM',                        'Engine speed in revolutions per minute'),
    ('010D', 'obd.vehicleSpeed',     'Vehicle Speed',                     'Vehicle speed km/h'),
    ('0105', 'obd.coolantTemp',      'Engine Coolant Temperature',        'Engine coolant temperature Celsius'),
    ('0111', 'obd.throttlePos',      'Throttle Position',                 'Throttle position percentage'),
    ('012F', 'obd.fuelLevel',        'Fuel Tank Level Input',             'Fuel tank level as percentage of full'),
    ('0110', 'obd.mafRate',          'Mass Air Flow Rate',                'Mass air flow sensor rate g/s'),
    ('0104', 'obd.engineLoad',       'Calculated Engine Load',            'Engine load as percentage of max torque'),
    ('010F', 'obd.intakeAirTemp',    'Intake Air Temperature',            'Intake air temperature Celsius'),
    ('010B', 'obd.manifoldPressure', 'Intake Manifold Absolute Pressure', 'Intake manifold absolute pressure kPa'),
    ('010E', 'obd.timingAdvance',    'Timing Advance',                    'Ignition timing advance degrees before TDC'),
    ('015C', 'obd.oilTemp',          'Engine Oil Temperature',            'Engine oil temperature Celsius'),
    ('0142', 'obd.moduleVoltage',    'Control Module Voltage',            'Control module supply voltage V'),
    ('015E', 'obd.fuelRate',         'Engine Fuel Rate',                  'Engine fuel rate L/h'),
    ('015A', 'obd.accelPedalPos',    'Relative Accel Pedal Position',     'Relative accelerator pedal position percent'),
]

# --- Step 1: Insert ProtocolAttribute rows for obd.* codes (FK target) ------
ins_pa = """
INSERT INTO dbo.ProtocolAttribute
    (protocolId, protocolAttributeCode, protocolAttributeName, description, dataType, jsonPath, active)
SELECT p.protocolId, ?, ?, ?, 'numeric', ?, 'Y'
FROM dbo.Protocol p
WHERE p.protocolName = 'SARJ1979'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.ProtocolAttribute x
      WHERE x.protocolId = p.protocolId AND x.protocolAttributeCode = ?
  )
"""

pa_inserted = 0
for old_code, new_code, name, desc in RENAMES:
    json_path = f'$.measurements.{new_code}'
    cur.execute(ins_pa, (new_code, name, desc, json_path, new_code))
    if cur.rowcount > 0:
        pa_inserted += 1
print(f"[1/2] ProtocolAttribute: {pa_inserted} new obd.* rows inserted")

# --- Step 2: Update EntityTypeAttribute codes from hex to obd.* -------------
upd_eta = """
UPDATE dbo.EntityTypeAttribute
SET    entityTypeAttributeCode = ?
WHERE  entityTypeAttributeCode = ?
  AND  entityTypeId = (
           SELECT entityTypeId FROM dbo.EntityType WHERE entityTypeName = 'Car'
       )
"""

updated = 0
skipped = 0
for old_code, new_code, _name, _desc in RENAMES:
    cur.execute(upd_eta, (new_code, old_code))
    n = cur.rowcount
    if n > 0:
        print(f"  UPDATED  {old_code:6s} → {new_code}  ({n} row)")
        updated += n
    else:
        print(f"  skipped  {old_code:6s}  (already renamed or not present)")
        skipped += 1

print(f"\n[2/2] EntityTypeAttribute: {updated} rows updated, {skipped} already done.")
print("Migration 0041 complete.")
conn.close()

