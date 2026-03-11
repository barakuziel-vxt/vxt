"""
Setup Management Service API
Provides endpoints for:
- Exporting provider setup from MSSQL as JSON
- Updating Device Twin with new setup
- Monitoring setup change events
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import logging
import os
from setup_exporter import SetupExporter
from typing import Optional

logger = logging.getLogger(__name__)

# Create setup management router
router = APIRouter(prefix="/api/setup", tags=["setup"])

# IoT Hub connection string (from environment)
IOT_HUB_CONNECTION_STRING = os.environ.get('IOT_HUB_CONNECTION_STRING')

# Database configuration
DB_SERVER = os.environ.get('DB_SERVER', 'vxtdb.database.windows.net')
DB_NAME = os.environ.get('DB_NAME', 'free-sql-db-5949639')
DB_USER = os.environ.get('DB_USER', 'vxt')
DB_PASSWORD = os.environ.get('DB_PASSWORD')


@router.get("/export/{provider_name}", response_class=JSONResponse)
async def export_provider_setup(provider_name: str):
    """
    Export provider setup from MSSQL as JSON
    
    Used by:
    - Dashboard "View Setup" button (read-only)
    - FastAPI /setup/sync endpoint (for Device Twin updates)
    - Manual setup verification
    
    Args:
        provider_name: Provider name (e.g., 'N2KToSignalK', 'Junction')
    
    Returns:
        JSON setup dict with provider metadata, entity types, attributes, events, entities
        
    Example:
        GET /api/setup/export/N2KToSignalK
        
        Response:
        {
          "metadata": {
            "provider_id": 1,
            "provider_name": "N2KToSignalK",
            "topic_name": "boat-telemetry",
            "batch_size": 100
          },
          "entity_types": [...],
          "attributes": [...],
          "events": [...],
          "entities": [...]
        }
    """
    try:
        exporter = SetupExporter(
            db_server=DB_SERVER,
            db_name=DB_NAME,
            db_user=DB_USER,
            db_password=DB_PASSWORD
        )
        
        setup_config = exporter.export_provider_setup(provider_name)
        
        if not setup_config:
            raise HTTPException(
                status_code=404,
                detail=f"Provider '{provider_name}' not found"
            )
        
        logger.info(f"✓ Exported setup for provider: {provider_name}")
        return setup_config
    
    except Exception as e:
        logger.error(f"Failed to export setup for {provider_name}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export setup: {str(e)}"
        )


@router.post("/sync/{device_id}/{provider_name}")
async def sync_device_setup(device_id: str, provider_name: str, background_tasks: BackgroundTasks):
    """
    Export provider setup and sync to Device Twin
    
    Triggered by:
    - Dashboard "Update Setup" button (for specific device)
    - Subscription change event
    - Manual setup update via API
    
    The function:
    1. Exports provider setup from MSSQL
    2. Updates Device Twin properties.desired.setup with exported config
    3. Device receives update notification via MQTT twin change topic
    4. Device reloads setup and applies changes
    
    Args:
        device_id: Azure IoT device ID (e.g., 'TomerRefael')
        provider_name: Provider name (e.g., 'N2KToSignalK')
    
    Returns:
        Sync status and summary of what was updated
        
    Example:
        POST /api/setup/sync/TomerRefael/N2KToSignalK
        
        Response:
        {
          "status": "success",
          "device_id": "TomerRefael",
          "provider_name": "N2KToSignalK",
          "setup_exported": true,
          "twin_updated": true,
          "entities_count": 5,
          "attributes_count": 42,
          "events_count": 15,
          "message": "Device Twin synced successfully"
        }
    """
    try:
        if not IOT_HUB_CONNECTION_STRING:
            logger.warning("IOT_HUB_CONNECTION_STRING not configured - Device Twin sync disabled")
            return {
                "status": "warning",
                "message": "Device Twin sync disabled (IOT_HUB_CONNECTION_STRING not set)"
            }
        
        # Export setup from MSSQL
        exporter = SetupExporter(
            db_server=DB_SERVER,
            db_name=DB_NAME,
            db_user=DB_USER,
            db_password=DB_PASSWORD
        )
        
        setup_config = exporter.export_provider_setup(provider_name)
        
        if not setup_config:
            raise HTTPException(
                status_code=404,
                detail=f"Provider '{provider_name}' not found"
            )
        
        # Update Device Twin in background
        background_tasks.add_task(
            _update_device_twin,
            device_id=device_id,
            provider_name=provider_name,
            setup_config=setup_config
        )
        
        logger.info(f"✓ Queued Device Twin sync for device: {device_id} (provider: {provider_name})")
        
        return {
            "status": "queued",
            "device_id": device_id,
            "provider_name": provider_name,
            "setup_exported": True,
            "entities_count": len(setup_config.get('entities', [])),
            "attributes_count": len(setup_config.get('attributes', [])),
            "events_count": len(setup_config.get('events', [])),
            "message": "Setup exported, Device Twin sync queued"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to sync device setup: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync setup: {str(e)}"
        )


async def _update_device_twin(device_id: str, provider_name: str, setup_config: dict):
    """
    Update Device Twin with new setup configuration
    
    Runs in background task to avoid blocking the API response
    """
    try:
        from azure.iot.hub import IoTHubRegistryManager
        from azure.iot.hub.models import Twin, TwinProperties
        
        # Create registry manager
        registry_manager = IoTHubRegistryManager.from_connection_string(IOT_HUB_CONNECTION_STRING)
        
        # Get current twin
        twin = registry_manager.get_twin(device_id)
        logger.info(f"[Twin] Retrieved current twin for device: {device_id}")
        
        # Update desired properties with new setup
        twin_patch = Twin()
        twin_patch.properties = TwinProperties(desired={
            'setup': setup_config,
            'provider_name': provider_name,
            'last_updated': __import__('datetime').datetime.utcnow().isoformat()
        })
        
        # Apply patch to Device Twin
        updated_twin = registry_manager.update_twin(device_id, twin_patch)
        logger.info(f"[Twin] ✓ Updated device twin for {device_id}")
        logger.info(f"[Twin]   Provider: {provider_name}")
        logger.info(f"[Twin]   Entities: {len(setup_config.get('entities', []))}")
        logger.info(f"[Twin]   Attributes: {len(setup_config.get('attributes', []))}")
        logger.info(f"[Twin]   Events: {len(setup_config.get('events', []))}")
        
        # Device will receive update notification and reload config
        logger.info(f"[Twin] Device will receive update notification via MQTT")
        
    except ImportError:
        logger.warning("azure.iot.hub not available - Device Twin update failed")
    except Exception as e:
        logger.error(f"[Twin] Failed to update device twin for {device_id}: {e}", exc_info=True)


@router.get("/export/{entity_id}", response_class=JSONResponse)
async def export_entity_setup(entity_id: int):
    """
    Export setup for a specific entity (filtered)
    
    Used by:
    - Dashboard to show entity-specific setup
    - API to get minimal setup for a single entity
    
    Args:
        entity_id: Entity ID (e.g., 1)
    
    Returns:
        JSON setup filtered to only include this entity and its providers
    """
    try:
        exporter = SetupExporter(
            db_server=DB_SERVER,
            db_name=DB_NAME,
            db_user=DB_USER,
            db_password=DB_PASSWORD
        )
        
        setup_config = exporter.export_for_entity(entity_id)
        
        if not setup_config:
            raise HTTPException(
                status_code=404,
                detail=f"Entity {entity_id} not found"
            )
        
        logger.info(f"✓ Exported setup for entity: {entity_id}")
        return setup_config
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export setup for entity {entity_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export setup: {str(e)}"
        )


# Export router for use in main.py
__all__ = ['router']
