package com.vxtmobile

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.BodyTemperatureRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
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

        /** Full set of read permissions — defined in PermissionHelperActivity.PERMISSIONS */
        val PERMISSIONS get() = PermissionHelperActivity.PERMISSIONS
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
    private fun read(promise: Promise, tag: String = "", block: suspend () -> WritableMap?) {
        scope.launch {
            try {
                val result = block()
                if (result != null) {
                    Log.d(TAG, "read OK [$tag]: value=${result.getDouble("value")}")
                    promise.resolve(result)
                } else {
                    Log.d(TAG, "read NO_DATA [$tag]")
                    promise.reject("NO_DATA", "No recent reading available")
                }
            } catch (e: Throwable) {
                Log.w(TAG, "read error [$tag]: ${e.message}")
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
                val granted: Set<String> = client.permissionController.getGrantedPermissions()
                // Consider permissions granted if we have at least the core set
                // (HR + Steps).  New optional permissions (Calories, Distance, VO2)
                // supplement but should not block the whole screen.
                val corePerms = setOf(
                    "android.permission.health.READ_HEART_RATE",
                    "android.permission.health.READ_STEPS",
                )
                val coreGranted = corePerms.all { it in granted }
                Log.d(TAG, "checkPermissions: ${granted.size}/${PERMISSIONS.size} granted, core=$coreGranted  granted=$granted")
                promise.resolve(coreGranted)
            } catch (e: Throwable) {
                Log.w(TAG, "checkPermissions error: ${e.message}")
                promise.resolve(false)
            }
        }
    }

    /** Open Health Connect's permission management screen for this app.
     *  Tries multiple intent actions for compatibility across Samsung (embedded HC),
     *  Pixel (standalone HC app), and Android 14+ (platform HC).
     *  The user toggles permissions manually, then the AppState listener in JS
     *  re-checks when they return. */
    @ReactMethod
    fun requestPermissions(promise: Promise) {
        val pkg = reactContext.packageName

        // Try intent actions in preference order:
        // 1. Android 14+ platform Health Connect
        // 2. Standalone Health Connect app (Pixel / AOSP)
        // 3. Generic Health Connect home (lets user navigate to app permissions)
        val candidates = listOf(
            android.content.Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS").apply {
                putExtra(android.content.Intent.EXTRA_PACKAGE_NAME, pkg)
            },
            android.content.Intent("androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS").apply {
                putExtra("android.intent.extra.PACKAGE_NAME", pkg)
            },
            android.content.Intent("android.health.connect.action.HEALTH_HOME_SETTINGS"),
        )

        for (intent in candidates) {
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            if (intent.resolveActivity(reactContext.packageManager) != null) {
                reactContext.startActivity(intent)
                Log.d(TAG, "requestPermissions: opened via ${intent.action}")
                promise.resolve(false)
                return
            }
        }

        // Fallback: launch PermissionHelperActivity (uses registerForActivityResult contract)
        Log.d(TAG, "requestPermissions: no settings intent resolved, using PermissionHelperActivity")
        val activity = currentActivity ?: run {
            promise.reject("NO_ACTIVITY", "No foreground activity")
            return
        }
        PermissionHelperActivity.onResult = { granted ->
            promise.resolve(granted)
        }
        val fallbackIntent = android.content.Intent(reactContext, PermissionHelperActivity::class.java).apply {
            addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(fallbackIntent)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != PERM_CODE) return
        scope.launch {
            try {
                val granted: Set<String> = client.permissionController.getGrantedPermissions()
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
    fun getLatestHeartRate(promise: Promise) = read(promise, "HR") {
        val records = client.readRecords(ReadRecordsRequest(
            HeartRateRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val record = records.firstOrNull() ?: return@read null
        if (record.samples.isEmpty()) return@read null
        // Most recent individual sample = current/latest HR reading
        val latest = record.samples.maxByOrNull { it.time } ?: return@read null
        sample(latest.beatsPerMinute.toDouble(), "bpm", latest.time.toEpochMilli())
    }

    @ReactMethod
    fun getLatestHrMin(promise: Promise) = read(promise, "HRMin") {
        // Query last 7 days of heart rate records to find the true recent minimum.
        // Use the actual timestamp of the sample that had the minimum BPM.
        val records = client.readRecords(ReadRecordsRequest(
            HeartRateRecord::class, since(7), ascendingOrder = false, pageSize = 500
        )).records
        val allSamples = records.flatMap { it.samples }
        val minSample = allSamples.minByOrNull { it.beatsPerMinute } ?: return@read null
        sample(minSample.beatsPerMinute.toDouble(), "bpm", minSample.time.toEpochMilli())
    }

    @ReactMethod
    fun getLatestHrMax(promise: Promise) = read(promise, "HRMax") {
        // Query last 7 days of heart rate records to find the true recent maximum.
        // Use the actual timestamp of the sample that had the maximum BPM.
        val records = client.readRecords(ReadRecordsRequest(
            HeartRateRecord::class, since(7), ascendingOrder = false, pageSize = 500
        )).records
        val allSamples = records.flatMap { it.samples }
        val maxSample = allSamples.maxByOrNull { it.beatsPerMinute } ?: return@read null
        sample(maxSample.beatsPerMinute.toDouble(), "bpm", maxSample.time.toEpochMilli())
    }

    // ── Blood Pressure ────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestBloodPressure(promise: Promise) = read(promise, "SBP") {
        val records = client.readRecords(ReadRecordsRequest(
            BloodPressureRecord::class, since(30), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.systolic.inMillimetersOfMercury, "mmHg", r.time.toEpochMilli())
    }

    @ReactMethod
    fun getLatestDiastolicBloodPressure(promise: Promise) = read(promise, "DBP") {
        val records = client.readRecords(ReadRecordsRequest(
            BloodPressureRecord::class, since(30), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.diastolic.inMillimetersOfMercury, "mmHg", r.time.toEpochMilli())
    }

    // ── SpO2 ──────────────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestSpo2(promise: Promise) = read(promise, "SpO2") {
        val records = client.readRecords(ReadRecordsRequest(
            OxygenSaturationRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.percentage.value, "%", r.time.toEpochMilli())
    }

    // ── Body Temperature ──────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestBodyTemperature(promise: Promise) = read(promise, "Temp") {
        val records = client.readRecords(ReadRecordsRequest(
            BodyTemperatureRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.temperature.inCelsius, "°C", r.time.toEpochMilli())
    }

    // ── Blood Glucose ─────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestGlucose(promise: Promise) = read(promise, "Glucose") {
        val records = client.readRecords(ReadRecordsRequest(
            BloodGlucoseRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.level.inMillimolesPerLiter, "mmol/L", r.time.toEpochMilli())
    }

    // ── Steps ─────────────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestStepCount(promise: Promise) = read(promise, "Steps") {
        // Query last 24 hours for daily step total
        val records = client.readRecords(ReadRecordsRequest(
            StepsRecord::class, since(1)
        )).records
        val total = records.sumOf { it.count }
        if (total == 0L) return@read null
        // Use the timestamp of the most recent record (actual measurement time from Health Connect)
        val latestTs = records.maxOfOrNull { it.endTime.toEpochMilli() } ?: Instant.now().toEpochMilli()
        sample(total.toDouble(), "steps", latestTs)
    }

    // ── Resting Heart Rate ────────────────────────────────────────────────────
    // Not available in Samsung Health SDK 1.1.0 — Health Connect only.

    @ReactMethod
    fun getLatestRestingHeartRate(promise: Promise) = read(promise, "RHR") {
        val records = client.readRecords(ReadRecordsRequest(
            RestingHeartRateRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.beatsPerMinute.toDouble(), "bpm", r.time.toEpochMilli())
    }

    // ── HRV (rMSSD) ───────────────────────────────────────────────────────────
    // Not available in Samsung Health SDK 1.1.0 — Health Connect only.

    @ReactMethod
    fun getLatestHrv(promise: Promise) = read(promise, "HRV") {
        val records = client.readRecords(ReadRecordsRequest(
            HeartRateVariabilityRmssdRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.heartRateVariabilityMillis, "ms", r.time.toEpochMilli())
    }

    // ── Respiration Rate ──────────────────────────────────────────────────────
    // Not available in Samsung Health SDK 1.1.0 — Health Connect only.

    @ReactMethod
    fun getLatestRespirationRate(promise: Promise) = read(promise, "RR") {
        val records = client.readRecords(ReadRecordsRequest(
            RespiratoryRateRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.rate, "br/min", r.time.toEpochMilli())
    }

    // ── Sleep Duration ────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestSleepDuration(promise: Promise) = read(promise, "Sleep") {
        val records = client.readRecords(ReadRecordsRequest(
            SleepSessionRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        val durationHours = (r.endTime.toEpochMilli() - r.startTime.toEpochMilli()) / 3_600_000.0
        sample(durationHours, "hrs", r.endTime.toEpochMilli())
    }

    // ── Floors Climbed ────────────────────────────────────────────────────────

    @ReactMethod
    fun getLatestFloorsClimbed(promise: Promise) = read(promise, "Floors") {
        // Query last 24 hours for daily floors total
        val records = client.readRecords(ReadRecordsRequest(
            FloorsClimbedRecord::class, since(1)
        )).records
        val total = records.sumOf { it.floors }
        if (total == 0.0) return@read null
        // Use the timestamp of the most recent floors record (when was the last floor climbing recorded)
        val latestTs = records.maxOfOrNull { it.endTime.toEpochMilli() } ?: Instant.now().toEpochMilli()
        sample(total, "floors", latestTs)
    }

    // ── Active Calories ───────────────────────────────────────────────────────
    // Sum of active calories burned today.  Galaxy Watch syncs this reliably.
    // Fallback: TotalCaloriesBurned — Samsung Health writes this type (not Active).

    @ReactMethod
    fun getLatestActiveCalories(promise: Promise) = read(promise, "Calories") {
        // Query last 24 hours for daily active calorie total
        val records = client.readRecords(ReadRecordsRequest(
            ActiveCaloriesBurnedRecord::class, since(1)
        )).records
        val total = records.sumOf { it.energy.inKilocalories }
        if (total > 0.0) {
            // Use the timestamp of the most recent record (when was the last calorie sample recorded)
            val latestTs = records.maxOfOrNull { it.endTime.toEpochMilli() } ?: Instant.now().toEpochMilli()
            return@read sample(total, "kcal", latestTs)
        }
        // Fallback: Samsung Health writes TotalCaloriesBurned (not ActiveCaloriesBurned) — last 24 hours
        val totalRecords = client.readRecords(ReadRecordsRequest(
            TotalCaloriesBurnedRecord::class, since(1)
        )).records
        val totalKcal = totalRecords.sumOf { it.energy.inKilocalories }
        if (totalKcal == 0.0) return@read null
        // Use the timestamp of the most recent total calories record
        val latestTsFallback = totalRecords.maxOfOrNull { it.endTime.toEpochMilli() } ?: Instant.now().toEpochMilli()
        sample(totalKcal, "kcal", latestTsFallback)
    }

    // ── Distance ──────────────────────────────────────────────────────────────
    // Total distance (walked/run) — last 7 days to survive midnight boundary.

    @ReactMethod
    fun getLatestDistance(promise: Promise) = read(promise, "Distance") {
        // Query last 24 hours for daily distance total
        val records = client.readRecords(ReadRecordsRequest(
            DistanceRecord::class, since(1)
        )).records
        val totalKm = records.sumOf { it.distance.inKilometers }
        if (totalKm == 0.0) return@read null
        // Use the timestamp of the most recent distance record (actual end time of the last distance measurement)
        val latestTs = records.maxOfOrNull { it.endTime.toEpochMilli() } ?: Instant.now().toEpochMilli()
        sample(totalKm, "km", latestTs)
    }

    // ── VO₂ Max ───────────────────────────────────────────────────────────────
    // Maximal oxygen consumption — Galaxy Watch 4+ measures this automatically.

    @ReactMethod
    fun getLatestVo2Max(promise: Promise) = read(promise, "VO2Max") {
        val records = client.readRecords(ReadRecordsRequest(
            Vo2MaxRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.vo2MillilitersPerMinuteKilogram, "mL/kg·min", r.time.toEpochMilli())
    }

    // ── Weight ────────────────────────────────────────────────────────────────
    // Latest body weight reading (from smart scale / manual log in Samsung Health).

    @ReactMethod
    fun getLatestWeight(promise: Promise) = read(promise, "Weight") {
        val records = client.readRecords(ReadRecordsRequest(
            WeightRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.weight.inKilograms, "kg", r.time.toEpochMilli())
    }

    // ── Body Fat % ────────────────────────────────────────────────────────────
    // Latest body fat percentage (from smart scale / manual log in Samsung Health).

    @ReactMethod
    fun getLatestBodyFat(promise: Promise) = read(promise, "BodyFat") {
        val records = client.readRecords(ReadRecordsRequest(
            BodyFatRecord::class, since(7), ascendingOrder = false, pageSize = 1
        )).records
        val r = records.firstOrNull() ?: return@read null
        sample(r.percentage.value, "%", r.time.toEpochMilli())
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

                // Heart Rate — daily min/max/avg aggregated across ALL samples in the range.
                // Samsung Health syncs each HR measurement as a separate record with 1 sample,
                // so per-record min/max == avg (all 3 lines look identical in the chart).
                // Fix: group every sample by calendar day and compute true daily min/max/avg.
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, filter)).records
                    val zone = ZoneId.systemDefault()
                    // Collect (bpm, sampleTimestampMs) grouped by local date — preserve real timestamps
                    val byDay = sortedMapOf<java.time.LocalDate, MutableList<Pair<Long, Long>>>()
                    for (rec in records) {
                        for (s in rec.samples) {
                            val sMs = s.time.toEpochMilli()
                            val day = s.time.atZone(zone).toLocalDate()
                            byDay.getOrPut(day) { mutableListOf() }.add(Pair(s.beatsPerMinute, sMs))
                        }
                    }
                    val arrAvg = Arguments.createArray()
                    val arrMin = Arguments.createArray()
                    val arrMax = Arguments.createArray()
                    for ((_, pts) in byDay) {
                        // Use actual last-sample timestamp of each day — guaranteed within queried range
                        val ts = pts.maxOf { it.second }.toDouble()
                        val avg = pts.map { it.first }.average()
                        val min = pts.minOf { it.first }.toDouble()
                        val max = pts.maxOf { it.first }.toDouble()
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

                // Active Calories — 41981-2 (daily totals)
                runCatching {
                    val zone  = ZoneId.systemDefault()
                    val arr   = Arguments.createArray()
                    var day   = from.atZone(zone).toLocalDate()
                    val toDay = to.atZone(zone).toLocalDate()
                    while (!day.isAfter(toDay)) {
                        val dayStart = day.atStartOfDay(zone).toInstant()
                        val dayEnd   = day.plusDays(1).atStartOfDay(zone).toInstant()
                        val total    = client.readRecords(ReadRecordsRequest(
                            ActiveCaloriesBurnedRecord::class, TimeRangeFilter.between(dayStart, dayEnd)
                        )).records.sumOf { it.energy.inKilocalories }
                        if (total > 0.0) {
                            val ts = day.atStartOfDay(zone).plusHours(12).toInstant().toEpochMilli().toDouble()
                            arr.pushMap(Arguments.createMap().apply { putDouble("v", total); putDouble("ts", ts) })
                        }
                        day = day.plusDays(1)
                    }
                    if (arr.size() > 0) result.putArray("41981-2", arr)
                }

                // Distance — 55430-3 (daily totals in km)
                runCatching {
                    val zone  = ZoneId.systemDefault()
                    val arr   = Arguments.createArray()
                    var day   = from.atZone(zone).toLocalDate()
                    val toDay = to.atZone(zone).toLocalDate()
                    while (!day.isAfter(toDay)) {
                        val dayStart = day.atStartOfDay(zone).toInstant()
                        val dayEnd   = day.plusDays(1).atStartOfDay(zone).toInstant()
                        val totalKm  = client.readRecords(ReadRecordsRequest(
                            DistanceRecord::class, TimeRangeFilter.between(dayStart, dayEnd)
                        )).records.sumOf { it.distance.inKilometers }
                        if (totalKm > 0.0) {
                            val ts = day.atStartOfDay(zone).plusHours(12).toInstant().toEpochMilli().toDouble()
                            arr.pushMap(Arguments.createMap().apply { putDouble("v", totalKm); putDouble("ts", ts) })
                        }
                        day = day.plusDays(1)
                    }
                    if (arr.size() > 0) result.putArray("55430-3", arr)
                }

                // VO₂ Max — 60842-2
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(Vo2MaxRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) arr.pushMap(Arguments.createMap().apply {
                        putDouble("v", r.vo2MillilitersPerMinuteKilogram); putDouble("ts", r.time.toEpochMilli().toDouble())
                    })
                    if (arr.size() > 0) result.putArray("60842-2", arr)
                }

                // Weight — 29463-7
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(WeightRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) arr.pushMap(Arguments.createMap().apply {
                        putDouble("v", r.weight.inKilograms); putDouble("ts", r.time.toEpochMilli().toDouble())
                    })
                    if (arr.size() > 0) result.putArray("29463-7", arr)
                }

                // Body Fat — 41982-0
                runCatching {
                    val records = client.readRecords(ReadRecordsRequest(BodyFatRecord::class, filter)).records
                    val arr = Arguments.createArray()
                    for (r in records) arr.pushMap(Arguments.createMap().apply {
                        putDouble("v", r.percentage.value); putDouble("ts", r.time.toEpochMilli().toDouble())
                    })
                    if (arr.size() > 0) result.putArray("41982-0", arr)
                }

                promise.resolve(result)
            } catch (e: Throwable) {
                Log.w(TAG, "fetchAllHistory error: ${e.message}")
                promise.reject("HISTORY_ERROR", e.message ?: "Unknown error")
            }
        }
    }
}
