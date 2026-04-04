package com.vxtmobile

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyTemperatureRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * HealthConnectModule
 *
 * React Native bridge for Android Health Connect (androidx.health.connect.client).
 * Reads health data from ANY wearable that writes to Health Connect:
 *   Galaxy Watch, Amazfit (Zepp), Xiaomi, Garmin, Fitbit, Polar, etc.
 *
 * Advantages over SamsungHealthModule:
 *   - Real per-measurement timestamps (no daily aggregate limitation)
 *   - Per-sample HR data (seconds-level resolution)
 *   - Works on any Android 13+ device regardless of Samsung Health version
 *   - Unlocks HRV, Resting HR, Respiration Rate (absent from Samsung SDK 1.1.0)
 *   - No readData() 9003 error — uses HC's own record store
 *
 * Available metrics:
 *   HeartRate, HeartRateMin/Max, BloodPressure(SBP+DBP), SpO2, BodyTemperature,
 *   BloodGlucose, Steps, RestingHeartRate, HRV(rMSSD), RespiratoryRate,
 *   SleepDuration, FloorsClimbed
 */
class HealthConnectModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    override fun getName(): String = "HealthConnectModule"

    private val client: HealthConnectClient by lazy { HealthConnectClient.getOrCreate(reactContext) }
    private val scope = CoroutineScope(Dispatchers.IO)
    private var pendingPermPromise: Promise? = null
    private var collectingData = false

    companion object {
        private const val TAG       = "HealthConnectModule"
        private const val PERM_CODE = 9877

        /** Full set of read permissions requested at runtime */
        private val PERMISSIONS = setOf(
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(BloodPressureRecord::class),
            HealthPermission.getReadPermission(OxygenSaturationRecord::class),
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(BloodGlucoseRecord::class),
            HealthPermission.getReadPermission(BodyTemperatureRecord::class),
            HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
            HealthPermission.getReadPermission(RespiratoryRateRecord::class),
            HealthPermission.getReadPermission(RestingHeartRateRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(FloorsClimbedRecord::class),
        )
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** TimeRangeFilter covering the last N days ending now */
    private fun since(days: Long): TimeRangeFilter =
        TimeRangeFilter.between(Instant.now().minus(days, ChronoUnit.DAYS), Instant.now())

    private fun sample(value: Double, unit: String, tsMs: Long): WritableMap =
        WritableNativeMap().apply {
            putDouble("timestamp", tsMs.toDouble())
            putDouble("value",     value)
            putString("unit",      unit)
            putString("deviceId",  "HealthConnect")
        }

    /** Runs a suspend block on IO dispatcher and resolves/rejects the promise. */
    private fun read(promise: Promise, block: suspend () -> WritableMap?) {
        scope.launch {
            try {
                val result = block()
                if (result != null) promise.resolve(result)
                else promise.reject("NO_DATA", "No recent reading available")
            } catch (e: Throwable) {
                Log.w(TAG, "read error: ${e.message}")
                promise.reject("READ_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    // ── Availability ──────────────────────────────────────────────────────────

    @ReactMethod
    fun isAvailable(promise: Promise) {
        val status = HealthConnectClient.getSdkStatus(reactContext)
        Log.d(TAG, "isAvailable: sdkStatus=$status (SDK_AVAILABLE=${HealthConnectClient.SDK_AVAILABLE})")
        promise.resolve(status == HealthConnectClient.SDK_AVAILABLE)
    }

    // ── Permissions ───────────────────────────────────────────────────────────

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        scope.launch {
            try {
                val granted   = client.permissionController.getGrantedPermissions()
                val allGranted = PERMISSIONS.all { it in granted }
                Log.d(TAG, "checkPermissions: ${granted.size}/${PERMISSIONS.size} granted, all=$allGranted")
                promise.resolve(allGranted)
            } catch (e: Throwable) {
                Log.w(TAG, "checkPermissions error: ${e.message}")
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        val activity = currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "No foreground activity for permission dialog")
            return
        }
        pendingPermPromise = promise
        val contract = PermissionController.createRequestPermissionResultContract()
        val intent   = contract.createIntent(activity, PERMISSIONS)
        activity.startActivityForResult(intent, PERM_CODE)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != PERM_CODE) return
        scope.launch {
            try {
                val granted    = client.permissionController.getGrantedPermissions()
                val allGranted = PERMISSIONS.all { it in granted }
                pendingPermPromise?.resolve(allGranted)
            } catch (e: Throwable) {
                pendingPermPromise?.resolve(false)
            } finally {
                pendingPermPromise = null
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {}

    // ── Foreground service passthrough ────────────────────────────────────────
    // Reuses GatewayForegroundService so GatewaySampleTick events fire on schedule
    // (keeps the app alive in the background regardless of which driver is active).

    @ReactMethod
    fun startDataCollection(intervalMs: Double, promise: Promise) {
        if (collectingData) { promise.resolve(null); return }
        val intent = Intent(reactContext, GatewayForegroundService::class.java)
            .setAction(GatewayForegroundService.ACTION_START)
            .putExtra(GatewayForegroundService.EXTRA_SAMPLE_INTERVAL_MS, intervalMs.toLong())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
        collectingData = true
        promise.resolve(null)
    }

    @ReactMethod
    fun stopDataCollection(promise: Promise) {
        val intent = Intent(reactContext, GatewayForegroundService::class.java)
            .setAction(GatewayForegroundService.ACTION_STOP)
        reactContext.startService(intent)
        collectingData = false
        promise.resolve(null)
    }

    // ── Heart Rate ────────────────────────────────────────────────────────────
    // HC HR records contain a samples list — each sample has an individual
    // timestamp and beatsPerMinute, giving per-second resolution.

    @ReactMethod
    fun getLatestHeartRate(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            HeartRateRecord::class, since(30), ascendingOrder = false, pageSize = 5
        )).records
        val record = records.firstOrNull() ?: return@read null
        if (record.samples.isEmpty()) return@read null
        val avg = record.samples.map { it.beatsPerMinute }.average()
        sample(avg, "bpm", record.endTime.toEpochMilli())
    }

    @ReactMethod
    fun getLatestHrMin(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            HeartRateRecord::class, since(30), ascendingOrder = false, pageSize = 5
        )).records
        val record = records.firstOrNull() ?: return@read null
        val min = record.samples.minOfOrNull { it.beatsPerMinute.toDouble() } ?: return@read null
        sample(min, "bpm", record.endTime.toEpochMilli())
    }

    @ReactMethod
    fun getLatestHrMax(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            HeartRateRecord::class, since(30), ascendingOrder = false, pageSize = 5
        )).records
        val record = records.firstOrNull() ?: return@read null
        val max = record.samples.maxOfOrNull { it.beatsPerMinute.toDouble() } ?: return@read null
        sample(max, "bpm", record.endTime.toEpochMilli())
    }

    // ── Blood Pressure ────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestBloodPressure(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            BloodPressureRecord::class, since(30), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.systolic.inMillimetersOfMercury, "mmHg", r.time.toEpochMilli())
    }

    @ReactMethod
    fun getLatestDiastolicBloodPressure(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            BloodPressureRecord::class, since(30), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.diastolic.inMillimetersOfMercury, "mmHg", r.time.toEpochMilli())
    }

    // ── SpO2 ──────────────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestSpo2(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            OxygenSaturationRecord::class, since(30), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.percentage.value, "%", r.time.toEpochMilli())
    }

    // ── Body Temperature ──────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestBodyTemperature(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            BodyTemperatureRecord::class, since(30), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.temperature.inCelsius, "°C", r.time.toEpochMilli())
    }

    // ── Blood Glucose ─────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestGlucose(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            BloodGlucoseRecord::class, since(30), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.level.inMillimolesPerLiter, "mmol/L", r.time.toEpochMilli())
    }

    // ── Steps ─────────────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestStepCount(promise: Promise) = read(promise) {
        val zone       = ZoneId.systemDefault()
        val todayStart = LocalDate.now().atStartOfDay(zone).toInstant()
        val records    = client.readRecords(ReadRecordsRequest(
            StepsRecord::class, TimeRangeFilter.between(todayStart, Instant.now())
        )).records
        val total = records.sumOf { it.count }
        if (total == 0L) return@read null
        sample(total.toDouble(), "steps", Instant.now().toEpochMilli())
    }

    // ── Resting Heart Rate ────────────────────────────────────────────────────
    // Not available in Samsung Health SDK 1.1.0 — Health Connect only.

    @ReactMethod
    fun getLatestRestingHeartRate(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            RestingHeartRateRecord::class, since(30), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.beatsPerMinute.toDouble(), "bpm", r.time.toEpochMilli())
    }

    // ── HRV (rMSSD) ───────────────────────────────────────────────────────────
    // Not available in Samsung Health SDK 1.1.0 — Health Connect only.

    @ReactMethod
    fun getLatestHrv(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            HeartRateVariabilityRmssdRecord::class, since(30), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.heartRateVariabilityMillis, "ms", r.time.toEpochMilli())
    }

    // ── Respiration Rate ──────────────────────────────────────────────────────
    // Not available in Samsung Health SDK 1.1.0 — Health Connect only.

    @ReactMethod
    fun getLatestRespirationRate(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            RespiratoryRateRecord::class, since(30), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.rate, "br/min", r.time.toEpochMilli())
    }

    // ── Sleep Duration ────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestSleepDuration(promise: Promise) = read(promise) {
        val records = client.readRecords(ReadRecordsRequest(
            SleepSessionRecord::class, since(14), ascendingOrder = false, pageSize = 3
        )).records
        val r = records.firstOrNull() ?: return@read null
        val durationHours = (r.endTime.toEpochMilli() - r.startTime.toEpochMilli()) / 3_600_000.0
        sample(durationHours, "hrs", r.endTime.toEpochMilli())
    }

    // ── Floors Climbed ────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestFloorsClimbed(promise: Promise) = read(promise) {
        val zone       = ZoneId.systemDefault()
        val todayStart = LocalDate.now().atStartOfDay(zone).toInstant()
        val todayRecs  = client.readRecords(ReadRecordsRequest(
            FloorsClimbedRecord::class, TimeRangeFilter.between(todayStart, Instant.now())
        )).records
        val todayTotal = todayRecs.sumOf { it.floors }
        if (todayTotal > 0.0) return@read sample(todayTotal, "floors", Instant.now().toEpochMilli())
        // Fallback: most recent record in last 7 days
        val recent = client.readRecords(ReadRecordsRequest(
            FloorsClimbedRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = recent.firstOrNull() ?: return@read null
        sample(r.floors, "floors", r.endTime.toEpochMilli())
    }

    // ── Bulk history (for chart and backlog) ──────────────────────────────────
    // Returns a WritableMap keyed by LOINC code, each value an array of {v, ts}.
    // HR records give per-sample resolution (seconds-level from the Watch).

    @ReactMethod
    fun fetchAllHistory(fromMs: Double, toMs: Double, promise: Promise) {
        scope.launch {
            try {
                val from   = Instant.ofEpochMilli(fromMs.toLong())
                val to     = Instant.ofEpochMilli(toMs.toLong())
                val filter = TimeRangeFilter.between(from, to)
                val result = WritableNativeMap()

                // Heart Rate — expand each record's samples list for fine-grained resolution
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, filter)).records
                    val arrAvg = Arguments.createArray()
                    val arrMin = Arguments.createArray()
                    val arrMax = Arguments.createArray()
                    for (rec in records) {
                        if (rec.samples.isEmpty()) continue
                        val ts  = rec.endTime.toEpochMilli().toDouble()
                        val avg = rec.samples.map { it.beatsPerMinute }.average()
                        val min = rec.samples.minOf { it.beatsPerMinute }.toDouble()
                        val max = rec.samples.maxOf { it.beatsPerMinute }.toDouble()
                        arrAvg.pushMap(Arguments.createMap().apply { putDouble("v", avg); putDouble("ts", ts) })
                        arrMin.pushMap(Arguments.createMap().apply { putDouble("v", min); putDouble("ts", ts) })
                        arrMax.pushMap(Arguments.createMap().apply { putDouble("v", max); putDouble("ts", ts) })
                    }
                    if (arrAvg.size() > 0) {
                        result.putArray("8867-4", arrAvg)
                        result.putArray("8638-5", arrMin)
                        result.putArray("8639-3", arrMax)
                    }
                }

                // Blood Pressure
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(BloodPressureRecord::class, filter)).records
                    val arrSbp = Arguments.createArray()
                    val arrDbp = Arguments.createArray()
                    for (r in records) {
                        val ts = r.time.toEpochMilli().toDouble()
                        arrSbp.pushMap(Arguments.createMap().apply { putDouble("v", r.systolic.inMillimetersOfMercury); putDouble("ts", ts) })
                        arrDbp.pushMap(Arguments.createMap().apply { putDouble("v", r.diastolic.inMillimetersOfMercury); putDouble("ts", ts) })
                    }
                    if (arrSbp.size() > 0) { result.putArray("8480-6", arrSbp); result.putArray("8462-4", arrDbp) }
                }

                // SpO2
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) arr.pushMap(Arguments.createMap().apply {
                        putDouble("v", r.percentage.value); putDouble("ts", r.time.toEpochMilli().toDouble())
                    })
                    if (arr.size() > 0) result.putArray("59408-5", arr)
                }

                // Body Temperature
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(BodyTemperatureRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) arr.pushMap(Arguments.createMap().apply {
                        putDouble("v", r.temperature.inCelsius); putDouble("ts", r.time.toEpochMilli().toDouble())
                    })
                    if (arr.size() > 0) result.putArray("8310-5", arr)
                }

                // Blood Glucose
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(BloodGlucoseRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) arr.pushMap(Arguments.createMap().apply {
                        putDouble("v", r.level.inMillimolesPerLiter); putDouble("ts", r.time.toEpochMilli().toDouble())
                    })
                    if (arr.size() > 0) result.putArray("2339-0", arr)
                }

                // Steps — daily totals to match Samsung pattern
                runCatching {
                    val zone  = ZoneId.systemDefault()
                    val arr   = Arguments.createArray()
                    var day   = from.atZone(zone).toLocalDate()
                    val toDay = to.atZone(zone).toLocalDate()
                    while (!day.isAfter(toDay)) {
                        val dayStart = day.atStartOfDay(zone).toInstant()
                        val dayEnd   = day.plusDays(1).atStartOfDay(zone).toInstant()
                        val total    = client.readRecords(ReadRecordsRequest(
                            StepsRecord::class, TimeRangeFilter.between(dayStart, dayEnd)
                        )).records.sumOf { it.count }
                        if (total > 0) {
                            val ts = day.atStartOfDay(zone).plusHours(12).toInstant().toEpochMilli().toDouble()
                            arr.pushMap(Arguments.createMap().apply { putDouble("v", total.toDouble()); putDouble("ts", ts) })
                        }
                        day = day.plusDays(1)
                    }
                    if (arr.size() > 0) result.putArray("55423-8", arr)
                }

                // HRV (rMSSD) — 80404-7
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(HeartRateVariabilityRmssdRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) arr.pushMap(Arguments.createMap().apply {
                        putDouble("v", r.heartRateVariabilityMillis); putDouble("ts", r.time.toEpochMilli().toDouble())
                    })
                    if (arr.size() > 0) result.putArray("80404-7", arr)
                }

                // Respiration Rate — 9303-9 (LOINC for respiratory rate tile in VitalsDefs)
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(RespiratoryRateRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) arr.pushMap(Arguments.createMap().apply {
                        putDouble("v", r.rate); putDouble("ts", r.time.toEpochMilli().toDouble())
                    })
                    if (arr.size() > 0) result.putArray("9303-9", arr)
                }

                // Resting Heart Rate — 8418-4
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) arr.pushMap(Arguments.createMap().apply {
                        putDouble("v", r.beatsPerMinute.toDouble()); putDouble("ts", r.time.toEpochMilli().toDouble())
                    })
                    if (arr.size() > 0) result.putArray("8418-4", arr)
                }

                // Sleep Duration — 93832-4
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) {
                        val hours = (r.endTime.toEpochMilli() - r.startTime.toEpochMilli()) / 3_600_000.0
                        arr.pushMap(Arguments.createMap().apply {
                            putDouble("v", hours); putDouble("ts", r.endTime.toEpochMilli().toDouble())
                        })
                    }
                    if (arr.size() > 0) result.putArray("93832-4", arr)
                }

                // Floors Climbed — 55426-1
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(FloorsClimbedRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) arr.pushMap(Arguments.createMap().apply {
                        putDouble("v", r.floors); putDouble("ts", r.endTime.toEpochMilli().toDouble())
                    })
                    if (arr.size() > 0) result.putArray("55426-1", arr)
                }

                promise.resolve(result)
            } catch (e: Throwable) {
                Log.w(TAG, "fetchAllHistory error: ${e.message}")
                promise.reject("HISTORY_ERROR", e.message ?: "Unknown error")
            }
        }
    }
}
