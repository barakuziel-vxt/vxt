import sys

new_content = '''"""
DriftDetector - AI Analysis Function for Detecting Emerging Problems
Detects significant drift in metrics by comparing recent averages against historical baselines
using statistical Z-score analysis.
"""

import numpy as np
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def detect_metric_drift(
    entity_id: str,
    attribute_code: str,
    current_telemetry: List[Dict],
    baseline_telemetry: List[Dict],
    params: Dict
) -> Dict:
    """
    Detects metric drift by comparing recent average against historical baseline.
    
    Args:
        entity_id: The entity being analyzed
        attribute_code: The attribute code (e.g., "9279-1")
        current_telemetry: List of recent telemetry records with {value, timestamp}
        baseline_telemetry: List of historical telemetry records with {value, timestamp}
        params: Configuration dict with keys:
            - sensitivity_threshold: Z-score threshold (default 2.0, range 1.0-4.0)
            - direction: 'both', 'high', 'low' (default 'both')
            - min_data_points: Minimum data points required (default 5 for current, 20 for baseline)
    
    Returns:
        {
            "is_alert": bool,
            "score": float (0-100 scale),
            "z_score": float,
            "drift_percentage": float,
            "current_avg": float,
            "baseline_avg": float,
            "baseline_std": float,
            "direction": str ("up", "down", or "none"),
            "confidence": float (0.0-1.0),
            "details": dict with analysis info
        }
    """
    
    # Extract parameters with defaults
    sensitivity_threshold = float(params.get('sensitivity_threshold', 2.0))
    direction = params.get('direction', 'both').lower()  # 'both', 'high', 'low'
    min_current = int(params.get('min_current_points', 5))
    min_baseline = int(params.get('min_baseline_points', 20))
    
    # Validate sensitivity threshold
    sensitivity_threshold = max(1.0, min(4.0, sensitivity_threshold))
    
    # Extract values from telemetry records
    current_values = []
    baseline_values = []
    
    try:
        # Extract numeric values from current telemetry
        for record in current_telemetry:
            if isinstance(record, dict):
                # Try multiple possible key names
                value = record.get('numericValue') or record.get('value') or record.get(attribute_code)
                if value is not None:
                    try:
                        current_values.append(float(value))
                    except (ValueError, TypeError):
                        continue
            elif isinstance(record, (int, float)):
                current_values.append(float(record))
        
        # Extract numeric values from baseline telemetry
        for record in baseline_telemetry:
            if isinstance(record, dict):
                value = record.get('numericValue') or record.get('value') or record.get(attribute_code)
                if value is not None:
                    try:
                        baseline_values.append(float(value))
                    except (ValueError, TypeError):
                        continue
            elif isinstance(record, (int, float)):
                baseline_values.append(float(record))
        
        # Check if we have enough data
        if len(current_values) < min_current or len(baseline_values) < min_baseline:
            logger.warning(
                f"Insufficient data for drift detection: entity={entity_id}, "
                f"attribute={attribute_code}, current={len(current_values)}, baseline={len(baseline_values)}"
            )
            return {
                "is_alert": False,
                "score": 0,
                "z_score": 0,
                "drift_percentage": 0,
                "current_avg": None,
                "baseline_avg": None,
                "baseline_std": None,
                "direction": "none",
                "confidence": 0.0,
                "details": {
                    "reason": "insufficient_data",
                    "current_points": len(current_values),
                    "baseline_points": len(baseline_values),
                    "required_current": min_current,
                    "required_baseline": min_baseline
                }
            }
        
        # Calculate statistics
        current_avg = np.mean(current_values)
        baseline_avg = np.mean(baseline_values)
        baseline_std = np.std(baseline_values)
        baseline_median = np.median(baseline_values)
        
        # Avoid division by zero with small epsilon
        denominator = baseline_std if baseline_std > 0 else 1e-6
        
        # Calculate Z-score
        z_score = (current_avg - baseline_avg) / denominator
        
        # Calculate drift percentage
        drift_percentage = ((current_avg - baseline_avg) / (abs(baseline_avg) + 1e-6)) * 100
        
        # Determine drift direction
        if current_avg > baseline_avg:
            drift_direction = "up"
        elif current_avg < baseline_avg:
            drift_direction = "down"
        else:
            drift_direction = "none"
        
        # Check direction filter
        direction_match = True
        if direction == 'high' and drift_direction != 'up':
            direction_match = False
        elif direction == 'low' and drift_direction != 'down':
            direction_match = False
        
        # Check if alert threshold is met
        abs_z_score = abs(z_score)
        is_alert = (abs_z_score > sensitivity_threshold) and direction_match
        
        # Calculate confidence score (normalized to 0-100)
        # Higher Z-score = higher confidence, but capped at 100
        confidence = min(1.0, abs_z_score / sensitivity_threshold) if sensitivity_threshold > 0 else 0.0
        
        # Convert Z-score to 0-100 scale
        # Z-score of 2.0 (threshold) = 50, Z-score of 4.0 = 100, etc.
        normalized_score = min(100, (abs_z_score / sensitivity_threshold) * 50)
        
        return {
            "is_alert": is_alert,
            "score": round(normalized_score, 2),
            "z_score": round(z_score, 3),
            "drift_percentage": round(drift_percentage, 2),
            "current_avg": round(current_avg, 4),
            "baseline_avg": round(baseline_avg, 4),
            "baseline_std": round(baseline_std, 4),
            "direction": drift_direction,
            "confidence": round(confidence, 3),
            "details": {
                "entity_id": entity_id,
                "attribute_code": attribute_code,
                "current_points": len(current_values),
                "baseline_points": len(baseline_values),
                "baseline_median": round(baseline_median, 4),
                "current_min": round(min(current_values), 4),
                "current_max": round(max(current_values), 4),
                "baseline_min": round(min(baseline_values), 4),
                "baseline_max": round(max(baseline_values), 4),
                "sensitivity_threshold": sensitivity_threshold,
                "direction_filter": direction,
                "direction_match": direction_match,
                "timestamp": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Error in drift detection: {str(e)}", exc_info=True)
        return {
            "is_alert": False,
            "score": 0,
            "z_score": 0,
            "drift_percentage": 0,
            "current_avg": None,
            "baseline_avg": None,
            "baseline_std": None,
            "direction": "none",
            "confidence": 0.0,
            "details": {
                "reason": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
        }


def get_drift_detector_params(subscription_config: Dict) -> Dict:
    """
    Extract DriftDetector parameters from subscription/event configuration.
    
    Args:
        subscription_config: Configuration dict from subscription or event setup
    
    Returns:
        Cleaned parameters dict with validated values
    """
    return {
        "sensitivity_threshold": float(subscription_config.get("sensitivity_threshold", 2.0)),
        "direction": subscription_config.get("direction", "both"),
        "min_current_points": int(subscription_config.get("min_current_points", 5)),
        "min_baseline_points": int(subscription_config.get("min_baseline_points", 20)),
        "lookback_hours": int(subscription_config.get("lookback_hours", 6)),
        "baseline_days": int(subscription_config.get("baseline_days", 7))
    }


def detect_entity_drift(**kwargs) -> Dict:
    """
    Wrapper function for drift detection that matches subscription_analysis_worker calling convention.
    
    Returns details in EventLogDetails format for database insertion:
    - entityTypeAttributeId: The attribute being monitored
    - scoreContribution: The drift score (0-100)
    - withinRange: 'true' if drift detected, 'false' if normal
    """
    import pyodbc
    
    try:
        entity_id = kwargs.get('entity_id')
        event_id = kwargs.get('event_id')
        event_criteria = kwargs.get('event_criteria')
        connection = kwargs.get('connection')
        event_params = kwargs.get('event_params', {})
        
        logger.info(f"DriftDetector wrapper called for entity {entity_id}, event {event_id}")
        
        # Validate prerequisites
        if not entity_id or not connection:
            logger.error("Missing required parameters: entity_id or connection")
            return {
                'status': 'error',
                'cumulative_score': 0,
                'probability': 0.5,
                'details': [{'error': 'Missing required parameters'}]
            }
        
        # Get event configuration from database
        cursor = connection.cursor()
        event_query = """
        SELECT 
            LookbackMinutes,
            BaselineDays,
            SensitivityThreshold,
            MinSamplesRequired,
            AnomalyDirection
        FROM Event
        WHERE eventId = ?
        """
        
        cursor.execute(event_query, (event_id,))
        event_row = cursor.fetchone()
        cursor.close()
        
        if not event_row:
            logger.warning(f"Event {event_id} not found in database")
            return {
                'status': 'error',
                'cumulative_score': 0,
                'probability': 0.5,
                'details': [{'error': f'Event {event_id} not found'}]
            }
        
        lookback_minutes = event_row[0] or 1440
        baseline_days = event_row[1] or 7
        sensitivity_threshold = float(event_row[2] or 1.8)
        min_samples = int(event_row[3] or 5)
        anomaly_direction = (event_row[4] or 'BOTH').upper()
        
        if anomaly_direction == 'HIGH':
            direction = 'high'
        elif anomaly_direction == 'LOW':
            direction = 'low'
        else:
            direction = 'both'
        
        logger.info(f"Using drift parameters: lookback={lookback_minutes} min, baseline={baseline_days} days, "
                   f"threshold={sensitivity_threshold}, min_samples={min_samples}, direction={direction}")
        
        # Get attribute to analyze
        if not event_criteria or len(event_criteria) == 0:
            logger.warning(f"No event criteria available for event {event_id}")
            return {
                'status': 'error',
                'cumulative_score': 0,
                'probability': 0.5,
                'details': [{'error': 'No event criteria found'}]
            }
        
        attribute_id = event_criteria[0]['entityTypeAttributeId']
        attribute_code = event_criteria[0]['attributeCode']
        
        logger.debug(f"Analyzing attribute {attribute_code} (ID: {attribute_id})")
        
        # Fetch current telemetry
        cursor = connection.cursor()
        current_time = datetime.now(timezone.utc)
        time_cutoff_current = current_time - timedelta(minutes=lookback_minutes)
        
        telemetry_query = """
        SELECT numericValue, endTimestampUTC
        FROM EntityTelemetry
        WHERE entityId = ?
          AND entityTypeAttributeId = ?
          AND endTimestampUTC >= ?
          AND endTimestampUTC <= ?
        ORDER BY endTimestampUTC DESC
        """
        
        cursor.execute(telemetry_query, (entity_id, attribute_id, time_cutoff_current, current_time))
        current_telemetry_rows = cursor.fetchall()
        
        if not current_telemetry_rows:
            logger.warning(f"No current telemetry found for entity {entity_id}, "
                          f"attribute {attribute_code} in last {lookback_minutes} minutes")
            cursor.close()
            return {
                'status': 'error',
                'cumulative_score': 0,
                'probability': 0.5,
                'details': [{
                    'error': f'No telemetry data in last {lookback_minutes} minutes',
                    'entity_id': entity_id,
                    'attribute_code': attribute_code
                }]
            }
        
        current_telemetry = [{'numericValue': row[0], 'timestamp': row[1]} for row in current_telemetry_rows]
        logger.info(f"Fetched {len(current_telemetry)} current telemetry records")
        
        # Fetch baseline telemetry
        time_cutoff_baseline_end = time_cutoff_current
        time_cutoff_baseline_start = time_cutoff_baseline_end - timedelta(days=baseline_days)
        
        cursor.execute(telemetry_query, (entity_id, attribute_id, time_cutoff_baseline_start, time_cutoff_baseline_end))
        baseline_telemetry_rows = cursor.fetchall()
        cursor.close()
        
        if not baseline_telemetry_rows:
            logger.warning(f"No baseline telemetry found for entity {entity_id}, "
                          f"attribute {attribute_code} in last {baseline_days} days")
            return {
                'status': 'error',
                'cumulative_score': 0,
                'probability': 0.5,
                'details': [{
                    'error': f'No baseline telemetry data in last {baseline_days} days',
                    'entity_id': entity_id,
                    'attribute_code': attribute_code
                }]
            }
        
        baseline_telemetry = [{'numericValue': row[0], 'timestamp': row[1]} for row in baseline_telemetry_rows]
        logger.info(f"Fetched {len(baseline_telemetry)} baseline telemetry records")
        
        # Prepare drift parameters
        drift_params = {
            'sensitivity_threshold': sensitivity_threshold,
            'direction': direction,
            'min_current_points': min_samples,
            'min_baseline_points': max(5, min_samples),
            'lookback_hours': lookback_minutes / 60.0,
            'baseline_days': baseline_days
        }
        
        # Call drift detection
        drift_result = detect_metric_drift(
            entity_id=entity_id,
            attribute_code=attribute_code,
            current_telemetry=current_telemetry,
            baseline_telemetry=baseline_telemetry,
            params=drift_params
        )
        
        if not drift_result:
            logger.error("Drift detection returned no result")
            return {
                'status': 'error',
                'cumulative_score': 0,
                'probability': 0.5,
                'details': [{'error': 'Drift detection returned no result'}]
            }
        
        logger.info(f"Drift detection result: is_alert={drift_result['is_alert']}, "
                   f"score={drift_result['score']}, z_score={drift_result['z_score']:.3f}")
        
        # Prepare details for EventLogDetails (JSON format for OPENJSON in SQL)
        detail_record = {
            'entityTypeAttributeId': attribute_id,
            'scoreContribution': int(drift_result['score']),
            'withinRange': 'true' if drift_result['is_alert'] else 'false',
            'z_score': drift_result['z_score'],
            'drift_percentage': drift_result['drift_percentage'],
            'current_avg': drift_result['current_avg'],
            'baseline_avg': drift_result['baseline_avg'],
            'confidence': drift_result['confidence']
        }
        
        return {
            'status': 'success',
            'cumulative_score': drift_result['score'],
            'probability': drift_result['confidence'],
            'details': [detail_record]
        }
        
    except Exception as e:
        logger.error(f"Error in detect_entity_drift: {str(e)}", exc_info=True)
        return {
            'status': 'error',
            'cumulative_score': 0,
            'probability': 0.5,
            'details': [{'error': str(e)}]
        }
'''

with open('drift_detector.py', 'w') as f:
    f.write(new_content)

print("✓ drift_detector.py rewritten successfully")
