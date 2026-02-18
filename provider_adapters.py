# provider_adapters.py
"""
Provider-specific adapters for parsing multi-protocol health telemetry events
Supports: Junction (LOINC-based), Terra (Health API)
Uses JSONPath for flexible data extraction based on database configuration
"""

import json
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, List, Optional
from jsonpath_ng import parse as jsonpath_parse
import logging

logger = logging.getLogger(__name__)


class ProviderAdapter(ABC):
    """Abstract base class for provider-specific adapters"""
    
    def __init__(self, provider_config: Dict):
        """
        Args:
            provider_config: {
                'ProviderId': int,
                'ProviderName': str,
                'AdapterClassName': str,
                'TopicName': str,
                'BatchSize': int
            }
        """
        self.config = provider_config
        self.event_rules = {}  # Will be populated by set_extraction_rules()
    
    @abstractmethod
    def validate_message(self, message: Dict) -> bool:
        """Validate incoming message format"""
        pass
    
    @abstractmethod
    def parse_event(self, message: Dict) -> List[Dict]:
        """
        Parse provider event into normalized format
        
        Returns list of normalized event dictionaries with keys:
        {
            'entity_id': str,
            'protocol_attribute_code': str,
            'entity_type_attribute_id': int,
            'timestamp': datetime,
            'numeric_value': float,
            'string_value': str,
            'latitude': float,
            'longitude': float,
            'provider_device': str,
            'provider_event_id': int
        }
        """
        pass
    
    def set_extraction_rules(self, rules: Dict):
        """
        Set event extraction rules from ProviderEvent table
        
        Args:
            rules: {
                'event_type': {
                    'provider_event_id': int,
                    'protocol_attribute_code': str,
                    'value_json_path': str,          # JSONPath to value
                    'sample_array_path': str,        # JSONPath to sample array (optional)
                    'composite_template': str,       # Template for composite values
                    'field_mapping': dict            # Field mapping JSON
                }
            }
        """
        self.event_rules = rules
        logger.info(f"Set {len(rules)} extraction rules for {self.config['ProviderName']}")
    
    def _extract_json_path(self, data: Dict, json_path: str) -> Optional[any]:
        """Extract value from data using JSONPath"""
        try:
            if not json_path:
                return None
            jsonpath_expr = jsonpath_parse(json_path)
            matches = jsonpath_expr.find(data)
            if matches:
                return matches[0].value
            return None
        except Exception as e:
            logger.warning(f"JSONPath extraction failed for '{json_path}': {e}")
            return None
    
    def _extract_array_samples(self, data: Dict, array_path: str, 
                              value_key: str, timestamp_key: str) -> List[Dict]:
        """Extract array of samples using JSONPath and composite template"""
        try:
            if not array_path:
                return []
            
            jsonpath_expr = jsonpath_parse(array_path)
            matches = jsonpath_expr.find(data)
            
            if not matches:
                return []
            
            sample_array = matches[0].value
            if not isinstance(sample_array, list):
                return []
            
            samples = []
            for sample in sample_array:
                if not isinstance(sample, dict):
                    continue
                
                samples.append({
                    'value': sample.get(value_key),
                    'timestamp': sample.get(timestamp_key)
                })
            
            return samples
        except Exception as e:
            logger.warning(f"Array extraction failed for '{array_path}': {e}")
            return []


