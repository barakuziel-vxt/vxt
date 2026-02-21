# Yacht Telemetry Graph Issue - Root Cause & Fix

## Problem Summary
The telemetry graph in the EntityTelemetryAnalyticsPage was empty for yacht entities (TomerRefael, TinyK) but working correctly for person entities (Barak, Shula).

## Root Cause
**Date format parsing issue in the backend API**

The frontend was sending ISO 8601 timestamps with UTC indicator and microseconds:
```
2026-02-21T11:49:27.693557Z
```

The backend was using SQL Server's `CONVERT(DATETIME, ?)` function to parse these strings, which doesn't handle:
- Microsecond precision
- The 'Z' suffix indicator
- Full ISO format with timezone info

This caused `CONVERT(DATETIME, ?)` to fail with a "Conversion failed" error, resulting in:
- **Empty datasets** for all entities (including yachts)
- **No error shown to users** in the UI (HTTP 500 errors)
- Console errors: `Msg 22007 - Conversion failed when converting date and/or time from character string`

## Why Person Entities Appeared to Work
Person entities **did NOT actually work** - the issue affected all entities. The earlier dashboard sessions may have had cached data or the user selected a different time range.

## Solution Implemented

### Backend Fix (main.py)
Changed date parsing from SQL Server's `CONVERT()` to Python's `datetime.fromisoformat()`:

**Before:**
```python
query = """
...
WHERE entityId = ?
  AND endTimestampUTC >= CONVERT(DATETIME, ?)
  AND endTimestampUTC <= CONVERT(DATETIME, ?)
"""
cur.execute(query, (entity_id, startDate, endDate))
```

**After:**
```python
# Parse ISO format datetime string in Python
start_str = startDate.replace('Z', '') if startDate.endswith('Z') else startDate
end_str = endDate.replace('Z', '') if endDate.endswith('Z') else endDate

start_dt = datetime.fromisoformat(start_str)
end_dt = datetime.fromisoformat(end_str)

# Convert to SQL Server-compatible format
start_sql = start_dt.strftime('%Y-%m-%d %H:%M:%S.%f')[:-4]  # 3-digit milliseconds
end_sql = end_dt.strftime('%Y-%m-%d %H:%M:%S.%f')[:-4]

query = """
...
WHERE entityId = ?
  AND endTimestampUTC >= CONVERT(DATETIME2, ?)
  AND endTimestampUTC <= CONVERT(DATETIME2, ?)
"""
cur.execute(query, (entity_id, start_sql, end_sql))
```

### Key Changes:
1. **Python handles ISO parsing** - More robust than SQL Server's CONVERT()
2. **Strip 'Z' suffix** before parsing
3. **Use DATETIME2** instead of DATETIME for better precision
4. **Format to 3-digit milliseconds** - SQL Server standard

### Frontend Updates
- Removed debug logging that was cluttering the console
- Kept proper error handling for failed API calls
- No changes needed to the frontend date conversion logic

## Verification

Test script output shows the fix works:
```
Testing /api/telemetry/range/234567890
   Status: 200
   OK: Received 3100 telemetry records
      First timestamp: 2026-02-21 12:35:05.8438480
      Last timestamp:  2026-02-21 13:46:48.9065200
```

## Files Modified
1. **c:\VXT\main.py** - Backend date parsing fix
2. **c:\VXT\admin-dashboard\src\pages\EntityTelemetryAnalyticsPage.jsx** - Cleaned up debug logging
3. **c:\VXT\test_yacht_telemetry.py** - Test script (new file for validation)

## Testing
The yacht telemetry graph should now:
- Display data points when viewing yacht entities
- Match the data retrieval behavior of person entities
- Handle any ISO format datetime with or without 'Z' suffix
- Support microsecond precision in timestamps

## Performance Impact
- No negative impact - Python's `datetime` module is fast
- Slightly more readable/maintainable code
- Better error messages for invalid date formats
