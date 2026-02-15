"""
MultivariateCorrelationShift - AI Analysis Function for Detecting Relationship Changes
Detects significant shifts in correlation between multiple health metrics
(e.g., Heart Rate and SpO2 should be inversely correlated)
"""

import numpy as np
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def detect_correlation_shift(
    entity_id: str,
    attribute_codes: List[str],
    current_telemetry: List[Dict],
    baseline_telemetry: List[Dict],
    params: Dict
) -> Dict:
    """
    Detects correlation shifts between two attributes by comparing recent correlation
    against historical baseline correlation.
    
    Args:
        entity_id: The entity being analyzed
        attribute_codes: List of two attribute codes to correlate (e.g., ["8867-4", "59408-5"])
        current_telemetry: List of recent telemetry records with {attr1, attr2, timestamp}
        baseline_telemetry: List of historical telemetry records with {attr1, attr2, timestamp}
        params: Configuration dict with keys:
            - sensitivity_threshold: Correlation shift threshold (default 0.25, range 0.1-0.5)
            - min_data_points: Minimum data points for each window (default 10)
            - expected_correlation: Expected baseline correlation direction ('positive', 'negative', 'any')
    
    Returns:
        {
            "is_alert": bool,
            "score": float (0-100 scale),
            "baseline_correlation": float (-1.0 to 1.0),
            "current_correlation": float (-1.0 to 1.0),
            "correlation_shift": float (absolute change),
            "direction_change": str ("strengthened", "weakened", "reversed", "none"),
            "confidence": float (0.0-1.0),
            "current_samples": int,
            "baseline_samples": int,
            "details": dict with analysis info
        }
    """
    
    # Extract parameters with defaults
    sensitivity_threshold = float(params.get('sensitivity_threshold', 0.25))
    min_data_points = int(params.get('min_data_points', 10))
    expected_direction = params.get('expected_correlation', 'any').lower()
    
    # Validate parameters
    sensitivity_threshold = max(0.1, min(0.5, sensitivity_threshold))
    
    if len(attribute_codes) != 2:
        logger.error(f"Multivariate correlation requires exactly 2 attributes, got {len(attribute_codes)}")
        return {
            "is_alert": False,
            "score": 0,
            "baseline_correlation": None,
            "current_correlation": None,
            "correlation_shift": 0,
            "direction_change": "none",
            "confidence": 0.0,
            "current_samples": 0,
            "baseline_samples": 0,
            "details": {"error": "Invalid attribute count"}
        }
    
    attr1_code, attr2_code = attribute_codes[0], attribute_codes[1]
    
    try:
        # Extract values for attribute 1 from current telemetry
        current_attr1_values = []
        current_attr2_values = []
        
        for record in current_telemetry:
            if isinstance(record, dict):
                val1 = record.get(attr1_code) or record.get('value1') or record.get('numericValue1')
                val2 = record.get(attr2_code) or record.get('value2') or record.get('numericValue2')
                
                if val1 is not None and val2 is not None:
                    try:
                        current_attr1_values.append(float(val1))
                        current_attr2_values.append(float(val2))
                    except (ValueError, TypeError):
                        continue
        
        # Extract values from baseline telemetry
        baseline_attr1_values = []
        baseline_attr2_values = []
        
        for record in baseline_telemetry:
            if isinstance(record, dict):
                val1 = record.get(attr1_code) or record.get('value1') or record.get('numericValue1')
                val2 = record.get(attr2_code) or record.get('value2') or record.get('numericValue2')
                
                if val1 is not None and val2 is not None:
                    try:
                        baseline_attr1_values.append(float(val1))
                        baseline_attr2_values.append(float(val2))
                    except (ValueError, TypeError):
                        continue
        
        # Check if we have enough data
        if (len(current_attr1_values) < min_data_points or 
            len(baseline_attr1_values) < min_data_points):
            logger.warning(
                f"Insufficient data for correlation detection: entity={entity_id}, "
                f"current={len(current_attr1_values)}, baseline={len(baseline_attr1_values)}"
            )
            return {
                "is_alert": False,
                "score": 0,
                "baseline_correlation": None,
                "current_correlation": None,
                "correlation_shift": 0,
                "direction_change": "none",
                "confidence": 0.0,
                "current_samples": len(current_attr1_values),
                "baseline_samples": len(baseline_attr1_values),
                "details": {"reason": "Insufficient data points"}
            }
        
        # Calculate Pearson correlation coefficients
        baseline_corr = float(np.corrcoef(baseline_attr1_values, baseline_attr2_values)[0, 1])
        current_corr = float(np.corrcoef(current_attr1_values, current_attr2_values)[0, 1])
        
        # Handle NaN correlations (constant values)
        if np.isnan(baseline_corr) or np.isnan(current_corr):
            logger.warning(f"NaN correlation detected for entity {entity_id}")
            return {
                "is_alert": False,
                "score": 0,
                "baseline_correlation": baseline_corr if not np.isnan(baseline_corr) else None,
                "current_correlation": current_corr if not np.isnan(current_corr) else None,
                "correlation_shift": 0,
                "direction_change": "none",
                "confidence": 0.0,
                "current_samples": len(current_attr1_values),
                "baseline_samples": len(baseline_attr1_values),
                "details": {"reason": "Constant values detected"}
            }
        
        # Calculate correlation shift (absolute change)
        correlation_shift = abs(baseline_corr - current_corr)
        
        # Detect direction change
        direction_change = "none"
        if correlation_shift > sensitivity_threshold:
            if (baseline_corr > 0 and current_corr < 0) or (baseline_corr < 0 and current_corr > 0):
                direction_change = "reversed"
            elif abs(current_corr) > abs(baseline_corr):
                direction_change = "strengthened"
            else:
                direction_change = "weakened"
        
        # Calculate anomaly score (0-100)
        # Use sensitivity threshold as the baseline (100 points at threshold)
        score = min(100, (correlation_shift / max(sensitivity_threshold, 0.01)) * 100)
        
        # Determine if this is an alert
        is_alert = correlation_shift > sensitivity_threshold
        
        # Confidence is based on sample size (more samples = higher confidence)
        confidence = min(1.0, (len(current_attr1_values) + len(baseline_attr1_values)) / 100.0)
        
        result = {
            "is_alert": is_alert,
            "score": float(score),
            "baseline_correlation": float(baseline_corr),
            "current_correlation": float(current_corr),
            "correlation_shift": float(correlation_shift),
            "direction_change": direction_change,
            "confidence": float(confidence),
            "current_samples": len(current_attr1_values),
            "baseline_samples": len(baseline_attr1_values),
            "details": {
                "entity_id": entity_id,
                "attribute1_code": attr1_code,
                "attribute2_code": attr2_code,
                "analysis_method": "Pearson correlation coefficient",
                "sensitivity_threshold": float(sensitivity_threshold),
                "expected_direction": expected_direction,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
        
        logger.info(
            f"Correlation shift detection: entity={entity_id}, "
            f"baseline_r={baseline_corr:.3f}, current_r={current_corr:.3f}, "
            f"shift={correlation_shift:.3f}, alert={is_alert}, score={score:.1f}"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error in correlation shift detection: {str(e)}", exc_info=True)
        return {
            "is_alert": False,
            "score": 0,
            "baseline_correlation": None,
            "current_correlation": None,
            "correlation_shift": 0,
            "direction_change": "none",
            "confidence": 0.0,
            "current_samples": 0,
            "baseline_samples": 0,
            "details": {"error": str(e)}
        }
