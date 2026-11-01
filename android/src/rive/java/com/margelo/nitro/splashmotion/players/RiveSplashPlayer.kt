package com.margelo.nitro.splashmotion.players

import android.content.Context
import android.view.View
import app.rive.runtime.kotlin.RiveAnimationView
import app.rive.runtime.kotlin.core.Rive
import com.margelo.nitro.splashmotion.SplashConfig
import com.margelo.nitro.splashmotion.SplashPlayer

internal class RiveSplashPlayer(context: Context) : SplashPlayer {
  init {
    Rive.init(context.applicationContext)
  }

  // Rive renders on its own thread, independent of the UI thread.
  private val rive = RiveAnimationView(context)
  private var stateMachine = "State Machine 1"

  override val view: View get() = rive

  override fun load(bytes: ByteArray, config: SplashConfig, onReady: () -> Unit) {
    config.stateMachine?.let { stateMachine = it }
    rive.setRiveBytes(
      bytes,
      artboardName = config.artboard,
      stateMachineName = stateMachine,
      autoplay = true,
    )
    onReady()
  }

  // State machines drive their own timing — nothing to wait for.
  override fun remainingLoopMs(): Long = 0

  override fun playOutro(name: String, durationMs: Long, onEnd: () -> Unit): Boolean {
    rive.fireState(stateMachine, name)
    rive.postDelayed({ onEnd() }, durationMs)
    return true
  }

  override fun setNumber(name: String, value: Double) {
    rive.setNumberState(stateMachine, name, value.toFloat())
  }

  override fun setBoolean(name: String, value: Boolean) {
    rive.setBooleanState(stateMachine, name, value)
  }

  override fun trigger(name: String) {
    rive.fireState(stateMachine, name)
  }

  override fun stop() {
    rive.stop()
  }
}
