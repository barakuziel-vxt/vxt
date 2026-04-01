"""Diagnostic check - look for hidden issues in the failing query strings"""
import re

# The exact query from get_latest_telemetry
query_latest = """
        WITH LatestPerAttribute AS (
          SELECT
            eta.entityTypeAttributeId,
            eta.entityTypeAttributeCode,
            eta.entityTypeAttributeName,
            eta.entityTypeAttributeUnit,
            eta.defaultInGraph,
            et.numericValue,
            et.stringValue,
            et.endTimestampUTC,
            pa.protocolAttributeCode,
            pa.description,
            ROW_NUMBER() OVER (PARTITION BY eta.entityTypeAttributeId ORDER BY et.endTimestampUTC DESC) AS rn
          FROM dbo.EntityTelemetry et
          JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
          LEFT JOIN dbo.ProtocolAttribute pa ON eta.protocolId = pa.protocolId 
            AND eta.entityTypeAttributeCode = pa.protocolAttributeCode
          WHERE et.entityId = ?
            AND (et.numericValue IS NOT NULL OR et.stringValue IS NOT NULL)
        )
        SELECT 
          entityTypeAttributeId,
          entityTypeAttributeCode,
          entityTypeAttributeName,
          entityTypeAttributeUnit,
          defaultInGraph,
          numericValue,
          stringValue,
          endTimestampUTC,
          protocolAttributeCode,
          description
        FROM LatestPerAttribute 
        WHERE rn = 1
        ORDER BY entityTypeAttributeCode
        """

# The exact query from get_telemetry_range
query_range = """
        SELECT
            et.entityTypeAttributeId,
            eta.entityTypeAttributeCode,
            et.numericValue,
            et.endTimestampUTC,
            et.latitude,
            et.longitude
        FROM dbo.EntityTelemetry et
        JOIN dbo.EntityTypeAttribute eta ON et.entityTypeAttributeId = eta.entityTypeAttributeId
        WHERE et.entityId = ?
          AND et.endTimestampUTC >= CONVERT(DATETIME2, ?)
          AND et.endTimestampUTC <= CONVERT(DATETIME2, ?)
        ORDER BY et.endTimestampUTC ASC
        """

# Check for % signs
for name, q in [("latest", query_latest), ("range", query_range)]:
    # Find % signs
    percent_positions = [i for i, c in enumerate(q) if c == '%']
    print(f"\n{name} query has {len(percent_positions)} percent signs:")
    for pos in percent_positions:
        ctx = q[max(0, pos-5):pos+10]
        print(f"  pos {pos}: ...{repr(ctx)}...")
    
    # Check for %(name)s patterns
    from mssql_python.cursor import parse_pyformat_params
    pyformat_params = parse_pyformat_params(q)
    print(f"  pyformat params found: {pyformat_params}")
    
    # Count ? marks
    q_marks = q.count('?')
    print(f"  ? marks: {q_marks}")
    
    # Check for any non-ASCII characters
    non_ascii = [(i, hex(ord(c))) for i, c in enumerate(q) if ord(c) > 127]
    if non_ascii:
        print(f"  Non-ASCII chars: {non_ascii[:5]}")
    else:
        print(f"  No non-ASCII characters")

print("\nDone.")
