#!/usr/bin/env python3
"""
Geofence Analyzer Module
Analyzes entity positions against customer-defined geofences
Supports polygon and circle geofence types with point-in-polygon testing
"""

import json
import logging
from typing import Tuple, List, Dict, Optional
from shapely.geometry import Point, Polygon, shape
from shapely.errors import ShapelyError

logger = logging.getLogger(__name__)


class GeofenceAnalyzer:
    """Analyzes if a position is within a customer's geofence areas"""
    
    def __init__(self):
        self.cache = {}  # Cache loaded geofences by customerId
    
    def is_point_in_polygon(self, lat: float, lon: float, coordinates: List) -> bool:
        """
        Check if point is inside a polygon using shapely
        
        Args:
            lat: Latitude of point
            lon: Longitude of point
            coordinates: List of [lon, lat] pairs defining polygon
            
        Returns:
            True if point inside polygon, False otherwise
        """
        try:
            point = Point(lon, lat)
            # Coordinates are in [lon, lat] format
            polygon = Polygon(coordinates)
            return polygon.contains(point)
        except (ShapelyError, ValueError) as e:
            logger.error(f"Polygon containment check failed: {e}")
            return False
    
    def is_point_in_circle(self, lat: float, lon: float, center_lat: float, center_lon: float, radius_meters: float) -> bool:
        """
        Check if point is within a circle (using haversine distance)
        
        Args:
            lat: Latitude of point
            lon: Longitude of point
            center_lat: Latitude of circle center
            center_lon: Longitude of circle center
            radius_meters: Circle radius in meters
            
        Returns:
            True if point inside circle, False otherwise
        """
        try:
            from math import radians, cos, sin, asin, sqrt
            
            # Convert decimal degrees to radians
            lon1, lat1, lon2, lat2 = map(radians, [lon, lat, center_lon, center_lat])
            
            # Haversine formula
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * asin(sqrt(a))
            r = 6371000  # Radius of earth in meters
            distance = c * r
            
            return distance <= radius_meters
        except (ValueError, TypeError) as e:
            logger.error(f"Circle containment check failed: {e}")
            return False
    
    def check_geofence(self, lat: float, lon: float, geofence: Dict) -> bool:
        """
        Check if position is within a single geofence
        
        Args:
            lat: Entity latitude
            lon: Entity longitude
            geofence: Geofence definition dict with geoType and coordinates
            
        Returns:
            True if position inside geofence, False otherwise
        """
        try:
            geo_type = geofence.get('geoType', '').lower()
            coords_json = geofence.get('coordinates', '{}')
            
            if isinstance(coords_json, str):
                coords = json.loads(coords_json)
            else:
                coords = coords_json
            
            if geo_type == 'polygon':
                # Extract polygon coordinates: [[lon,lat], [lon,lat], ...]
                polygon_coords = coords.get('coordinates', [])[0]  # First ring
                return self.is_point_in_polygon(lat, lon, polygon_coords)
            
            elif geo_type == 'circle':
                # Extract circle center and radius
                center = coords.get('coordinates', [])
                radius = coords.get('radius', 0)
                if len(center) >= 2 and radius > 0:
                    return self.is_point_in_circle(lat, lon, center[1], center[0], radius)
            
            return False
        
        except (json.JSONDecodeError, KeyError, IndexError, TypeError) as e:
            logger.error(f"Geofence check error for {geofence.get('geofenceName', 'unknown')}: {e}")
            return False
    
    def analyze_position(self, lat: float, lon: float, geofences: List[Dict]) -> int:
        """
        Analyze position against all geofences
        Returns score based on how many geofences the position is inside
        
        Args:
            lat: Entity latitude
            lon: Entity longitude
            geofences: List of active geofence definitions
            
        Returns:
            Score: 0 if outside all geofences, 1+ if inside one or more
        """
        if not geofences:
            return 0
        
        score = 0
        inside_geofences = []
        
        for geofence in geofences:
            if self.check_geofence(lat, lon, geofence):
                score += 1
                inside_geofences.append(geofence.get('geofenceName', 'unknown'))
        
        if inside_geofences:
            logger.info(f"Position ({lat}, {lon}) inside geofences: {inside_geofences} - Score: {score}")
        
        return score


# Singleton instance
_analyzer = None


def get_geofence_analyzer() -> GeofenceAnalyzer:
    """Get singleton GeofenceAnalyzer instance"""
    global _analyzer
    if _analyzer is None:
        _analyzer = GeofenceAnalyzer()
    return _analyzer


def analyze_geofence(db_connection, customer_id: int, lat: float, lon: float) -> int:
    """
    Public API: Analyze entity position against all active customer geofences
    
    Args:
        db_connection: Database connection
        customer_id: Customer ID
        lat: Entity latitude
        lon: Entity longitude
        
    Returns:
        Score: 0 if outside all geofences, 1+ if inside
    """
    try:
        cursor = db_connection.cursor()
        
        # Load active geofences for customer
        cursor.execute("""
            SELECT customerGeofenceCriteriaId, geofenceName, geoType, coordinates
            FROM dbo.CustomerGeofenceCriteria
            WHERE customerId = ? AND active = 'Y'
            ORDER BY geofenceName
        """, (customer_id,))
        
        geofences = []
        for row in cursor.fetchall():
            geofences.append({
                'id': row[0],
                'geofenceName': row[1],
                'geoType': row[2],
                'coordinates': row[3]
            })
        
        cursor.close()
        
        if not geofences:
            return 0
        
        analyzer = get_geofence_analyzer()
        score = analyzer.analyze_position(lat, lon, geofences)
        
        return score
    
    except Exception as e:
        logger.error(f"Error analyzing geofence for customer {customer_id}: {e}")
        return 0
