"""
VXT Cloud API – FastAPI application
====================================
Serves the Device Twin JSON for Azure IoT Edge modules.
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services import get_device_config, register_device_in_azure, upsert_iot_device

app = FastAPI(
    title="VXT Cloud API",
    version="1.0.0",
    description="Generates Azure IoT Edge Device Twin JSON from SQL database.",
)


class DeviceRegisterRequest(BaseModel):
    entityId: str
    deviceId: str


@app.get("/api/v1/twin/{entity_id}")
async def get_device_twin(entity_id: str):
    """Generate the full Device Twin JSON for a given device (entity_id)."""

    config = get_device_config(entity_id)

    # No telemetry AND no alarms AND no geofences → device not found
    if not config["telemetry"] and not config["alarms"] and not config["geofences"]:
        raise HTTPException(
            status_code=404,
            detail=f"No configuration found for entity_id '{entity_id}'",
        )

    # ── Build the Device Twin structure ──
    twin = {
        "properties": {
            "desired": {
                "telemetry": {
                    "bulk_interval_seconds": 300,
                    "tiered_paths": config["telemetry"],
                },
                "alarms": {
                    "siren_gpio_enabled": True,
                    **config["alarms"],
                },
                "geofences": config["geofences"],
            }
        }
    }

    return JSONResponse(content=twin)


@app.post("/api/v1/device/register")
async def register_device(req: DeviceRegisterRequest):
    """Register an Edge device in Azure IoT Hub and save to SQL."""
    try:
        result = await register_device_in_azure(req.deviceId)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Azure IoT Hub error: {exc}",
        )

    upsert_iot_device(
        entity_id=req.entityId,
        device_id=req.deviceId,
        hostname=result["hostname"],
        connection_string=result["connection_string"],
    )

    return JSONResponse(content={
        "entityId": req.entityId,
        "deviceId": req.deviceId,
        "hostname": result["hostname"],
        "connectionString": result["connection_string"],
        "provisioningStatus": "Provisioned",
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
