package com.vxtmobile

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers VXT native modules with the React Native bridge.
 * Add this to MainApplication.kt / getPackages().
 */
class VxtPackage : ReactPackage {

    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(
            SamsungHealthModule(ctx),
            HealthConnectModule(ctx),
        )

    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