class JunctionAdapter(ProviderAdapter):
    """
    Adapter for Junction Health Provider
    Parses health vitals with nested sample arrays per measurement type
    
    Example event structure:
    {
      "user": {"user_id": "033114869"},
      "data": {
        "heart_rate_data": {
          "summary": {"avg_hr_bpm": 72},
          "detailed": {"hr_samples": [{"timestamp": "2026-02-18T...", "bpm": 72}]}
        },
        "blood_pressure_data": {
          "summary": {"avg_systolic_mmhg": 120, "avg_diastolic_mmhg": 80},
          "detailed": {"bp_samples": [{"timestamp": "2026-02-18T...", "systolic_mmhg": 120, "diastolic_mmhg": 80}]}
        }
      },
      "type": "vitals",
      "event_type": "vitals.heart_rate.update",
      "loinc_code": "8867-4",
      "timestamp": "2026-02-18T..."
    }
    """
    
    def validate_message(self, message: Dict) -> bool:
        """
        Validate Junction event format
        Required fields: user, user.user_id, timestamp
        
        Note: Accepts any event type - filtering by ProviderEvent rules happens downstream
        """
        required_fields = ['user', 'timestamp']
        
        for field in required_fields:
            if field not in message:
                logger.warning(f"Missing required field '{field}' in Junction event")
                return False
        
        if 'user_id' not in message.get('user', {}):
            logger.warning("Missing user.user_id in Junction event")
            return False
        
        return True
    
    def parse_event(self, message: Dict) -> List[Dict]:
        """
        Parse Junction event and extract normalized telemetry records
        
        Supports both summary and detailed sample extraction
        """
        events = []
        
        try:
            # Extract user_id as entity identifier (e.g., 'user_033114869' -> '033114869')
            user_id_str = message.get('user', {}).get('user_id', 'unknown')
            
            # Strip 'user_' prefix if present
            if isinstance(user_id_str, str) and user_id_str.startswith('user_'):
                entity_id = user_id_str[5:]  # Remove 'user_' prefix, keep as string
            else:
                entity_id = user_id_str  # Already without prefix or not a string
            
            if not entity_id or entity_id == 'unknown':
                logger.warning(f"Could not extract entity_id from user_id '{user_id_str}'")
                return events
            
            event_type = message.get('event_type')
            timestamp = message.get('timestamp')
            device = message.get('provider_device', 'Junction Device')
            
            # Look up extraction rule for this event type
            if event_type not in self.event_rules:
                logger.debug(f"No extraction rule for event type '{event_type}'")
                return events
            
            rule = self.event_rules[event_type]
            protocol_attr_code = rule['protocol_attribute_code']
            value_json_path = rule['value_json_path']
            sample_array_path = rule['sample_array_path']
            composite_template = rule.get('composite_template', {})
            
            # Parse composite template
            value_key = composite_template.get('valueKey') if composite_template else 'value'
            timestamp_key = composite_template.get('timestampKey', 'timestamp') if composite_template else 'timestamp'
            
            # Try to extract summary value first (single record)
            summary_value = self._extract_json_path(message, value_json_path)
            if summary_value is not None:
                events.append({
                    'entity_id': entity_id,  # String identifier (e.g., '033114869')
                    'protocol_attribute_code': protocol_attr_code,
                    'entity_type_attribute_id': rule.get('entity_type_attribute_id'),
                    'timestamp': timestamp,
                    'numeric_value': float(summary_value) if isinstance(summary_value, (int, float)) else None,
                    'string_value': str(summary_value) if isinstance(summary_value, str) else None,
                    'latitude': None,
                    'longitude': None,
                    'provider_device': device,
                    'provider_event_id': rule['provider_event_id']
                })
            
            # Extract detailed samples if available
            if sample_array_path:
                samples = self._extract_array_samples(
                    message, 
                    sample_array_path,
                    value_key,
                    timestamp_key
                )
                
                for sample in samples:
                    if sample['value'] is not None and sample['timestamp']:
                        events.append({
                            'entity_id': entity_id,  # String identifier (e.g., '033114869')
                            'protocol_attribute_code': protocol_attr_code,
                            'entity_type_attribute_id': rule.get('entity_type_attribute_id'),
                            'timestamp': sample['timestamp'],
                            'numeric_value': float(sample['value']) if isinstance(sample['value'], (int, float)) else None,
                            'string_value': str(sample['value']) if isinstance(sample['value'], str) else None,
                            'latitude': None,
                            'longitude': None,
                            'provider_device': device,
                            'provider_event_id': rule['provider_event_id']
                        })
        
        except Exception as e:
            logger.error(f"Error parsing Junction event: {e}")
        
        return events


