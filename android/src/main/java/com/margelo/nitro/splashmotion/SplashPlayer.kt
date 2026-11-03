package com.margelo.nitro.splashmotion

import android.view.View

/** A renderer that plays the splash animation natively. Implemented by `LottieSplashPlayer`. */
internal interface SplashPlayer {
  val view: View
  fun load(bytes: ByteArray, config: SplashConfig, onReady: () -> Unit)
  /** Milliseconds left before the current loop ends (0 if not looping). */
  fun remainingLoopMs(): Long
  /** Plays the outro marker. Returns `false` if this animation has no such marker. */
  fun playOutro(name: String, onEnd: () -> Unit): Boolean
  fun stop()
}
