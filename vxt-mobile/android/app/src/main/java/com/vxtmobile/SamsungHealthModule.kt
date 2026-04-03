package com.vxtmobile

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.bridge.WritableNativeMap
import com.samsung.android.sdk.health.data.HealthDataService
import com.samsung.android.sdk.health.data.HealthDataStore
import com.samsung.android.sdk.health.data.data.HealthDataPoint
import com.samsung.android.sdk.health.data.data.entries.BloodGlucose
import com.samsung.android.sdk.health.data.data.entries.HeartRate
import com.samsung.android.sdk.health.data.data.entries.OxygenSaturation
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
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.ChronoUnit

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
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
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
        )
        // requestPermissions must run on the Main thread (shows Samsung Health dialog)
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val granted = store.requestPermissions(permissions, activity)
                promise.resolve(granted.isNotEmpty())
            } catch (e: Exception) {
                promise.reject("PERMISSION_ERROR", e.message, e)
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
        InstantTimeFilter.since(Instant.now().minus(24, ChronoUnit.HOURS))

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
                if (result != null) promise.resolve(result)
                else promise.reject("NO_DATA", "No recent reading available")
            } catch (e: Exception) {
                promise.reject("READ_ERROR", e.message ?: "Unknown error", e)
            }
        }
    }

    // ── Heart Rate (8867-4 / 8638-5 / 8639-3) ─────────────────────────────────
    // HeartRate entry has heartRate (mean), min, max for the measurement interval.

    @ReactMethod
    fun getLatestHeartRate(promise: Promise) = read(promise) {
        val request = DataTypes.HEART_RATE.readDataRequestBuilder
            .setInstantTimeFilter(last24h())
            .setOrdering(Ordering.DESC)
            .setLimit(1)
            .build()
        val data = store.readData(request)
        val hr = data.dataList.filterIsInstance<HeartRate>().firstOrNull() ?: return@read null
        val ts = (hr.endTime ?: hr.startTime)?.toEpochMilli()?.toDouble() ?: System.currentTimeMillis().toDouble()
        sample(hr.heartRate.toDouble(), "bpm", ts)
    }

    @ReactMethod
    fun getLatestHrMin(promise: Promise) = read(promise) {
        val request = DataTypes.HEART_RATE.readDataRequestBuilder
            .setInstantTimeFilter(last24h())
            .setOrdering(Ordering.DESC)
            .setLimit(1)
            .build()
        val data = store.readData(request)
        val hr = data.dataList.filterIsInstance<HeartRate>().firstOrNull() ?: return@read null
        val ts = (hr.endTime ?: hr.startTime)?.toEpochMilli()?.toDouble() ?: System.currentTimeMillis().toDouble()
        sample(hr.min.toDouble(), "bpm", ts)
    }

    @ReactMethod
    fun getLatestHrMax(promise: Promise) = read(promise) {
        val request = DataTypes.HEART_RATE.readDataRequestBuilder
            .setInstantTimeFilter(last24h())
            .setOrdering(Ordering.DESC)
            .setLimit(1)
            .build()
        val data = store.readData(request)
        val hr = data.dataList.filterIsInstance<HeartRate>().firstOrNull() ?: return@read null
        val ts = (hr.endTime ?: hr.startTime)?.toEpochMilli()?.toDouble() ?: System.currentTimeMillis().toDouble()
        sample(hr.max.toDouble(), "bpm", ts)
    }

    // ── Blood Pressure (8480-6 SBP / 8462-4 DBP) ──────────────────────────────

    @ReactMethod
    fun getLatestBloodPressure(promise: Promise) = read(promise) {
        val request = DataTypes.BLOOD_PRESSURE.readDataRequestBuilder
            .setInstantTimeFilter(last24h())
            .setOrdering(Ordering.DESC)
            .setLimit(1)
            .build()
        val data = store.readData(request)
        val dp = data.dataList.filterIsInstance<HealthDataPoint>().firstOrNull() ?: return@read null
        val sbp = dp.getValue(DataType.BloodPressureType.SYSTOLIC) ?: return@read null
        val ts = (dp.endTime ?: dp.startTime)?.toEpochMilli()?.toDouble() ?: System.currentTimeMillis().toDouble()
        sample(sbp.toDouble(), "mmHg", ts)
    }

    @ReactMethod
    fun getLatestDiastolicBloodPressure(promise: Promise) = read(promise) {
        val request = DataTypes.BLOOD_PRESSURE.readDataRequestBuilder
            .setInstantTimeFilter(last24h())
            .setOrdering(Ordering.DESC)
            .setLimit(1)
            .build()
        val data = store.readData(request)
        val dp = data.dataList.filterIsInstance<HealthDataPoint>().firstOrNull() ?: return@read null
        val dbp = dp.getValue(DataType.BloodPressureType.DIASTOLIC) ?: return@read null
        val ts = (dp.endTime ?: dp.startTime)?.toEpochMilli()?.toDouble() ?: System.currentTimeMillis().toDouble()
        sample(dbp.toDouble(), "mmHg", ts)
    }

    // ── SpO2 / Blood Oxygen (59408-5) ──────────────────────────────────────────

    @ReactMethod
    fun getLatestSpo2(promise: Promise) = read(promise) {
        val request = DataTypes.BLOOD_OXYGEN.readDataRequestBuilder
            .setInstantTimeFilter(last24h())
            .setOrdering(Ordering.DESC)
            .setLimit(1)
            .build()
        val data = store.readData(request)
        val spo2 = data.dataList.filterIsInstance<OxygenSaturation>().firstOrNull() ?: return@read null
        val ts = (spo2.endTime ?: spo2.startTime)?.toEpochMilli()?.toDouble() ?: System.currentTimeMillis().toDouble()
        sample(spo2.oxygenSaturation.toDouble(), "%", ts)
    }

    // ── Body Temperature (8310-5) ──────────────────────────────────────────────

    @ReactMethod
    fun getLatestBodyTemperature(promise: Promise) = read(promise) {
        val request = DataTypes.BODY_TEMPERATURE.readDataRequestBuilder
            .setInstantTimeFilter(last24h())
            .setOrdering(Ordering.DESC)
            .setLimit(1)
            .build()
        val data = store.readData(request)
        val dp = data.dataList.filterIsInstance<HealthDataPoint>().firstOrNull() ?: return@read null
        val temp = dp.getValue(DataType.BodyTemperatureType.BODY_TEMPERATURE) ?: return@read null
        val ts = (dp.endTime ?: dp.startTime)?.toEpochMilli()?.toDouble() ?: System.currentTimeMillis().toDouble()
        sample(temp.toDouble(), "Cel", ts)
    }

    // ── Blood Glucose (2339-0) ─────────────────────────────────────────────────

    @ReactMethod
    fun getLatestGlucose(promise: Promise) = read(promise) {
        val request = DataType.BloodGlucoseType().readDataRequestBuilder
            .setInstantTimeFilter(last24h())
            .setOrdering(Ordering.DESC)
            .setLimit(1)
            .build()
        val data = store.readData(request)
        val bg = data.dataList.filterIsInstance<BloodGlucose>().firstOrNull() ?: return@read null
        val ts = bg.timestamp?.toEpochMilli()?.toDouble() ?: System.currentTimeMillis().toDouble()
        sample(bg.glucose.toDouble(), "mg/dL", ts)
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
        sample(total.toDouble(), "steps", Instant.now().toEpochMilli().toDouble())
    }

    // ── AFib / Irregular Heart Rhythm (80358-0) ────────────────────────────────
    // STATUS enum: DETECTED → 1.0, anything else → 0.0

    @ReactMethod
    fun getLatestAfib(promise: Promise) = read(promise) {
        val request = DataType.IrregularHeartRhythmNotificationType().readDataRequestBuilder
            .setInstantTimeFilter(last24h())
            .setOrdering(Ordering.DESC)
            .setLimit(1)
            .build()
        val data = store.readData(request)
        val dp = data.dataList.filterIsInstance<HealthDataPoint>().firstOrNull() ?: return@read null
        val status = dp.getValue(DataType.IrregularHeartRhythmNotificationType.STATUS)
        val afibValue = if (status?.name == "DETECTED") 1.0 else 0.0
        val ts = (dp.endTime ?: dp.startTime)?.toEpochMilli()?.toDouble() ?: System.currentTimeMillis().toDouble()
        sample(afibValue, "1", ts)
    }

    // ── Metrics NOT in SDK 1.1.0 — return null (skipped by delta filter) ──────

    @ReactMethod fun getLatestAvgGlucose(promise: Promise) =
        promise.reject("NO_DATA", "Average glucose not available in Samsung Health SDK 1.1.0")

    @ReactMethod fun getLatestRestingHeartRate(promise: Promise) =
        promise.reject("NO_DATA", "Resting heart rate not available in Samsung Health SDK 1.1.0")

    @ReactMethod fun getLatestHrv(promise: Promise) =
        promise.reject("NO_DATA", "HRV not available in Samsung Health SDK 1.1.0")

    @ReactMethod fun getLatestRespirationRate(promise: Promise) =
        promise.reject("NO_DATA", "Respiration rate not available in Samsung Health SDK 1.1.0")
}
