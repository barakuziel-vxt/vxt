#!/usr/bin/env python3
"""
Sample Analysis Functions for Event Processing
These are examples of Python-based analysis functions that can be executed
by the subscription analysis worker for advanced event processing.
"""

import logging
import json
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def detect_anomaly(entity_id: str, event_id: int, event_criteria: list, telemetry_data: list,
                   triggered_at=None, analysis_window_min: int = 5, 
                   function_params: dict = None, event_params: dict = None, 
                   connection=None, **kwargs):
    """
    Detect anomalies in entity data using statistical methods or ML models.
    
    This is a unified Python analysis function that receives complete event criteria and telemetry data.
    
    Args:
        entity_id: The entity ID to analyze
        event_id: The event ID that triggered this analysis
        event_criteria: List of dicts with event attribute criteria:
                       [{'entityTypeAttributeId': 1, 'attributeCode': 'heartRate', 'score': 10, 'minValue': 60, 'maxValue': 100, ...}, ...]
        telemetry_data: List of dicts with entity telemetry within analysis window:
                       [{'entityTelemetryId': 100, 'entityTypeAttributeId': 1, 'attributeCode': 'heartRate', 'numericValue': 95, ...}, ...]
        triggered_at: Datetime when analysis was triggered
        analysis_window_min: Time range of data scanned (in minutes)
        function_params: Function-specific parameters
        event_params: Event-specific parameters
        connection: Database connection (if needed for additional queries)
        **kwargs: Additional parameters
        
    Returns:
        dict: Analysis results with structure:
        {
            'status': 'success' or 'error',
            'cumulative_score': 45,
            'probability': 0.87,
            'details': [
                {'entityTypeAttributeId': 1, 'entityTelemetryId': 100, 'scoreContribution': 10, 'withinRange': 'Y'},
                {'entityTypeAttributeId': 2, 'entityTelemetryId': 101, 'scoreContribution': 5, 'withinRange': 'N'}
            ],
            'risk_level': 'HIGH',
            'analysis_notes': 'Anomaly detected...'
        }
    """
    try:
        logger.info(f"Detecting anomalies for entity {entity_id}, event {event_id}")
        
        if not event_criteria or not telemetry_data:
            return {
                'status': 'error',
                'entity_id': entity_id,
                'event_id': event_id,
                'error': 'Missing event criteria or telemetry data'
            }
        
        # Calculate score based on criteria and telemetry
        cumulative_score = 0
        probability = 0.0
        details = []
        
        # Process each criterion
        for criterion in event_criteria:
            attr_id = criterion.get('entityTypeAttributeId')
            expected_score = criterion.get('score', 0)
            min_value = criterion.get('minValue', 0)
            max_value = criterion.get('maxValue', 999999)
            
            # Find matching telemetry
            matching_telemetry = [t for t in telemetry_data if t['entityTypeAttributeId'] == attr_id]
            
            if matching_telemetry:
                telemetry = matching_telemetry[0]  # Most recent
                actual_value = telemetry.get('numericValue', 0)
                
                # Check if within range
                within_range = 'Y' if min_value <= actual_value <= max_value else 'N'
                
                # Accumulate score if out of range
                score_contrib = expected_score if within_range == 'N' else 0
                cumulative_score += score_contrib
                
                # Calculate probability (1.0 if at center, 0.5 if out of range)
                if within_range == 'Y':
                    midpoint = (min_value + max_value) / 2.0
                    distance_from_center = abs(actual_value - midpoint) / ((max_value - min_value) / 2.0)
                    attr_probability = max(0.50, 1.0 - distance_from_center)
                else:
                    attr_probability = 0.30  # Low confidence if out of range
                
                probability = (probability + attr_probability) / len(event_criteria)
                
                details.append({
                    'entityTypeAttributeId': attr_id,
                    'entityTelemetryId': telemetry.get('entityTelemetryId'),
                    'scoreContribution': score_contrib,
                    'withinRange': within_range
                })
        
        # Clamp probability to 0.00-1.00
        probability = max(0.00, min(1.00, round(probability, 2)))
        
        # Determine risk level
        if cumulative_score >= 100:
            risk_level = 'CRITICAL'
        elif cumulative_score >= 50:
            risk_level = 'HIGH'
        elif cumulative_score >= 30:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'
        
        result = {
            'status': 'success',
            'entity_id': entity_id,
            'event_id': event_id,
            'cumulative_score': cumulative_score,
            'probability': probability,
            'risk_level': risk_level,
            'details': details,
            'analysis_notes': f"Analyzed {len(event_criteria)} criteria, found {len([d for d in details if d['withinRange'] == 'N'])} out of range"
        }
        
        logger.info(f"Anomaly detection completed: score={cumulative_score}, probability={probability}, risk={risk_level}")
        return result
        
    except Exception as e:
        logger.error(f"Error in detect_anomaly for entity {entity_id}: {e}")
        return {
            'status': 'error',
            'entity_id': entity_id,
            'event_id': event_id,
            'error': str(e)
        }