class TerraAdapter(ProviderAdapter):
    """
    Adapter for Terra Health API
    Parses TerrraHealth vitals with array-based data structure
    
    Example event structure:
    {
      "status": "success",
      "type": "vitals",
      "user_id": "033114869",
      "reference": "ref-1234",
      "timestamp": "2026-02-18T...Z",
      "start_timestamp": "2026-02-18T...Z",
      "metadata": {"start_timestamp": "...", "end_timestamp": "..."},
      "data": [{
        "heart_rate_data": {
          "summary": {
            "avg_hr_bpm": 72,
            "hr_variability_rmssd": 25.5,
            "max_hr_bpm": 85,
            "min_hr_bpm": 60,
            "resting_hr_bpm": 65
          },
          "detailed": {"hr_samples": [{"timestamp": "...", "bpm": 72}]}
        },
        "temperature_data": {"body_temperature_celsius": 37.5},
        "oxygen_data": {"avg_saturation_percentage": 98.5}
      }]
    }
    """
    
    def validate_message(self, message: Dict) -> bool:
        """
        Validate Terra event format
        Required fields: user_id, type, timestamp, data (array)
        """
        required_fields = ['user_id', 'type', 'timestamp', 'data']
        
        for field in required_fields:
            if field not in message:
                logger.warning(f"Missing required field '{field}' in Terra event")
                return False
        
        if not isinstance(message.get('data'), list) or len(message['data']) == 0:
            logger.warning("Terra 'data' field must be non-empty array")
            return False
        
        if message.get('type') != 'vitals':
            logger.warning(f"Invalid event type: {message.get('type')}, expected 'vitals'")
            return False
        
        return True
    
    def parse_event(self, message: Dict) -> List[Dict]:
        """
        Parse Terra event and extract normalized telemetry records
        
        Supports both summary and detailed sample extraction from data[] array
        """
        events = []
        
        try:
            user_id = message.get('user_id', 'unknown')
            timestamp = message.get('timestamp')
            device = message.get('metadata', {}).get('device_name', 'Terra Device')
            
            # Terra events have data as array - process first element
            data_array = message.get('data', [])
            if not data_array:
                return events
            
            data = data_array[0]  # Terra sends data in array, use first element
            
            # Iterate through extraction rules and find matching ones for this event
            for event_type, rule in self.event_rules.items():
                if 'vitals' not in event_type:  # Only process vitals events
                    continue
                
                protocol_attr_code = rule['protocol_attribute_code']
                value_json_path = rule['value_json_path']
                sample_array_path = rule['sample_array_path']
                composite_template = rule.get('composite_template', {})
                
                # Parse composite template
                value_key = composite_template.get('valueKey') if composite_template else None
                
                # Try to extract summary value
                summary_value = self._extract_json_path(data, value_json_path)
                if summary_value is not None:
                    events.append({
                        'entity_id': user_id,
                        'protocol_attribute_code': protocol_attr_code,
                        'entity_type_attribute_id': rule.get('entity_type_attribute_id'),
                        'timestamp': timestamp,
                        'numeric_value': float(summary_value) if isinstance(summary_value, (int, float)) else None,
                        'string_value': str(summary_value) if isinstance(summary_value, str) else None,
                        'latitude': None,
                        'longitude': None,
                        'provider_device': device,
                        'provider_event_id': rule['provider_event_id']
                    })
                
                # Extract detailed samples if available
                if sample_array_path:
                    samples = self._extract_array_samples(
                        data,
                        sample_array_path,
                        value_key or 'value',
                        'timestamp'
                    )
                    
                    for sample in samples:
                        if sample['value'] is not None and sample['timestamp']:
                            events.append({
                                'entity_id': user_id,
                                'protocol_attribute_code': protocol_attr_code,
                                'entity_type_attribute_id': rule.get('entity_type_attribute_id'),
                                'timestamp': sample['timestamp'],
                                'numeric_value': float(sample['value']) if isinstance(sample['value'], (int, float)) else None,
                                'string_value': str(sample['value']) if isinstance(sample['value'], str) else None,
                                'latitude': None,
                                'longitude': None,
                                'provider_device': device,
                                'provider_event_id': rule['provider_event_id']
                            })
        
        except Exception as e:
            logger.error(f"Error parsing Terra event: {e}")
        
        return events


class SignalKAdapter(ProviderAdapter):
    """
    Adapter for SignalK Maritime Protocol
    Parses maritime vessel telemetry (navigation, engine, environment)
    
    SignalK structure (simplified):
    {
      "context": "vessels.urn:mrn:imo:mmsi:234567890",
      "updates": [{
        "timestamp": "2026-02-18T...",
        "values": [
          {"path": "navigation.position.latitude", "value": 60.0},
          {"path": "navigation.speedOverGround", "value": 12.5},
          {"path": "propulsion.engine.coolantTemperature", "value": 82.3}
        ]
      }]
    }
    """
    
    def validate_message(self, message: Dict) -> bool:
        """Validate SignalK message format"""
        required_fields = ['context', 'updates']
        
        for field in required_fields:
            if field not in message:
                logger.warning(f"Missing required field '{field}' in SignalK message")
                return False
        
        if not isinstance(message.get('updates'), list):
            logger.warning("SignalK 'updates' must be array")
            return False
        
        return True
    
    def parse_event(self, message: Dict) -> List[Dict]:
        """Parse SignalK message and extract normalized telemetry records"""
        events = []
        
        try:
            # Extract vessel MMSI from context
            context = message.get('context', '')
            mmsi = context.split(':')[-1] if ':' in context else 'unknown'
            
            # Process each update entry
            for update in message.get('updates', []):
                timestamp = update.get('timestamp')
                
                # Process each value in the update
                for value_entry in update.get('values', []):
                    signal_path = value_entry.get('path')
                    signal_value = value_entry.get('value')
                    
                    # Map SignalK path to protocol attribute code via event rules
                    # (would be configured in database)
                    if signal_path in self.event_rules:
                        rule = self.event_rules[signal_path]
                        events.append({
                            'entity_id': mmsi,
                            'protocol_attribute_code': rule['protocol_attribute_code'],
                            'entity_type_attribute_id': rule.get('entity_type_attribute_id'),
                            'timestamp': timestamp,
                            'numeric_value': float(signal_value) if isinstance(signal_value, (int, float)) else None,
                            'string_value': str(signal_value) if isinstance(signal_value, str) else None,
                            'latitude': None,
                            'longitude': None,
                            'provider_device': 'SignalK Device',
                            'provider_event_id': rule.get('provider_event_id')
                        })
        
        except Exception as e:
            logger.error(f"Error parsing SignalK message: {e}")
        
        return events
