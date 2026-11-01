package com.margelo.nitro.splashmotion

import android.view.View

/**
 * A renderer that plays the splash animation natively. Implementations live in
 * `src/lottie` and `src/rive` — only the one your app uses gets compiled in.
 */
internal interface SplashPlayer {
  val view: View
  fun load(bytes: ByteArray, config: SplashConfig, onReady: () -> Unit)
  /** Milliseconds left before the current loop ends (0 if not looping). */
  fun remainingLoopMs(): Long
  /** Plays the outro. Returns `false` if this animation has no such outro. */
  fun playOutro(name: String, durationMs: Long, onEnd: () -> Unit): Boolean
  fun setNumber(name: String, value: Double) {}
  fun setBoolean(name: String, value: Boolean) {}
  fun trigger(name: String) {}
  fun stop()
}
