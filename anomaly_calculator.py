#!/usr/bin/env python3
"""
Pure Mathematical Anomaly Calculation Engine
Reusable calculation logic independent of subscription worker integration.
This module contains only mathematical operations for anomaly scoring.
"""

import logging

logger = logging.getLogger(__name__)


def calculate_anomaly_score(event_criteria: list, telemetry_data: list) -> dict:
    """
    Pure mathematical anomaly calculation.
    
    Takes event criteria and telemetry data, performs scoring logic.
    Returns raw calculation results without worker-specific formatting.
    
    Args:
        event_criteria: List of dicts with attribute criteria:
                       [{'entityTypeAttributeId': 1, 'score': 10, 'minValue': 60, 'maxValue': 100}, ...]
        telemetry_data: List of dicts with entity telemetry:
                       [{'entityTypeAttributeId': 1, 'entityTelemetryId': 100, 'numericValue': 95}, ...]
    
    Returns:
        dict: {
            'cumulative_score': int,
            'probability': float (0.0-1.0),
            'risk_level': str ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
            'details': list of dicts with scoring breakdown,
            'analysis_notes': str
        }
    
    Example:
        >>> criteria = [
        ...     {'entityTypeAttributeId': 1, 'score': 10, 'minValue': 60, 'maxValue': 100},
        ...     {'entityTypeAttributeId': 2, 'score': 20, 'minValue': 40, 'maxValue': 80}
        ... ]
        >>> telemetry = [
        ...     {'entityTypeAttributeId': 1, 'entityTelemetryId': 100, 'numericValue': 95},
        ...     {'entityTypeAttributeId': 2, 'entityTelemetryId': 101, 'numericValue': 85}
        ... ]
        >>> result = calculate_anomaly_score(criteria, telemetry)
        >>> result['cumulative_score']
        20
        >>> result['risk_level']
        'MEDIUM'
    """
    try:
        if not event_criteria or not telemetry_data:
            return {
                'cumulative_score': 0,
                'probability': 0.0,
                'risk_level': 'LOW',
                'details': [],
                'analysis_notes': 'No criteria or telemetry data provided'
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
        
        out_of_range_count = len([d for d in details if d['withinRange'] == 'N'])
        
        result = {
            'cumulative_score': cumulative_score,
            'probability': probability,
            'risk_level': risk_level,
            'details': details,
            'analysis_notes': f"Analyzed {len(event_criteria)} criteria, found {out_of_range_count} out of range"
        }
        
        logger.info(f"Anomaly score calculated: score={cumulative_score}, risk={risk_level}, out_of_range={out_of_range_count}")
        return result
        
    except Exception as e:
        logger.error(f"Error in anomaly score calculation: {e}")
        return {
            'cumulative_score': 0,
            'probability': 0.0,
            'risk_level': 'LOW',
            'details': [],
            'analysis_notes': f'Calculation error: {str(e)}'
        }
