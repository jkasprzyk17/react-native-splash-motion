package com.margelo.nitro.splashmotion

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise

/** Nitro HybridObject backing the JS `SplashMotion` API. */
@DoNotStrip
class HybridSplashMotion : HybridSplashMotionModuleSpec() {
  override fun hide(config: HideConfig): Promise<Unit> {
    val promise = Promise<Unit>()
    SplashMotionController.hide(
      fade = (config.fade ?: 220.0).toLong(),
      minDuration = (config.minDuration ?: 0.0).toLong(),
      waitForLoop = config.waitForLoop ?: true,
      outro = config.outro,
      outroDuration = (config.outroDuration ?: 600.0).toLong(),
    ) { promise.resolve(Unit) }
    return promise
  }

  override fun isVisible(): Boolean = SplashMotionController.isVisible()

  override fun setNumber(name: String, value: Double) {
    SplashMotionController.setNumber(name, value)
  }

  override fun setBoolean(name: String, value: Boolean) {
    SplashMotionController.setBoolean(name, value)
  }

  override fun trigger(name: String) {
    SplashMotionController.trigger(name)
  }
}
