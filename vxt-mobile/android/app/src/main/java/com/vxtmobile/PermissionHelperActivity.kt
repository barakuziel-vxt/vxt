package com.vxtmobile

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyTemperatureRecord
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.BodyFatRecord
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

/**
 * Transparent trampoline activity that hosts the Health Connect permission dialog.
 *
 * MainActivity uses singleTask launchMode, which causes startActivityForResult to
 * deliver RESULT_CANCELED immediately on Android 11+. By using a separate standard
 * launchMode activity, registerForActivityResult works correctly.
 *
 * Usage:
 *   PermissionHelperActivity.onResult = { granted -> ... }
 *   startActivity(Intent(context, PermissionHelperActivity::class.java))
 */
class PermissionHelperActivity : ComponentActivity() {

    companion object {
        private const val TAG = "PermissionHelperActivity"

        /** Shared permission set — same as HealthConnectModule.
         *  In Health Connect SDK 1.1.0-alpha07+ getReadPermission returns String */
        val PERMISSIONS: Set<String> = setOf(
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
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(Vo2MaxRecord::class),
            HealthPermission.getReadPermission(WeightRecord::class),
            HealthPermission.getReadPermission(BodyFatRecord::class),
        )

        /** Set by HealthConnectModule before starting this activity */
        @Volatile var onResult: ((Boolean) -> Unit)? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // If the activity was recreated after being killed, just finish —
        // the user already saw the dialog in the previous instance.
        if (savedInstanceState != null) {
            Log.d(TAG, "Recreated after kill, finishing without dialog")
            notifyResult(false)
            return
        }

        val contract = PermissionController.createRequestPermissionResultContract()
        val launcher = registerForActivityResult(contract) { grantedStrings: Set<String> ->
            val allGranted = PERMISSIONS.all { it in grantedStrings }
            Log.d(TAG, "HC permission result: ${grantedStrings.size} granted, all=$allGranted")
            notifyResult(allGranted)
        }

        Log.d(TAG, "Launching HC permission dialog")
        launcher.launch(PERMISSIONS)
    }

    override fun onDestroy() {
        super.onDestroy()
        // User pressed Back without granting
        if (onResult != null) {
            Log.d(TAG, "Destroyed without result (back pressed?), resolving false")
            notifyResult(false)
        }
    }

    private fun notifyResult(granted: Boolean) {
        onResult?.invoke(granted)
        onResult = null
        finish()
    }
}
