#!/usr/bin/env python3
"""
Subscription Analysis Worker
Runs every 5 minutes to:
1. Execute active subscription analysis via TSQL stored procedure
2. Process and execute analysis functions (TSQL and Python-based)
3. Log results to eventLog and eventLogDetails tables
"""

import os
import sys
import time
import logging
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import schedule
import pyodbc
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('worker_analysis.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class SubscriptionAnalysisWorker:
    """
    Worker that processes active subscriptions and executes analysis functions
    """
    
    def __init__(self):
        """Initialize the worker with database connection parameters"""
        self.server = os.getenv('DB_SERVER', 'localhost')
        self.database = os.getenv('DB_NAME', 'VXT')
        self.username = os.getenv('DB_USER', 'sa')
        self.password = os.getenv('DB_PASSWORD', '')
        self.connection = None
        self.processing_window_minutes = 5
        
    def connect_to_database(self):
        """Establish database connection"""
        try:
            # Try with ODBC Driver 17 first, fallback to 'SQL Server' driver
            drivers_to_try = [
                f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={self.server};DATABASE={self.database};UID={self.username};PWD={self.password};',
                f'DRIVER={{SQL Server}};SERVER={self.server};DATABASE={self.database};UID={self.username};PWD={self.password};'
            ]
            
            connection_string = None
            for driver_str in drivers_to_try:
                try:
                    self.connection = pyodbc.connect(driver_str)
                    self.connection.autocommit = True
                    logger.info(f"Connected to database: {self.database} on {self.server}")
                    return True
                except pyodbc.Error:
                    continue
            
            # If both fail, raise error
            raise Exception("No compatible ODBC driver found. Install 'ODBC Driver 17 for SQL Server' or 'SQL Server' driver")
            
        except pyodbc.Error as e:
            logger.error(f"Database connection failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    def disconnect_from_database(self):
        """Close database connection"""
        if self.connection:
            try:
                self.connection.close()
                logger.info("Database connection closed")
            except Exception as e:
                logger.error(f"Error closing database connection: {e}")
    
    def get_python_subscriptions(self):
        """
        Retrieve subscriptions that have Python-based analysis functions
        Uses the new sp_GetSubscriptionDetails API
        """
        try:
            cursor = self.connection.cursor()
            
            # Get all PYTHON-based subscriptions
            query = """
            EXEC dbo.sp_GetSubscriptionDetails @entityId = NULL, @onlyActive = 1
            """
            
            cursor.execute(query)
            rows = cursor.fetchall()
            cursor.close()
            
            results = []
            for row in rows:
                # Include all subscriptions: PYTHON, TSQL, or no function assigned (uses default)
                function_type = row[13]
                if function_type is None or function_type.upper() in ('PYTHON', 'TSQL'):  # FunctionType column
                    # Safely parse JSON fields (row[15] is EventParams)
                    try:
                        event_params = json.loads(row[15]) if row[15] and isinstance(row[15], str) else {}
                    except (json.JSONDecodeError, TypeError):
                        event_params = {}
                    
                    results.append({
                        'subscriptionId': row[0],
                        'customerId': row[1],
                        'customerName': row[2],
                        'entityId': row[3],
                        'entityType': row[4],
                        'eventId': row[5],
                        'eventCode': row[6],
                        'eventDescription': row[7],
                        'minCumulatedScore': row[8],
                        'maxCumulatedScore': row[9],
                        'risk': row[10],
                        'analyzeFunctionId': row[11],
                        'functionName': row[12] or 'detect_anomaly',  # Default function
                        'functionType': row[13] or 'PYTHON',  # Default to PYTHON analysis
                        'analyzePath': row[14],
                        'eventParams': event_params,
                        'subscriptionStartDate': row[16],
                        'subscriptionEndDate': row[17]
                    })
            
            if results:
                logger.info(f"Found {len(results)} PYTHON-based subscriptions to process")
            
            return results
            
        except pyodbc.Error as e:
            logger.error(f"Error retrieving Python subscriptions: {e}")
            return []
    
    def get_event_criteria(self, event_id):
        """
        Get event criteria (attributes to check) using API
        """
        try:
            cursor = self.connection.cursor()
            
            query = "EXEC dbo.sp_GetEventCriteria @eventId = ?"
            cursor.execute(query, (event_id,))
            rows = cursor.fetchall()
            cursor.close()
            
            criteria = []
            for row in rows:
                criteria.append({
                    'entityTypeAttributeId': row[1],  # entityTypeAttributeId
                    'attributeCode': row[2],  # entityTypeAttributeCode
                    'attributeName': row[3],  # entityTypeAttributeName
                    'attributeUnit': row[4],  # entityTypeAttributeUnit
                    'score': row[6],  # Score
                    'minValue': row[7],  # MinValue
                    'maxValue': row[8]  # MaxValue
                })
            
            return criteria
            
        except pyodbc.Error as e:
            logger.error(f"Error retrieving event criteria for event {event_id}: {e}")
            return []
    
    def get_entity_telemetry(self, entity_id, triggered_at, analysis_window_min):
        """
        Get entity telemetry data for analysis using API
        """
        try:
            cursor = self.connection.cursor()
            
            # Pass None for @triggeredAt so procedure uses GETDATE() for current time
            query = "EXEC dbo.sp_GetEntityTelemetryData @entityId = ?, @triggeredAt = ?, @analysisWindowInMin = ?"
            cursor.execute(query, (entity_id, None, analysis_window_min))  # Pass None, not triggered_at
            rows = cursor.fetchall()
            cursor.close()
            
            if len(rows) == 0:
                logger.warning(f"Procedure returned 0 rows for entity {entity_id} (window: {analysis_window_min} min)")
            
            telemetry = []
            for row in rows:
                telemetry.append({
                    'entityTelemetryId': row[0],
                    'entityId': row[1],
                    'entityTypeAttributeId': row[2],
                    'attributeCode': row[3],
                    'numericValue': row[4],
                    'stringValue': row[5],
                    'dateValue': row[6],
                    'startTimestampUTC': row[7],
                    'endTimestampUTC': row[8]
                })
            
            return telemetry
            
        except pyodbc.Error as e:
            logger.error(f"Error retrieving telemetry for entity {entity_id}: {e}")
            return []
    
    def log_analysis_started(self, entity_id, triggered_at):
        """Log that analysis started for an entity"""
        try:
            cursor = self.connection.cursor()
            cursor.execute(
                "EXEC dbo.sp_LogAnalysisStarted @entityId = ?, @analysisStartTime = ?",
                (entity_id, triggered_at)
            )
            cursor.close()
            logger.info(f"Analysis started logged for entity: {entity_id}")
            return True
        except pyodbc.Error as e:
            logger.error(f"Error logging analysis started: {e}")
            return False
    
    def log_event_found(self, entity_id, event_log_id, event_code, score, triggered_at):
        """Log that an event was found"""
        try:
            cursor = self.connection.cursor()
            cursor.execute(
                "EXEC dbo.sp_LogEventFound @entityId = ?, @eventLogId = ?, @eventCode = ?, @score = ?, @analysisStartTime = ?",
                (entity_id, event_log_id, event_code, score, triggered_at)
            )
            cursor.close()
            logger.info(f"Event found logged: {event_code} (eventLogId: {event_log_id})")
            return True
        except pyodbc.Error as e:
            logger.error(f"Error logging event found: {e}")
            return False
    
    def log_analysis_completed(self, entity_id, triggered_at, processing_time_ms, events_found):
        """Log that analysis completed for an entity"""
        try:
            cursor = self.connection.cursor()
            cursor.execute(
                "EXEC dbo.sp_LogAnalysisCompleted @entityId = ?, @analysisStartTime = ?, @analysisEndTime = ?, @processingTimeMs = ?, @eventsFound = ?",
                (entity_id, triggered_at, datetime.now(timezone.utc), processing_time_ms, events_found)
            )
            cursor.close()
            logger.info(f"Analysis completed logged for entity: {entity_id} (events: {events_found})")
            return True
        except pyodbc.Error as e:
            logger.error(f"Error logging analysis completed: {e}")
            return False
    
    def register_event(self, entity_id, event_id, cumulative_score, probability, 
                       triggered_at, analysis_window_min, processing_time_ms, details=None, analysis_metadata=None):
        """
        Register event (only when event/anomaly is detected)
        
        Args:
            analysis_metadata (dict): Optional metadata from Python/AI functions (stored in EventLog.analysisMetadata JSON)
                TSQL functions should NOT provide this (they use entityTypeAttributeScore instead)
        """
        try:
            cursor = self.connection.cursor()
            
            # Build JSON details array if provided
            details_json = None
            if details and len(details) > 0:
                details_json = json.dumps(details)
            
            # Build JSON analysis metadata if provided (for Python/AI functions)
            analysis_metadata_json = None
            if analysis_metadata:
                analysis_metadata_json = json.dumps(analysis_metadata)
            
            # Create inline SQL that inserts and returns SCOPE_IDENTITY()
            # Try new schema with analysisMetadata first, fall back to old schema if not available
            
            try:
                # Try new schema (with analysisMetadata column)
                insert_query = """
                INSERT INTO dbo.EventLog (
                    entityId,
                    eventId,
                    cumulativeScore,
                    probability,
                    triggeredAt,
                    AnalysisWindowInMin,
                    processingTimeMs,
                    analysisMetadata
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                SELECT SCOPE_IDENTITY() AS eventLogId;
                """
                
                cursor.execute(insert_query, (
                    entity_id, event_id, cumulative_score, probability,
                    triggered_at, analysis_window_min, processing_time_ms, analysis_metadata_json
                ))
            except pyodbc.Error as schema_error:
                # If column doesn't exist, fall back to old schema (backward compatibility)
                if 'analysisMetadata' in str(schema_error) or 'Invalid column' in str(schema_error):
                    logger.warning(f"analysisMetadata column not found, using old schema. Migration needed.")
                    insert_query = """
                    INSERT INTO dbo.EventLog (
                        entityId,
                        eventId,
                        cumulativeScore,
                        probability,
                        triggeredAt,
                        AnalysisWindowInMin,
                        processingTimeMs
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                    SELECT SCOPE_IDENTITY() AS eventLogId;
                    """
                    
                    cursor.execute(insert_query, (
                        entity_id, event_id, cumulative_score, probability,
                        triggered_at, analysis_window_min, processing_time_ms
                    ))
                else:
                    raise
            
            # With multiple statements, skip to the SELECT result
            # The INSERT has no result set, so we need to move to the next one
            if cursor.nextset():
                result = cursor.fetchone()
                event_log_id = None
                
                if result and len(result) > 0:
                    event_log_id = result[0]
                    if event_log_id:
                        # Now insert details if provided
                        if details_json:
                            try:
                                cursor2 = self.connection.cursor()
                                # Insert details from analysis function results
                                # For aggregated events (e.g., DriftDetector): entityTelemetryId is NULL
                                # For non-aggregated events: entityTelemetryId may be extracted from JSON if provided
                                # This flexibility allows different analysis functions to populate it when available
                                details_insert = """
                                INSERT INTO dbo.EventLogDetails (
                                    eventLogId,
                                    entityTypeAttributeId,
                                    entityTelemetryId,
                                    scoreContribution,
                                    withinRange
                                )
                                SELECT 
                                    ? as eventLogId,
                                    CAST(JSON_VALUE(value, '$.entityTypeAttributeId') AS INT) AS entityTypeAttributeId,
                                    TRY_CAST(JSON_VALUE(value, '$.entityTelemetryId') AS BIGINT) AS entityTelemetryId,
                                    CAST(JSON_VALUE(value, '$.scoreContribution') AS INT) AS scoreContribution,
                                    CASE WHEN JSON_VALUE(value, '$.withinRange') = 'true' THEN 'Y' ELSE 'N' END AS withinRange
                                FROM OPENJSON(?) AS details;
                                """
                                cursor2.execute(details_insert, (event_log_id, details_json))
                                cursor2.close()
                                logger.info(f"EventLogDetails inserted successfully for event {event_log_id}")
                            except Exception as detail_error:
                                logger.error(f"Could not insert event details: {detail_error}", exc_info=True)
                        
                        logger.debug(f"Event registered successfully with ID: {event_log_id}")
                        cursor.close()
                        return event_log_id
            
            cursor.close()
            logger.warning(f"Could not retrieve eventLogId from INSERT statement")
            return None
            
        except Exception as e:
            logger.error(f"Error registering event: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def execute_python_function(self, event_log):
        """
        Execute a Python-based analysis function for an event
        
        Args:
            event_log (dict): Event log entry with function details
        """
        try:
            function_name = event_log.get('functionName')
            analyze_path = event_log.get('analyzePath')
            entity_id = event_log.get('entityId')
            event_id = event_log.get('eventId')
            
            logger.info(f"Executing Python function '{function_name}' for entity {entity_id}, event {event_id}")
            
            # Dynamically import and execute the function
            # The analyzePath should be in format: module.function_name
            # Example: "anomaly_detector.detect_anomaly"
            
            if '.' in analyze_path:
                module_name, func_name = analyze_path.rsplit('.', 1)
                
                try:
                    # Dynamically import the module
                    module = __import__(module_name, fromlist=[func_name])
                    analysis_func = getattr(module, func_name, None)
                    
                    if analysis_func is None:
                        logger.error(f"Function '{func_name}' not found in module '{module_name}'")
                        return False
                    
                    # Prepare parameters including new fields
                    params = {
                        'entity_id': entity_id,
                        'event_id': event_id,
                        'cumulative_score': event_log.get('cumulativeScore'),
                        'probability': event_log.get('probability', 0.50),
                        'triggered_at': event_log.get('triggeredAt'),
                        'analysis_window_min': event_log.get('analysisWindowInMin'),
                        'risk_level': event_log.get('riskLevel'),
                        'function_params': event_log.get('functionParams', {}),
                        'event_params': event_log.get('eventParams', {}),
                        'connection': self.connection
                    }
                    
                    # Execute the function
                    result = analysis_func(**params)
                    
                    logger.info(f"Python function '{function_name}' executed successfully: {result}")
                    return True
                    
                except ImportError as e:
                    logger.error(f"Failed to import module '{module_name}': {e}")
                    return False
                except Exception as e:
                    logger.error(f"Error executing function '{func_name}': {e}")
                    return False
            else:
                logger.error(f"Invalid function path format: {analyze_path}")
                return False
                
        except Exception as e:
            logger.error(f"Unexpected error executing Python function: {e}")
            return False
    
    def run_analysis_cycle(self):
        """
        Execute a complete analysis cycle:
        Python is the single orchestrator - fetches subscriptions and processes them
        """
        try:
            logger.info("=" * 80)
            logger.info("Starting analysis cycle")
            start_time = datetime.now(timezone.utc)
            
            # Process all Python-based subscriptions
            # (No TSQL orchestration procedure - Python is the sole orchestrator)
            if not self.process_python_subscriptions():
                logger.error("Python subscription processing failed")
                return False
            
            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.info(f"Analysis cycle completed in {elapsed:.2f} seconds")
            logger.info("=" * 80)
            
            return True
            
        except Exception as e:
            logger.error(f"Fatal error in run_analysis_cycle: {e}")
            return False
    
    def process_python_subscriptions(self):
        """
        Process all Python-based subscriptions:
        1. Get subscription details with event criteria
        2. Get telemetry data
        3. Execute Python analysis function
        4. Log results
        """
        try:
            # Get all PYTHON-based subscriptions
            subscriptions = self.get_python_subscriptions()
            
            if not subscriptions:
                logger.info("No Python-based subscriptions to process")
                return True
            
            successful = 0
            failed = 0
            
            for subscription in subscriptions:
                try:
                    if self.process_python_subscription(subscription):
                        successful += 1
                    else:
                        failed += 1
                except Exception as e:
                    logger.error(f"Error processing subscription {subscription['subscriptionId']}: {e}")
                    failed += 1
            
            logger.info(f"Python subscription processing complete: {successful} successful, {failed} failed")
            return True
            
        except Exception as e:
            logger.error(f"Error in process_python_subscriptions: {e}")
            return False
    
    def process_python_subscription(self, subscription):
        """
        Process a single Python-based subscription
        Logs analysis lifecycle and only registers event if anomaly/event is detected
        """
        try:
            entity_id = subscription['entityId']
            event_id = subscription['eventId']
            function_name = subscription['functionName']
            analyze_path = subscription['analyzePath']
            event_code = subscription['eventCode']
            
            logger.info(f"Processing Python subscription: {subscription['customerName']} / {entity_id} / {event_code}")
            
            triggered_at = datetime.now(timezone.utc)
            analysis_start = datetime.now(timezone.utc)
            
            # Get event-specific lookback window (DriftDetector uses 1440 min, others use 15 min)
            try:
                cursor = self.connection.cursor()
                cursor.execute("SELECT LookbackMinutes FROM Event WHERE eventId = ?", (event_id,))
                event_row = cursor.fetchone()
                cursor.close()
                analysis_window_min = event_row[0] if event_row and event_row[0] else 15
            except Exception as e:
                logger.warning(f"Could not get event lookback window, using default 15 min: {e}")
                analysis_window_min = 15
            
            # Step 1: Log analysis started
            self.log_analysis_started(entity_id, triggered_at)
            
            # Get event criteria
            criteria = self.get_event_criteria(event_id)
            if not criteria:
                logger.warning(f"No criteria found for event {event_id}")
                self.log_analysis_completed(entity_id, triggered_at, 
                                          int((datetime.now(timezone.utc) - analysis_start).total_seconds() * 1000), 0)
                return False
            
            # Get telemetry data
            telemetry = self.get_entity_telemetry(entity_id, triggered_at, analysis_window_min)
            if not telemetry:
                logger.warning(f"No telemetry found for entity {entity_id}")
                self.log_analysis_completed(entity_id, triggered_at,
                                          int((datetime.now(timezone.utc) - analysis_start).total_seconds() * 1000), 0)
                return False
            
            # Step 2: Execute Python analysis function
            analysis_result = self.execute_python_analysis(
                subscription, criteria, telemetry, triggered_at, analysis_window_min
            )
            
            if not analysis_result or analysis_result.get('status') != 'success':
                if analysis_result:
                    logger.error(f"Python analysis failed for {function_name}: status={analysis_result.get('status')}, error_details={analysis_result.get('details')}")
                else:
                    logger.error(f"Python analysis returned None for {function_name}")
                self.log_analysis_completed(entity_id, triggered_at,
                                          int((datetime.now(timezone.utc) - analysis_start).total_seconds() * 1000), 0)
                return False
            
            processing_time_ms = int((datetime.now(timezone.utc) - analysis_start).total_seconds() * 1000)
            cumulative_score = analysis_result.get('cumulative_score', 0)
            probability = float(analysis_result.get('probability', 0.50))
            details = analysis_result.get('details', [])
            
            # Extract analysisMetadata from Python function results (not used for TSQL)
            analysis_metadata = analysis_result.get('analysisMetadata', None)
            function_type = subscription.get('functionType', 'PYTHON')  # Default to PYTHON
            
            event_found = False
            event_log_id = None
            
            # Step 3: Check if cumulative score meets event thresholds
            # Event is detected if score is within [minCumulatedScore, maxCumulatedScore]
            min_score = subscription.get('minCumulatedScore', 0)
            max_score = subscription.get('maxCumulatedScore', 999)
            event_detected = min_score <= cumulative_score <= max_score
            
            logger.info(f"Event threshold check: score={cumulative_score}, min={min_score}, max={max_score}, detected={event_detected}")
            
            if event_detected:
                # For PYTHON functions: pass analysisMetadata; for TSQL: it will be None
                event_log_id = self.register_event(
                    entity_id, event_id, cumulative_score, probability,
                    triggered_at, analysis_window_min, processing_time_ms, details,
                    analysis_metadata=analysis_metadata if function_type.upper() == 'PYTHON' else None
                )
                
                if event_log_id:
                    # Step 4: Log event found
                    self.log_event_found(entity_id, event_log_id, event_code, cumulative_score, triggered_at)
                    event_found = True
                    logger.info(f"[EVENT] Event registered: {function_name} (Score: {cumulative_score}, Probability: {probability:.2f})")
                else:
                    logger.error(f"Failed to register event for {event_code}")
            else:
                logger.debug(f"No event detected for {event_code} (score: {cumulative_score})")
            
            # Step 5: Log analysis completed
            self.log_analysis_completed(entity_id, triggered_at, processing_time_ms, 1 if event_found else 0)
            
            return True
            
        except Exception as e:
            import traceback
            logger.error(f"Error in process_python_subscription: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    def execute_python_analysis(self, subscription, criteria, telemetry, triggered_at, analysis_window_min):
        """
        Execute Python or TSQL analysis function with provided data
        """
        try:
            analyze_path = subscription['analyzePath']
            function_name = subscription['functionName']
            entity_id = subscription['entityId']
            event_id = subscription['eventId']
            
            logger.info(f"Executing analysis function: {function_name} ({analyze_path})")
            
            if '.' not in analyze_path:
                logger.error(f"Invalid function path format: {analyze_path}")
                return None
            
            # Check if this is a TSQL function (dbo.*)
            if analyze_path.startswith('dbo.'):
                return self.execute_tsql_analysis(analyze_path, entity_id, event_id, criteria, telemetry)
            
            # Otherwise try to execute as Python function
            module_name, func_name = analyze_path.rsplit('.', 1)
            
            # Dynamically import and execute
            module = __import__(module_name, fromlist=[func_name])
            analysis_func = getattr(module, func_name, None)
            
            if analysis_func is None:
                logger.error(f"Function '{func_name}' not found in module '{module_name}'")
                return None
            
            # Prepare parameters for Python function
            params = {
                'entity_id': entity_id,
                'event_id': event_id,
                'event_criteria': criteria,
                'telemetry_data': telemetry,
                'triggered_at': triggered_at,
                'analysis_window_min': analysis_window_min,
                'function_params': subscription.get('functionParams', {}),
                'event_params': subscription.get('eventParams', {}),
                'connection': self.connection
            }
            
            # Execute function
            result = analysis_func(**params)
            
            if not result or result.get('status') == 'error':
                logger.error(f"Python function returned error: {result}")
                return None
            
            logger.info(f"Python function executed successfully!")
            return result
            
        except ImportError as e:
            logger.error(f"Failed to import module '{module_name}': {e}")
            return None
        except Exception as e:
            logger.error(f"Error executing function '{func_name}' from module '{module_name}': {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def execute_tsql_analysis(self, function_path, entity_id, event_id, criteria, telemetry):
        """
        Execute a TSQL analysis function (e.g., dbo.AnalyzeScore)
        Calls the function and calculates cumulative score from result set
        """
        try:
            if function_path != 'dbo.AnalyzeScore':
                logger.warning(f"Only dbo.AnalyzeScore is currently supported, got: {function_path}")
                return {'status': 'error', 'message': f'Unsupported TSQL function: {function_path}'}
            
            cursor = self.connection.cursor()
            
            # Get event-specific lookback window from Event table (not hardcoded)
            try:
                cursor.execute("SELECT LookbackMinutes FROM Event WHERE eventId = ?", (event_id,))
                event_row = cursor.fetchone()
                analysis_window_min = event_row[0] if event_row and event_row[0] else 15
            except Exception as e:
                logger.warning(f"Could not get event lookback window for TSQL analysis, using default 15 min: {e}")
                analysis_window_min = 15
            
            # Call the dbo.AnalyzeScore function with the event
            # Function signature: dbo.AnalyzeScore(@entityId, @eventId, @triggeredAt, @analysisWindowInMin)
            query = """
            SELECT 
                entityTypeAttributeId,
                entityTypeAttributeCode,
                scoreContribution,
                withinRange,
                entityTelemetryId,
                probability
            FROM dbo.AnalyzeScore(?, ?, ?, ?)
            """
            
            # Get current time (trigger time for the analysis)
            triggered_at = datetime.now(timezone.utc)
            
            cursor.execute(query, (entity_id, event_id, triggered_at, analysis_window_min))
            rows = cursor.fetchall()
            cursor.close()
            
            if not rows:
                logger.debug(f"AnalyzeScore returned no results for entity {entity_id}, event {event_id}")
                return {
                    'status': 'success',
                    'cumulative_score': 0,
                    'probability': 0.0,
                    'details': []
                }
            
            # Calculate cumulative score and collect details
            cumulative_score = 0
            total_probability = 0.0
            details = []
            
            for row in rows:
                attr_id = row[0]
                attr_code = row[1]
                score_contrib = row[2]  # scoreContribution
                within_range = row[3]  # withinRange
                telemetry_id = row[4]  # entityTelemetryId
                probability = row[5]  # probability (SQL returns DECIMAL as decimal.Decimal)
                
                cumulative_score += score_contrib if score_contrib else 0
                total_probability += float(probability) if probability else 0.0
                
                details.append({
                    'entityTypeAttributeId': attr_id,
                    'entityTelemetryId': telemetry_id,
                    'scoreContribution': score_contrib or 0,
                    'withinRange': within_range == 'Y' if within_range else False
                })
            
            # Average probability across attributes
            avg_probability = total_probability / len(rows) if rows else 0.0
            
            logger.info(f"AnalyzeScore result: cumulative_score={cumulative_score}, avg_probability={avg_probability:.2f}, attributes={len(rows)}")
            
            return {
                'status': 'success',
                'cumulative_score': cumulative_score,
                'probability': avg_probability,
                'details': details,
                'event_detected': cumulative_score > 0  # Event detected if any score contributions exist
            }
            
        except Exception as e:
            logger.error(f"Error executing TSQL function dbo.AnalyzeScore: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def start_scheduler(self):
        """
        Start the scheduler to run analysis every 5 minutes
        """
        # Run initial analysis cycle immediately on startup
        logger.info("Running initial analysis cycle on startup...")
        self.run_analysis_cycle()
        
        # Schedule the analysis job to run every 5 minutes
        schedule.every(5).minutes.do(self.run_analysis_cycle)
        
        logger.info("Scheduler started, running analysis every 5 minutes")
        
        # Keep the scheduler running
        while True:
            try:
                schedule.run_pending()
                time.sleep(10)  # Check scheduler every 10 seconds
            except KeyboardInterrupt:
                logger.info("Scheduler interrupted by user")
                break
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                time.sleep(10)
    
    def run(self):
        """
        Main entry point for the worker
        """
        try:
            # Connect to database
            if not self.connect_to_database():
                logger.error("Failed to connect to database. Exiting.")
                sys.exit(1)
            
            logger.info("Subscription Analysis Worker started")
            logger.info(f"Processing window: {self.processing_window_minutes} minutes")
            
            # Start the scheduler
            try:
                self.start_scheduler()
            finally:
                self.disconnect_from_database()
                logger.info("Subscription Analysis Worker stopped")
                
        except Exception as e:
            logger.error(f"Worker initialization failed: {e}")
            sys.exit(1)


def main():
    """Entry point"""
    worker = SubscriptionAnalysisWorker()
    worker.run()


if __name__ == '__main__':
    main()
