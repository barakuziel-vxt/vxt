package com.vxtmobile

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.bridge.WritableNativeMap

/**
 * SamsungHealthModule — STUB
 *
 * Samsung Health SDK is not bundled yet (requires AAR from Samsung Developer portal).
 * All health-read methods return null so the app compiles and runs without the SDK.
 * When the AAR is available, drop it in android/app/libs/ and restore full implementation.
 */
class SamsungHealthModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SamsungHealthModule"

    private var collectingData = false

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        // Stub: grant permissions so the gateway can start without the real SDK
        promise.resolve(true)
    }

    @ReactMethod
    fun isAvailable(promise: Promise) {
        // Stub: report available so the driver initialises
        promise.resolve(true)
    }

    @ReactMethod
    fun startDataCollection(promise: Promise) {
        if (collectingData) { promise.resolve(null); return }
        val intent = Intent(reactContext, GatewayForegroundService::class.java)
            .setAction(GatewayForegroundService.ACTION_START)
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

    // ── Stub metric reads — realistic mock values so frames flow end-to-end ──
    // Replace with real Samsung Health SDK calls once the AAR is available.

    private fun mockSample(value: Double, unit: String): WritableMap =
        WritableNativeMap().apply {
            putDouble("timestamp", System.currentTimeMillis().toDouble())
            putDouble("value", value)
            putString("unit", unit)
            putString("deviceId", "SW5-stub")
        }

    @ReactMethod fun getLatestHeartRate(promise: Promise) =
        promise.resolve(mockSample(72.0 + (Math.random() * 10 - 5), "bpm"))

    @ReactMethod fun getLatestBloodPressure(promise: Promise) =
        promise.resolve(mockSample(118.0 + (Math.random() * 6 - 3), "mmHg"))

    @ReactMethod fun getLatestStepCount(promise: Promise) =
        promise.resolve(mockSample((3000 + Math.random() * 500).toLong().toDouble(), "steps"))

    @ReactMethod fun getLatestSpo2(promise: Promise) =
        promise.resolve(mockSample(97.0 + (Math.random() * 2), "%"))

    @ReactMethod fun getLatestBodyTemperature(promise: Promise) =
        promise.resolve(mockSample(36.6 + (Math.random() * 0.4 - 0.2), "Cel"))

    @ReactMethod fun getLatestGlucose(promise: Promise) =
        promise.resolve(mockSample(92.0 + (Math.random() * 10 - 5), "mg/dL"))
}