def analyze_trend(entity_id: str, event_id: int, event_criteria: list, telemetry_data: list,
                  triggered_at=None, analysis_window_min: int = 5,
                  function_params: dict = None, event_params: dict = None, 
                  connection=None, **kwargs):
    """
    Analyze trends in entity data over time.
    
    Args:
        entity_id: The entity ID to analyze
        event_id: The event ID that triggered this analysis
        event_criteria: List of event attribute criteria
        telemetry_data: List of telemetry measurements
        triggered_at: Datetime when analysis was triggered
        analysis_window_min: Time range of data scanned (in minutes)
        function_params: Function-specific parameters
        event_params: Event-specific parameters
        connection: Database connection for additional queries
        **kwargs: Additional parameters
        
    Returns:
        dict: Trend analysis results with cumulative_score, probability, details
    """
    try:
        logger.info(f"Analyzing trends for entity {entity_id}, event {event_id}")
        
        # Example: Query the database for historical data
        trend_data = {
            'status': 'success',
            'entity_id': entity_id,
            'event_id': event_id,
            'period_days': function_params.get('lookback_days', 7),
            'trend_direction': 'increasing',  # or 'decreasing', 'stable'
            'trend_magnitude': cumulative_score * 0.05,  # Example calculation
            'prediction': 'Risk may increase if trend continues'
        }
        
        logger.info(f"Trend analysis completed: {trend_data}")
        return trend_data
        
    except Exception as e:
        logger.error(f"Error in analyze_trend for entity {entity_id}: {e}")
        return {
            'status': 'error',
            'entity_id': entity_id,
            'event_id': event_id,
            'error': str(e)
        }


def execute_custom_model(entity_id: str, event_id: int, event_criteria: list, telemetry_data: list,
                         triggered_at=None, analysis_window_min: int = 5,
                         function_params: dict = None, event_params: dict = None, 
                         connection=None, **kwargs):
    """
    Execute a custom machine learning model or business logic.
    
    Args:
        entity_id: The entity ID to analyze
        event_id: The event ID that triggered this analysis
        event_criteria: List of event attribute criteria
        telemetry_data: List of telemetry measurements
        triggered_at: Datetime when analysis was triggered
        analysis_window_min: Time range of data scanned (in minutes)
        function_params: Function-specific parameters including model path
        event_params: Event-specific parameters
        connection: Database connection for additional queries
        **kwargs: Additional parameters
        
    Returns:
        dict: Model execution results with cumulative_score, probability, details
    """
    try:
        logger.info(f"Executing custom model for entity {entity_id}, event {event_id}")
        
        model_name = function_params.get('model_name', 'default_model')
        model_version = function_params.get('model_version', '1.0')
        
        # Example: Load and execute model
        model_result = {
            'status': 'success',
            'entity_id': entity_id,
            'event_id': event_id,
            'model_name': model_name,
            'model_version': model_version,
            'prediction': 'High probability of critical event',
            'confidence': 0.85,
            'contributing_factors': [
                'Factor 1: High values detected',
                'Factor 2: Trend acceleration', 
                'Factor 3: Deviation from baseline'
            ]
        }
        
        logger.info(f"Custom model execution completed: {model_result}")
        return model_result
        
    except Exception as e:
        logger.error(f"Error in execute_custom_model for entity {entity_id}: {e}")
        return {
            'status': 'error',
            'entity_id': entity_id,
            'event_id': event_id,
            'error': str(e)
        }


def send_alert_notification(entity_id: str, event_id: int, event_criteria: list, telemetry_data: list,
                           triggered_at=None, analysis_window_min: int = 5,
                           function_params: dict = None, event_params: dict = None, 
                           connection=None, **kwargs):
    """
    Send alert notifications based on event risk level.
    
    Args:
        entity_id: The entity ID
        event_id: The event ID
        event_criteria: List of event attribute criteria
        telemetry_data: List of telemetry measurements
        triggered_at: Datetime when analysis was triggered
        analysis_window_min: Time range of data scanned (in minutes)
        function_params: Function parameters including notification channels
        event_params: Event parameters
        connection: Database connection
        **kwargs: Additional parameters
        
    Returns:
        dict: Results with cumulative_score, probability, details
    ""
    try:
        logger.info(f"Sending alert notifications for entity {entity_id}, risk level {risk_level}")
        
        channels = function_params.get('channels', ['email', 'sms'])
        recipients = function_params.get('recipients', [])
        
        notification_result = {
            'status': 'success',
            'entity_id': entity_id,
            'event_id': event_id,
            'channels': channels,
            'recipients_notified': len(recipients),
            'notification_timestamp': datetime.now().isoformat()
        }
        
        # In a real implementation, you would send notifications here
        # For now, we just log the notification
        for channel in channels:
            logger.info(f"Would send {channel} notification for entity {entity_id} to {recipients}")
        
        logger.info(f"Notifications sent: {notification_result}")
        return notification_result
        
    except Exception as e:
        logger.error(f"Error in send_alert_notification for entity {entity_id}: {e}")
        return {
            'status': 'error',
            'entity_id': entity_id,
            'event_id': event_id,
            'error': str(e)
        }
