package com.chessresultsnotifier.bridge

import com.facebook.fbreact.specs.NativeMonitoringSpec
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class MonitoringPackage : BaseReactPackage() {

    override fun getModule(
        name: String, reactContext: ReactApplicationContext
    ): NativeModule? = if (name == NativeMonitoringSpec.NAME) {
        MonitoringModule(reactContext)
    } else {
        null
    }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            NativeMonitoringSpec.NAME to ReactModuleInfo(
                NativeMonitoringSpec.NAME,
                MonitoringModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                true, // isTurboModule
            )
        )
    }
}
