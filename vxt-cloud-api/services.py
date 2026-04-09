"""
VXT Cloud API – Service layer
==============================
Data extraction and mapping logic.  Queries the SQL database and returns
clean Python structures ready to be assembled into Device Twin JSON.
"""

import json
import os
from collections import defaultdict

from azure.iot.hub import IoTHubRegistryManager
from azure.iot.hub.models import Device

from database import query_as_dicts, execute_sql

IOT_HUB_CONNECTION_STRING = os.getenv("IOT_HUB_CONNECTION_STRING", "")


async def register_device_in_azure(device_id: str) -> dict:
    """Register (or retrieve) an Azure IoT Edge device and return its info.

    Returns
    -------
    dict with ``connection_string`` and ``hostname``.
    """
    if not IOT_HUB_CONNECTION_STRING:
        raise RuntimeError("IOT_HUB_CONNECTION_STRING environment variable is not set")

    registry = IoTHubRegistryManager(IOT_HUB_CONNECTION_STRING)

    # Check if device already exists
    try:
        device = registry.get_device(device_id)
    except Exception:
        # Device doesn't exist – create it as an Edge device
        device = Device(device_id=device_id)
        device.capabilities = {"iotEdge": True}
        device = registry.create_device_with_sas(
            device_id=device_id,
            primary_key=None,   # auto-generate
            secondary_key=None, # auto-generate
            status="enabled",
            iot_edge=True,
        )

    # Extract hostname from the hub connection string
    hostname = ""
    for part in IOT_HUB_CONNECTION_STRING.split(";"):
        if part.lower().startswith("hostname="):
            hostname = part.split("=", 1)[1]
            break

    primary_key = device.authentication.symmetric_key.primary_key
    connection_string = (
        f"HostName={hostname};"
        f"DeviceId={device_id};"
        f"SharedAccessKey={primary_key}"
    )

    return {
        "connection_string": connection_string,
        "hostname": hostname,
    }


def upsert_iot_device(entity_id: str, device_id: str, hostname: str,
                       connection_string: str) -> None:
    """Insert or update the EntityIoTDevice row for this entity."""
    existing = query_as_dicts(
        "SELECT entityIoTDeviceId FROM EntityIoTDevice WHERE entityId = ?",
        (entity_id,),
    )

    if existing:
        execute_sql(
            """
            UPDATE EntityIoTDevice
            SET deviceId = ?,
                iotHubHostname = ?,
                connectionString = ?,
                provisioningStatus = 'Provisioned',
                active = 'Y',
                lastUpdateTimestamp = GETDATE()
            WHERE entityId = ?
            """,
            (device_id, hostname, connection_string, entity_id),
        )
    else:
        execute_sql(
            """
            INSERT INTO EntityIoTDevice
                (entityId, deviceId, iotHubHostname, connectionString,
                 provisioningStatus, active)
            VALUES (?, ?, ?, ?, 'Provisioned', 'Y')
            """,
            (entity_id, device_id, hostname, connection_string),
        )


def get_device_config(entity_id: str) -> dict:
    """Fetch telemetry tiers, alarm scores, and geofences for a device.

    Parameters
    ----------
    entity_id : str
        The Entity.entityId (NVARCHAR) that identifies the device.

    Returns
    -------
    dict with keys ``telemetry``, ``alarms``, ``geofences``.
    """

    # ------------------------------------------------------------------
    # 1. Resolve entityTypeId and customerId for this device
    # ------------------------------------------------------------------
    device_rows = query_as_dicts(
        """
        SELECT e.entityTypeId, ce.customerId
        FROM Entity e
        JOIN CustomerEntities ce ON ce.entityId = e.entityId AND ce.active = 'Y'
        WHERE e.entityId = ? AND e.active = 'Y'
        """,
        (entity_id,),
    )
    if not device_rows:
        return {"telemetry": {}, "alarms": {}, "geofences": []}

    entity_type_id = device_rows[0]["entityTypeId"]
    customer_id = device_rows[0]["customerId"]

    # ------------------------------------------------------------------
    # 2. Telemetry – tiered SignalK paths
    # ------------------------------------------------------------------
    attr_rows = query_as_dicts(
        """
        SELECT entityTypeAttributeCode, entityTypeAttributeTimeAspect
        FROM EntityTypeAttribute
        WHERE entityTypeId = ? AND active = 'Y'
        """,
        (entity_type_id,),
    )

    tiered_paths: dict[str, list[str]] = defaultdict(list)
    for row in attr_rows:
        tier = str(row["entityTypeAttributeTimeAspect"])
        path = row["entityTypeAttributeCode"]
        tiered_paths[tier].append(path)

    telemetry = dict(tiered_paths)  # convert defaultdict → plain dict

    # ------------------------------------------------------------------
    # 3. Alarms – multiple score ranges per path
    # ------------------------------------------------------------------
    score_rows = query_as_dicts(
        """
        SELECT a.entityTypeAttributeCode,
               s.MinValue, s.MaxValue, s.Score
        FROM EntityTypeAttributeScore s
        JOIN EntityTypeAttribute a
             ON a.entityTypeAttributeId = s.EntityTypeAttributeId
        WHERE a.entityTypeId = ? AND a.active = 'Y' AND s.active = 'Y'
        ORDER BY a.entityTypeAttributeCode, s.MinValue
        """,
        (entity_type_id,),
    )

    alarms: dict[str, list[dict]] = defaultdict(list)
    for row in score_rows:
        path = row["entityTypeAttributeCode"]
        alarms[path].append({
            "min": float(row["MinValue"]),
            "max": float(row["MaxValue"]),
            "score": int(row["Score"]),
        })

    alarms = dict(alarms)

    # ------------------------------------------------------------------
    # 4. Geofences – polygon & circle, parse JSON coordinates
    # ------------------------------------------------------------------
    geo_rows = query_as_dicts(
        """
        SELECT g.customerGeofenceCriteriaId,
               g.geofenceName,
               g.geoType,
               g.coordinates,
               g.radius
        FROM CustomerGeofenceCriteria g
        WHERE g.customerId = ? AND g.active = 'Y'
        """,
        (customer_id,),
    )

    geofences: list[dict] = []
    for row in geo_rows:
        coords_raw = row["coordinates"]
        # coordinates is stored as a JSON string – parse to native Python
        if isinstance(coords_raw, str):
            coords = json.loads(coords_raw)
        else:
            coords = coords_raw

        fence = {
            "id": row["customerGeofenceCriteriaId"],
            "name": row["geofenceName"],
            "type": row["geoType"],
            "coordinates": coords,
        }
        # Circle geofences carry a radius
        if row["geoType"] == "Circle" and row.get("radius") is not None:
            fence["radius"] = float(row["radius"])

        geofences.append(fence)

    return {
        "telemetry": telemetry,
        "alarms": alarms,
        "geofences": geofences,
    }
