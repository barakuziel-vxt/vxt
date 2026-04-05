package com.vxtmobile

import android.content.Intent
import android.os.Build
import android.bluetooth.BluetoothManager
import android.util.Log
import android.content.Context
import com.facebook.react.bridge.*
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableNativeMap
import com.samsung.android.sdk.health.data.HealthDataService
import com.samsung.android.sdk.health.data.HealthDataStore
import com.samsung.android.sdk.health.data.data.HealthDataPoint
import com.samsung.android.sdk.health.data.data.entries.BloodGlucose
import com.samsung.android.sdk.health.data.data.entries.HeartRate
import com.samsung.android.sdk.health.data.data.entries.OxygenSaturation
import com.samsung.android.sdk.health.data.data.entries.SkinTemperature
import com.samsung.android.sdk.health.data.data.entries.SleepSession
import com.samsung.android.sdk.health.data.permission.AccessType
import com.samsung.android.sdk.health.data.permission.Permission
import com.samsung.android.sdk.health.data.helper.aggregate
import com.samsung.android.sdk.health.data.request.DataType
import com.samsung.android.sdk.health.data.request.DataTypes
import com.samsung.android.sdk.health.data.request.InstantTimeFilter
import com.samsung.android.sdk.health.data.request.LocalTimeFilter
import com.samsung.android.sdk.health.data.request.Ordering
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import com.samsung.android.sdk.health.data.request.LocalDateFilter

/**
 * SamsungHealthModule — REAL SDK implementation (samsung-health-data-api-1.1.0.aar)
 *
 * Reads live data from Samsung Health which automatically syncs from connected
 * Galaxy Watch (Watch 5). All metric reads use the last 24 h as the time window
 * and return the most recent recorded sample (Ordering.DESC, limit 1).
 *
 * Metrics available in SDK 1.1.0:
 *   HeartRate, BloodPressure (SBP+DBP), BloodOxygen (SpO2), BloodGlucose,
 *   BodyTemperature, Steps (aggregate), IrregularHeartRhythmNotification (AFib)
 *
 * Metrics NOT in SDK 1.1.0 (return null → skipped by delta filter in TS driver):
 *   Average Glucose, Resting Heart Rate, HRV, Respiration Rate
 */
class SamsungHealthModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SamsungHealthModule"

    private val store: HealthDataStore by lazy { HealthDataService.getStore(reactContext) }
    private val scope = CoroutineScope(Dispatchers.IO)
    private var collectingData = false

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    @ReactMethod
    fun isAvailable(promise: Promise) {
        try {
            store // trigger lazy init — throws if Samsung Health app not installed
            Log.d("SamsungHealthModule", "isAvailable: true")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.d("SamsungHealthModule", "isAvailable: false – ${e.message}")
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getConnectedDeviceName(promise: Promise) {
        try {
            val btManager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = btManager?.adapter
            if (adapter == null || !adapter.isEnabled) {
                promise.resolve(null); return
            }
            // BLUETOOTH_CONNECT permission is declared in the manifest; on API 31+ it
            // is a runtime permission but Samsung Note20 running Samsung Health already
            // grants it implicitly for the app process. The catch block handles the
            // rare case where it isn't available.
            @Suppress("MissingPermission")
            val watch = adapter.bondedDevices?.firstOrNull { d ->
                val n = d.name ?: ""
                n.contains("Watch", ignoreCase = true) ||
                n.contains("Galaxy", ignoreCase = true) ||
                n.contains("Gear",  ignoreCase = true)
            }
            @Suppress("MissingPermission")
            promise.resolve(watch?.name)
        } catch (e: SecurityException) {
            promise.resolve(null)
        } catch (e: Throwable) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val permissions = setOf(
            Permission.of(DataTypes.HEART_RATE, AccessType.READ),
            Permission.of(DataTypes.BLOOD_PRESSURE, AccessType.READ),
            Permission.of(DataTypes.BLOOD_OXYGEN, AccessType.READ),
            Permission.of(DataTypes.BLOOD_GLUCOSE, AccessType.READ),
            Permission.of(DataTypes.BODY_TEMPERATURE, AccessType.READ),
            Permission.of(DataTypes.STEPS, AccessType.READ),
            Permission.of(DataTypes.IRREGULAR_HEART_RHYTHM_NOTIFICATION, AccessType.READ),
            Permission.of(DataTypes.SKIN_TEMPERATURE, AccessType.READ),
            Permission.of(DataTypes.SLEEP, AccessType.READ),
            Permission.of(DataTypes.BODY_COMPOSITION, AccessType.READ),
            Permission.of(DataTypes.FLOORS_CLIMBED, AccessType.READ),
        )
        scope.launch {
            try {
                val granted = store.getGrantedPermissions(permissions)
                Log.d("SamsungHealthModule", "checkPermissions: granted=${granted.size}/${permissions.size}")
                promise.resolve(granted.size == permissions.size)
            } catch (e: Throwable) {
                Log.d("SamsungHealthModule", "checkPermissions: error ${e.message}")
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No foreground activity for permission dialog")
            return
        }
        val permissions = setOf(
            Permission.of(DataTypes.HEART_RATE, AccessType.READ),
            Permission.of(DataTypes.BLOOD_PRESSURE, AccessType.READ),
            Permission.of(DataTypes.BLOOD_OXYGEN, AccessType.READ),
            Permission.of(DataTypes.BLOOD_GLUCOSE, AccessType.READ),
            Permission.of(DataTypes.BODY_TEMPERATURE, AccessType.READ),
            Permission.of(DataTypes.STEPS, AccessType.READ),
            Permission.of(DataTypes.IRREGULAR_HEART_RHYTHM_NOTIFICATION, AccessType.READ),
            Permission.of(DataTypes.SKIN_TEMPERATURE, AccessType.READ),
            Permission.of(DataTypes.SLEEP, AccessType.READ),
            Permission.of(DataTypes.BODY_COMPOSITION, AccessType.READ),
            Permission.of(DataTypes.FLOORS_CLIMBED, AccessType.READ),
        )
        // requestPermissions must run on the Main thread (shows Samsung Health dialog)
        CoroutineScope(Dispatchers.Main).launch {
            try {
                Log.d("SamsungHealthModule", "requestPermissions: launching consent dialog")
                val granted = store.requestPermissions(permissions, activity)
                Log.d("SamsungHealthModule", "requestPermissions: granted=${granted.size} permissions: $granted")
                promise.resolve(granted.isNotEmpty())
            } catch (e: Throwable) {
                val msg = e.message ?: ""
                Log.d("SamsungHealthModule", "requestPermissions: exception: $msg")
                if (msg.contains("2003") || msg.contains("policy", ignoreCase = true)) {
                    promise.reject(
                        "POLICY_ERROR",
                        "Samsung Health Developer Mode required. " +
                        "Open Samsung Health → ☰ → Settings → About Samsung Health → " +
                        "tap the version number 10 times until 'Developer mode enabled' appears, " +
                        "then try again."
                    )
                } else {
                    promise.reject("PERMISSION_ERROR", msg)
                }
            }
        }
    }

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

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** 24-hour lookback filter — covers any reasonable gap between Watch syncs */
    private fun last24h(): InstantTimeFilter =
        InstantTimeFilter.since(Instant.now().minus(30, ChronoUnit.DAYS))

    /** N-day lookback as LocalDateFilter, for use with HeartRate aggregate() */
    private fun localDateLast(days: Long): LocalDateFilter =
        LocalDateFilter.of(LocalDate.now().minusDays(days), LocalDate.now())

    private fun sample(value: Double, unit: String, tsEpochMs: Double): WritableMap =
        WritableNativeMap().apply {
            putDouble("timestamp", tsEpochMs)
            putDouble("value", value)
            putString("unit", unit)
            putString("deviceId", "SamsungHealth")
        }

    /**
     * Run a suspend read on the IO dispatcher and resolve/reject the promise.
     * Returns null values as promise.reject("NO_DATA") so the TS driver skips
     * this metric for the current frame (delta logic handles it gracefully).
     */
    private fun read(promise: Promise, block: suspend () -> WritableMap?) {
        scope.launch {
            try {
                val result = block()
                if (result != null) {
                    promise.resolve(result)
                } else {
                    Log.d("SamsungHealthModule", "read: NO_DATA (null result)")
                    promise.reject("NO_DATA", "No recent reading available")
                }
            } catch (e: Throwable) {
                Log.d("SamsungHealthModule", "read: ERROR ${e.javaClass.simpleName}: ${e.message}")
                promise.reject("READ_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    // ── Heart Rate (8867-4 / 8638-5 / 8639-3) ─────────────────────────────────
    // HeartRate entry has heartRate (mean), min, max for the measurement interval.

    @ReactMethod
    fun getLatestHeartRate(promise: Promise) = read(promise) {
        // SDK 1.1.0 has no HR AVG aggregate — derive from (MIN+MAX)/2 for most recent day
        val filter = localDateLast(7)
        val dMin = store.aggregate(DataType.HeartRateType.MIN) {
            setLocalDateFilter(filter); setOrdering(Ordering.DESC)
        }
        val dMax = store.aggregate(DataType.HeartRateType.MAX) {
            setLocalDateFilter(filter); setOrdering(Ordering.DESC)
        }
        val minV = dMin.dataList.firstOrNull()?.value ?: return@read null
        val maxV = dMax.dataList.firstOrNull()?.value ?: return@read null
        // Use noon of today — daily aggregate; avoids displaying "just now"
        val ts = java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).plusHours(12).toInstant().toEpochMilli().toDouble()
        sample(((minV + maxV) / 2f).toDouble(), "bpm", ts)
    }

    @ReactMethod
    fun getLatestHrMin(promise: Promise) = read(promise) {
        val data = store.aggregate(DataType.HeartRateType.MIN) {
            setLocalDateFilter(localDateLast(7)); setOrdering(Ordering.DESC)
        }
        val v = data.dataList.firstOrNull()?.value ?: return@read null
        val ts = java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).plusHours(12).toInstant().toEpochMilli().toDouble()
        sample(v.toDouble(), "bpm", ts)
    }

    @ReactMethod
    fun getLatestHrMax(promise: Promise) = read(promise) {
        val data = store.aggregate(DataType.HeartRateType.MAX) {
            setLocalDateFilter(localDateLast(7)); setOrdering(Ordering.DESC)
        }
        val v = data.dataList.firstOrNull()?.value ?: return@read null
        val ts = java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).plusHours(12).toInstant().toEpochMilli().toDouble()
        sample(v.toDouble(), "bpm", ts)
    }

    // ── Blood Pressure, SpO2, Temperature, Glucose ─────────────────────────────
    // These use readData() which requires Samsung Health ≥ full build from Galaxy Store.
    // Older bundled builds (e.g. 6.31.3.013) may throw ClassNotFoundException — wrapped
    // in runCatching so the tile is simply absent rather than crashing the batch poll.

    @ReactMethod
    fun getLatestBloodPressure(promise: Promise) = read(promise) {
        runCatching {
            val req = DataTypes.BLOOD_PRESSURE.readDataRequestBuilder
                .setInstantTimeFilter(last24h()).setOrdering(Ordering.DESC).build()
            val dp = store.readData(req).dataList.filterIsInstance<HealthDataPoint>().firstOrNull()
            dp?.let {
                val ts = (it.endTime ?: it.startTime)?.toEpochMilli()?.toDouble()
                    ?: java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).plusHours(12).toInstant().toEpochMilli().toDouble()
                val sbp = it.getValue(DataType.BloodPressureType.SYSTOLIC) ?: return@let null
                sample(sbp.toDouble(), "mmHg", ts)
            }
        }.getOrNull()
    }

    @ReactMethod
    fun getLatestDiastolicBloodPressure(promise: Promise) = read(promise) {
        runCatching {
            val req = DataTypes.BLOOD_PRESSURE.readDataRequestBuilder
                .setInstantTimeFilter(last24h()).setOrdering(Ordering.DESC).build()
            val dp = store.readData(req).dataList.filterIsInstance<HealthDataPoint>().firstOrNull()
            dp?.let {
                val ts = (it.endTime ?: it.startTime)?.toEpochMilli()?.toDouble()
                    ?: java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).plusHours(12).toInstant().toEpochMilli().toDouble()
                val dbp = it.getValue(DataType.BloodPressureType.DIASTOLIC) ?: return@let null
                sample(dbp.toDouble(), "mmHg", ts)
            }
        }.getOrNull()
    }

    @ReactMethod
    fun getLatestSpo2(promise: Promise) = read(promise) {
        runCatching {
            val req = DataTypes.BLOOD_OXYGEN.readDataRequestBuilder
                .setInstantTimeFilter(last24h()).setOrdering(Ordering.DESC).build()
            val list = store.readData(req).dataList.filterIsInstance<OxygenSaturation>()
            list.firstOrNull()?.let { s ->
                val ts = (s.endTime ?: s.startTime)?.toEpochMilli()?.toDouble()
                    ?: java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).plusHours(12).toInstant().toEpochMilli().toDouble()
                sample(s.oxygenSaturation.toDouble(), "%", ts)
            }
        }.getOrNull()
    }

    @ReactMethod
    fun getLatestBodyTemperature(promise: Promise) = read(promise) {
        runCatching {
            val req = DataTypes.BODY_TEMPERATURE.readDataRequestBuilder
                .setInstantTimeFilter(last24h()).setOrdering(Ordering.DESC).build()
            val dp = store.readData(req).dataList.filterIsInstance<HealthDataPoint>().firstOrNull()
            dp?.let {
                val ts = (it.endTime ?: it.startTime)?.toEpochMilli()?.toDouble()
                    ?: java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).plusHours(12).toInstant().toEpochMilli().toDouble()
                val temp = it.getValue(DataType.BodyTemperatureType.BODY_TEMPERATURE) ?: return@let null
                sample(temp.toDouble(), "°C", ts)
            }
        }.getOrNull()
    }

    @ReactMethod
    fun getLatestGlucose(promise: Promise) = read(promise) {
        runCatching {
            val req = DataType.BloodGlucoseType().readDataRequestBuilder
                .setInstantTimeFilter(last24h()).setOrdering(Ordering.DESC).build()
            val list = store.readData(req).dataList.filterIsInstance<BloodGlucose>()
            list.firstOrNull()?.let { bg ->
                val ts = bg.timestamp?.toEpochMilli()?.toDouble()
                    ?: java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).plusHours(12).toInstant().toEpochMilli().toDouble()
                sample(bg.glucose.toDouble(), "mmol/L", ts)
            }
        }.getOrNull()
    }

    // ── Step Count (55411-3) — aggregate total for today ──────────────────────

    @ReactMethod
    fun getLatestStepCount(promise: Promise) = read(promise) {
        val todayStart = LocalDateTime.now().with(LocalTime.MIDNIGHT)
        val now = LocalDateTime.now()
        val data = store.aggregate(DataType.StepsType.TOTAL) {
            setLocalTimeFilter(LocalTimeFilter.of(todayStart, now))
        }
        val total = data.dataList.firstOrNull()?.value ?: return@read null
        val ts = java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli().toDouble()
        sample(total.toDouble(), "steps", ts)
    }

    @ReactMethod fun getLatestAfib(promise: Promise) =
        promise.reject("NO_DATA", "readData() not available — update Samsung Health from Galaxy Store")

    @ReactMethod fun getLatestSkinTemperature(promise: Promise) =
        promise.reject("NO_DATA", "readData() not available — update Samsung Health from Galaxy Store")

    @ReactMethod fun getLatestBodyWeight(promise: Promise) =
        promise.reject("NO_DATA", "readData() not available — update Samsung Health from Galaxy Store")

    @ReactMethod fun getLatestBmi(promise: Promise) =
        promise.reject("NO_DATA", "readData() not available — update Samsung Health from Galaxy Store")

    @ReactMethod fun getLatestBodyFat(promise: Promise) =
        promise.reject("NO_DATA", "readData() not available — update Samsung Health from Galaxy Store")

    // ── Sleep Duration (93832-4) — aggregate TOTAL_DURATION (no readData needed)
    // Uses LocalDateBuilder aggregate — works on all Samsung Health versions.

    @ReactMethod
    fun getLatestSleepDuration(promise: Promise) = read(promise) {
        // Extend to 7 days; avoid setOrdering which may be unsupported for SleepType aggregate.
        // dataList is ASC by default — lastOrNull picks the most recent non-zero entry.
        val data = store.aggregate(DataType.SleepType.TOTAL_DURATION) {
            setLocalDateFilter(localDateLast(7))
        }
        val entry = data.dataList.lastOrNull { it.value != null && it.value!!.toMinutes() > 0 }
            ?: return@read null
        // TOTAL_DURATION aggregate returns java.time.Duration — convert to decimal hours
        val dur = entry.value ?: return@read null
        val hours = dur.toMinutes() / 60.0
        // Use noon of today as representative timestamp for last night's sleep
        val ts = java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).plusHours(12).toInstant().toEpochMilli().toDouble()
        sample(hours, "hrs", ts)
    }

    // ── Floors Climbed (55426-1) — aggregate total for today ──────────────────

    @ReactMethod
    fun getLatestFloorsClimbed(promise: Promise) = read(promise) {
        // Try today first; if zero (e.g. early morning) fall back to last 7 days
        val todayStart = LocalDateTime.now().with(LocalTime.MIDNIGHT)
        val now        = LocalDateTime.now()
        val todayData  = store.aggregate(DataType.FloorsClimbedType.TOTAL) {
            setLocalTimeFilter(LocalTimeFilter.of(todayStart, now))
        }
        val todayTotal = todayData.dataList.firstOrNull()?.value
        if (todayTotal != null && todayTotal.toDouble() > 0.0) {
            val ts = java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli().toDouble()
            return@read sample(todayTotal.toDouble(), "floors", ts)
        }
        // No floors today — look at the last 7 days via LocalTimeFilter
        val weekStart = LocalDateTime.now().minusDays(7)
        val weekData = store.aggregate(DataType.FloorsClimbedType.TOTAL) {
            setLocalTimeFilter(LocalTimeFilter.of(weekStart, now))
        }
        val weekTotal = weekData.dataList.firstOrNull()?.value ?: return@read null
        val ts = java.time.LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli().toDouble()
        sample(weekTotal.toDouble(), "floors", ts)
    }

    // ── Metrics NOT in SDK 1.1.0 ───────────────────────────────────────────────

    @ReactMethod fun getLatestHrv(promise: Promise) =
        promise.reject("NO_DATA", "HRV not available in Samsung Health SDK 1.1.0")

    @ReactMethod fun getLatestRespirationRate(promise: Promise) =
        promise.reject("NO_DATA", "Respiration rate not available in Samsung Health SDK 1.1.0")

    // ── Historical backlog fetch ───────────────────────────────────────────────
    //
    // Returns all recorded data in [fromEpochMs, toEpochMs] for every supported
    // metric.  The TypeScript driver groups these by timestamp bucket and injects
    // them as backdated frames into Azure IoT Hub.
    //
    // Return shape (WritableMap):
    //   {
    //     "8867-4": [ {v: Float, ts: ms}, ... ],   // heart rate
    //     "8480-6": [ {v: Float, ts: ms}, ... ],   // SBP
    //     "8462-4": [ {v: Float, ts: ms}, ... ],   // DBP
    //     "59408-5": [ {v: Float, ts: ms}, ... ],  // SpO2
    //     "8310-5":  [ {v: Float, ts: ms}, ... ],  // body temp
    //     "2339-0":  [ {v: Float, ts: ms}, ... ],  // glucose
    //     "80358-0": [ {v: Float, ts: ms}, ... ],  // AFib
    //   }
    //   Steps are NOT in this result — they are daily aggregates and handled
    //   separately by getLatestStepCount() on reconnect.

    @ReactMethod
    fun fetchAllHistory(fromEpochMs: Double, toEpochMs: Double, promise: Promise) {
        scope.launch {
            try {
                val from = Instant.ofEpochMilli(fromEpochMs.toLong())
                val to   = Instant.ofEpochMilli(toEpochMs.toLong())
                val filter = InstantTimeFilter.of(from, to)
                val result = WritableNativeMap()

                // ── Heart Rate (aggregate day-by-day — readData() fails with 9003) ─
                runCatching {
                    val zone = ZoneId.systemDefault()
                    val arrAvg = Arguments.createArray()
                    val arrMin = Arguments.createArray()
                    val arrMax = Arguments.createArray()
                    var day = from.atZone(zone).toLocalDate()
                    val toDate = to.atZone(zone).toLocalDate()
                    while (!day.isAfter(toDate)) {
                        val dayFilter = LocalDateFilter.of(day, day.plusDays(1))
                        val dMin = store.aggregate(DataType.HeartRateType.MIN) { setLocalDateFilter(dayFilter) }
                        val dMax = store.aggregate(DataType.HeartRateType.MAX) { setLocalDateFilter(dayFilter) }
                        val minV = dMin.dataList.firstOrNull()?.value
                        val maxV = dMax.dataList.firstOrNull()?.value
                        if (minV != null && maxV != null) {
                            val ts = day.atStartOfDay(zone).plusHours(12).toInstant().toEpochMilli().toDouble()
                            arrMin.pushMap(Arguments.createMap().apply { putDouble("v", minV.toDouble()); putDouble("ts", ts) })
                            arrMax.pushMap(Arguments.createMap().apply { putDouble("v", maxV.toDouble()); putDouble("ts", ts) })
                            arrAvg.pushMap(Arguments.createMap().apply { putDouble("v", ((minV + maxV) / 2f).toDouble()); putDouble("ts", ts) })
                        }
                        day = day.plusDays(1)
                    }
                    if (arrAvg.size() > 0) { result.putArray("8867-4", arrAvg); result.putArray("8638-5", arrMin); result.putArray("8639-3", arrMax) }
                    Unit
                }.getOrNull()

                // ── Blood Pressure ──────────────────────────────────────────
                runCatching {
                    val req = DataTypes.BLOOD_PRESSURE.readDataRequestBuilder
                        .setInstantTimeFilter(filter).setOrdering(Ordering.ASC).build()
                    store.readData(req).dataList.filterIsInstance<HealthDataPoint>()
                }.getOrNull()?.also { list ->
                    val arrSbp = Arguments.createArray()
                    val arrDbp = Arguments.createArray()
                    for (dp in list) {
                        val ts = (dp.endTime ?: dp.startTime)?.toEpochMilli() ?: continue
                        val sbp = dp.getValue(DataType.BloodPressureType.SYSTOLIC) ?: continue
                        val dbp = dp.getValue(DataType.BloodPressureType.DIASTOLIC) ?: continue
                        arrSbp.pushMap(Arguments.createMap().apply { putDouble("v", sbp.toDouble()); putDouble("ts", ts.toDouble()) })
                        arrDbp.pushMap(Arguments.createMap().apply { putDouble("v", dbp.toDouble()); putDouble("ts", ts.toDouble()) })
                    }
                    result.putArray("8480-6", arrSbp)
                    result.putArray("8462-4", arrDbp)
                }

                // ── SpO2 ────────────────────────────────────────────────────
                runCatching {
                    val req = DataTypes.BLOOD_OXYGEN.readDataRequestBuilder
                        .setInstantTimeFilter(filter).setOrdering(Ordering.ASC).build()
                    store.readData(req).dataList.filterIsInstance<OxygenSaturation>()
                }.getOrNull()?.also { list ->
                    val arr = Arguments.createArray()
                    for (s in list) {
                        val ts = (s.endTime ?: s.startTime)?.toEpochMilli() ?: continue
                        arr.pushMap(Arguments.createMap().apply { putDouble("v", s.oxygenSaturation.toDouble()); putDouble("ts", ts.toDouble()) })
                    }
                    result.putArray("59408-5", arr)
                }

                // ── Body Temperature ────────────────────────────────────────
                runCatching {
                    val req = DataTypes.BODY_TEMPERATURE.readDataRequestBuilder
                        .setInstantTimeFilter(filter).setOrdering(Ordering.ASC).build()
                    store.readData(req).dataList.filterIsInstance<HealthDataPoint>()
                }.getOrNull()?.also { list ->
                    val arr = Arguments.createArray()
                    for (dp in list) {
                        val ts = (dp.endTime ?: dp.startTime)?.toEpochMilli() ?: continue
                        val temp = dp.getValue(DataType.BodyTemperatureType.BODY_TEMPERATURE) ?: continue
                        arr.pushMap(Arguments.createMap().apply { putDouble("v", temp.toDouble()); putDouble("ts", ts.toDouble()) })
                    }
                    result.putArray("8310-5", arr)
                }

                // ── Blood Glucose ────────────────────────────────────────────
                runCatching {
                    val req = DataType.BloodGlucoseType().readDataRequestBuilder
                        .setInstantTimeFilter(filter).setOrdering(Ordering.ASC).build()
                    store.readData(req).dataList.filterIsInstance<BloodGlucose>()
                }.getOrNull()?.also { list ->
                    val arr = Arguments.createArray()
                    for (bg in list) {
                        val ts = bg.timestamp?.toEpochMilli() ?: continue
                        arr.pushMap(Arguments.createMap().apply { putDouble("v", bg.glucose.toDouble()); putDouble("ts", ts.toDouble()) })
                    }
                    result.putArray("2339-0", arr)
                }

                // ── AFib ─────────────────────────────────────────────────────
                runCatching {
                    val req = DataType.IrregularHeartRhythmNotificationType().readDataRequestBuilder
                        .setInstantTimeFilter(filter).setOrdering(Ordering.ASC).build()
                    store.readData(req).dataList.filterIsInstance<HealthDataPoint>()
                }.getOrNull()?.also { list ->
                    val arr = Arguments.createArray()
                    for (dp in list) {
                        val ts = (dp.endTime ?: dp.startTime)?.toEpochMilli() ?: continue
                        val status = dp.getValue(DataType.IrregularHeartRhythmNotificationType.STATUS)
                        val v = if (status?.name == "DETECTED") 1.0 else 0.0
                        arr.pushMap(Arguments.createMap().apply { putDouble("v", v); putDouble("ts", ts.toDouble()) })
                    }
                    result.putArray("80358-0", arr)
                }

                // ── Daily Steps (55423-8) ─────────────────────────────────────────────
                // Steps are a daily aggregate (not an instant reading), so we iterate
                // day by day between [from, to] and call aggregate() for each day.
                runCatching {
                    val zone = ZoneId.systemDefault()
                    val arr  = Arguments.createArray()
                    var dayStart = from.atZone(zone).toLocalDate().atStartOfDay()
                    val toLocal  = to.atZone(zone).toLocalDateTime()
                    while (dayStart.isBefore(toLocal)) {
                        val dayEnd = dayStart.plusDays(1)
                        val data = store.aggregate(DataType.StepsType.TOTAL) {
                            setLocalTimeFilter(LocalTimeFilter.of(dayStart, dayEnd))
                        }
                        val total = data.dataList.firstOrNull()?.value
                        if (total != null && total > 0) {
                            val midTs = dayStart.plusHours(12)
                                .atZone(zone).toInstant().toEpochMilli()
                            arr.pushMap(Arguments.createMap().apply {
                                putDouble("v", total.toDouble())
                                putDouble("ts", midTs.toDouble())
                            })
                        }
                        dayStart = dayEnd
                    }
                    if (arr.size() > 0) result.putArray("55423-8", arr)
                }.getOrNull()

                promise.resolve(result)
            } catch (e: Throwable) {
                promise.reject("HISTORY_ERROR", e.message ?: "Unknown error")
            }
        }
    }
}
