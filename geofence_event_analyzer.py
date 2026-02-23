#!/usr/bin/env python3
"""
Geofence Event Analyzer
Analyzes entity positions against customer geofences to detect geofence entry/exit events
Integrates with subscription_analysis_worker for event registration

Expected to be called by subscription_analysis_worker with:
- entity_id: Entity ID (boat/person)
- event_id: Event ID (from Event table)
- event_criteria: Not used for geofence (always empty list)
- telemetry_data: EntityTelemetry records with position data
- triggered_at: Timestamp when analysis triggered
- analysis_window_min: Lookback window in minutes
- function_params: Optional params (future use)
- event_params: Optional event-specific params
- connection: Database connection

Returns dict with:
- status: 'success' or 'error'
- cumulative_score: Score (0 = no breach, 1+ = inside geofence(s))
- probability: Confidence level (0.5 for geofence: either in or out)
- details: List of [attr_id, telemetry_id, score_contribution, within_range] records
- analysisMetadata: JSON metadata from analysis
"""

import logging
from datetime import datetime, timezone
from geofence_analyzer import analyze_geofence

logger = logging.getLogger(__name__)


def analyze_geofence_event(
    entity_id,
    event_id,
    event_criteria,
    telemetry_data,
    triggered_at,
    analysis_window_min,
    function_params=None,
    event_params=None,
    connection=None
):
    """
    Analyze entity position for geofence breach
    
    Args:
        entity_id: Entity ID (boat/person MMSI or user ID)
        event_id: Event ID (for reference)
        event_criteria: List of criteria (unused for geofence)
        telemetry_data: List of EntityTelemetry records
        triggered_at: Analysis trigger time
        analysis_window_min: Lookback window
        function_params: Optional function params
        event_params: Optional event params
        connection: Database connection
        
    Returns:
        dict with analysis results
    """
    try:
        logger.info(f"Analyzing geofence event for entity: {entity_id}")
        
        if not connection:
            return {
                'status': 'error',
                'message': 'No database connection provided'
            }
        
        # Extract customer ID from subscription
        # We need to find the customer ID for this entity subscription
        try:
            cursor = connection.cursor()
            cursor.execute("""
                SELECT cs.customerId 
                FROM CustomerSubscriptions cs 
                WHERE cs.entityId = ? AND cs.eventId = ? AND cs.active = 'Y'
                LIMIT 1
            """, (entity_id, event_id))
            
            row = cursor.fetchone()
            if not row:
                logger.warning(f"No active subscription found for entity {entity_id}, event {event_id}")
                return {
                    'status': 'success',
                    'cumulative_score': 0,
                    'probability': 0.5,
                    'details': [],
                    'analysisMetadata': {'reason': 'no_subscription', 'entity_id': entity_id}
                }
            
            customer_id = row[0]
            cursor.close()
        except Exception as e:
            logger.error(f"Error retrieving customer ID: {e}")
            return {
                'status': 'error',
                'message': f'Failed to retrieve customer ID: {str(e)}'
            }
        
        # Get latest position data from telemetry with EntityTelemetry record ID
        # SignalK provides latitude and longitude in the same position record
        # Both share the same entityTelemetryId (the position record ID)
        latest_position = None
        position_telemetry_id = None  # Shared by lat and lon from same record
        
        if telemetry_data and len(telemetry_data) > 0:
            # Get most recent position (latitude/longitude)
            # SignalK provides: {'attributeCode': 'latitude', 'numericValue': ..., 'entityTelemetryId': ...}
            # and: {'attributeCode': 'longitude', 'numericValue': ..., 'entityTelemetryId': ...}
            # Both have the SAME entityTelemetryId (position record)
            lat = None
            lon = None
            
            for record in telemetry_data:
                attr_code = record.get('attributeCode', '').lower()
                
                if 'latitude' in attr_code:
                    lat = record.get('numericValue')
                    position_telemetry_id = record.get('entityTelemetryId')  # From position record
                elif 'longitude' in attr_code or 'lon' in attr_code:
                    lon = record.get('numericValue')
                    # Note: entityTelemetryId should be same as latitude record
            
            if lat is not None and lon is not None:
                latest_position = {'lat': lat, 'lon': lon}
        
        if not latest_position:
            logger.info(f"No position data available for entity {entity_id}")
            return {
                'status': 'success',
                'cumulative_score': 0,
                'probability': 0.5,
                'details': [],
                'analysisMetadata': {'reason': 'no_position_data', 'entity_id': entity_id}
            }
        
        logger.info(f"Position for entity {entity_id}: {latest_position}, lat_attr_id={lat_attr_id}, lon_attr_id={lon_attr_id}")
        
        # Analyze position against customer's geofences
        score = analyze_geofence(connection, customer_id, latest_position['lat'], latest_position['lon'])
        
        # Build details array for event log
        # Each geofence breach creates one detail entry with the position record ID
        # (latitude and longitude come from the same EntityTelemetry record)
        details = []
        if score > 0:
            # Load which geofences were breached
            try:
                cursor = connection.cursor()
                cursor.execute("""
                    SELECT cgc.customerGeofenceCriteriaId, cgc.entityTypeAttributeId, cgc.geofenceName, cgc.coordinates, cgc.geoType
                    FROM dbo.CustomerGeofenceCriteria cgc
                    WHERE cgc.customerId = ? AND cgc.active = 'Y'
                    ORDER BY cgc.geofenceName
                """, (customer_id,))
                
                from geofence_analyzer import GeofenceAnalyzer
                analyzer = GeofenceAnalyzer()
                
                for row in cursor.fetchall():
                    geofence_id = row[0]
                    geofence_attr_id = row[1]  # EntityTypeAttributeId from CustomerGeofenceCriteria
                    geofence_name = row[2]
                    coordinates_json = row[3]
                    geo_type = row[4]
                    
                    try:
                        import json
                        geofence_dict = {
                            'geofenceName': geofence_name,
                            'geoType': geo_type,
                            'coordinates': json.loads(coordinates_json) if isinstance(coordinates_json, str) else coordinates_json
                        }
                        is_breached = analyzer.check_geofence(latest_position['lat'], latest_position['lon'], geofence_dict)
                        
                        if is_breached:
                            # Create one detail per geofence breach
                            # EntityTypeAttributeId: from CustomerGeofenceCriteria (links to position attribute)
                            # EntityTelemetryId: The position record ID (shared by lat and lon)
                            if position_telemetry_id is not None:
                                details.append({
                                    'entityTypeAttributeId': geofence_attr_id,  # From CustomerGeofenceCriteria
                                    'entityTelemetryId': position_telemetry_id, # Shared position record ID
                                    'scoreContribution': 1,
                                    'withinRange': 'Y'
                                })
                    except Exception as e:
                        logger.warning(f"Error checking geofence {geofence_name}: {e}")
                
                cursor.close()
            except Exception as e:
                logger.warning(f"Could not load geofence details: {e}")
                # Fallback: create details based on score if we have telemetry ID
                for i in range(score):
                    if position_telemetry_id is not None:
                        details.append({
                            'entityTypeAttributeId': None,
                            'entityTelemetryId': position_telemetry_id,
                            'scoreContribution': 1,
                            'withinRange': 'Y'
                        })
        
        logger.info(f"Geofence analysis complete: entity={entity_id}, customer={customer_id}, score={score}, position={latest_position}")
        
        return {
            'status': 'success',
            'cumulative_score': score,
            'probability': 0.5,  # Geofence is binary: either in or out
            'details': details,
            'analysisMetadata': {
                'position': latest_position,
                'customer_id': customer_id,
                'breached_geofences': score,
                'analysis_type': 'geofence_containment',
                'analysis_notes': f'{score} geofence(s) breached' if score > 0 else 'No geofence breach detected',
                'position_telemetry_id': position_telemetry_id  # Shared by lat and lon from same record
            }
        }
        
    except Exception as e:
        import traceback
        logger.error(f"Error in analyze_geofence_event: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            'status': 'error',
            'message': f'Geofence analysis failed: {str(e)}'
        }
