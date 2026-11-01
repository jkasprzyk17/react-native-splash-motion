package com.margelo.nitro.splashmotion

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

/**
 * Owns the native overlay. The system splash stays on screen until the
 * overlay's first frame is ready, so the hand-off is seamless.
 */
internal object SplashMotionController {
  private const val TAG = "SplashMotion"
  private val main = Handler(Looper.getMainLooper())

  @Volatile private var visible = false
  @Volatile private var overlayReady = false

  // Main-thread state
  private var installed = false
  private var overlay: FrameLayout? = null
  private var player: SplashPlayer? = null
  private var shownAt = 0L
  private var hiding = false
  private val pending = mutableListOf<() -> Unit>()

  fun isVisible() = visible

  // region Showing

  fun install(activity: Activity) {
    if (installed) return
    installed = true

    val splash = activity.installSplashScreen()
    val config = SplashConfig.load(activity)
    if (config == null) {
      Log.w(TAG, "No config found. Run `npx splash-motion generate <file>` and rebuild.")
      return
    }

    visible = true
    shownAt = SystemClock.uptimeMillis()
    splash.setKeepOnScreenCondition { !overlayReady }
    splash.setOnExitAnimationListener { it.remove() }

    // Runs right after onCreate(), once React Native has set its content view.
    main.post { attachOverlay(activity, config) }
    // Safety net: never block the launch if the animation fails to load.
    main.postDelayed({ overlayReady = true }, 1500)
  }

  private fun attachOverlay(activity: Activity, config: SplashConfig) {
    val bytes = try {
      activity.assets.open("splashmotion/${config.file}").use { it.readBytes() }
    } catch (e: Exception) {
      Log.e(TAG, "Could not read the animation file.", e)
      return abort()
    }
    val player = createPlayer(activity, config.type) ?: return abort()

    val density = activity.resources.displayMetrics.density
    val overlay = FrameLayout(activity).apply {
      setBackgroundColor(activity.getColor(R.color.splashmotion_background))
      isClickable = true // swallow touches while visible
      isFocusable = true
      translationZ = 10_000f
    }
    overlay.addView(
      player.view,
      FrameLayout.LayoutParams(
        (config.width * density).toInt(),
        (config.height * density).toInt(),
        Gravity.CENTER,
      ),
    )
    (activity.window.decorView as ViewGroup).addView(
      overlay,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )

    this.overlay = overlay
    this.player = player
    player.load(bytes, config) { overlayReady = true }
  }

  private fun abort() {
    overlayReady = true
    visible = false
  }

  private fun createPlayer(context: Context, type: String): SplashPlayer? {
    val className = if (type == "rive") {
      "com.margelo.nitro.splashmotion.players.RiveSplashPlayer"
    } else {
      "com.margelo.nitro.splashmotion.players.LottieSplashPlayer"
    }
    return try {
      Class.forName(className).getConstructor(Context::class.java).newInstance(context) as SplashPlayer
    } catch (e: Throwable) {
      Log.e(TAG, "The $type renderer isn't compiled in. Rebuild the app after `npx splash-motion generate`.", e)
      null
    }
  }

  // endregion

  // region Hiding

  fun hide(
    fade: Long,
    minDuration: Long,
    waitForLoop: Boolean,
    outro: String?,
    outroDuration: Long,
    done: () -> Unit,
  ) {
    main.post {
      if (overlay == null) {
        visible = false
        done()
        return@post
      }
      pending += done
      if (hiding) return@post
      hiding = true

      val elapsed = SystemClock.uptimeMillis() - shownAt
      main.postDelayed(
        { runExit(fade, waitForLoop, outro, outroDuration) },
        (minDuration - elapsed).coerceAtLeast(0),
      )
    }
  }

  private fun runExit(fade: Long, waitForLoop: Boolean, outro: String?, outroDuration: Long) {
    val player = this.player ?: return dismiss(fade)
    val afterLoop = Runnable {
      val playing = outro != null && player.playOutro(outro, outroDuration) { dismiss(fade) }
      if (!playing) dismiss(fade)
    }
    if (waitForLoop) {
      main.postDelayed(afterLoop, player.remainingLoopMs().coerceIn(0, 5_000))
    } else {
      afterLoop.run()
    }
  }

  private fun dismiss(fade: Long) {
    val overlay = this.overlay ?: return flush()
    val finish = Runnable {
      (overlay.parent as? ViewGroup)?.removeView(overlay)
      player?.stop()
      player = null
      this.overlay = null
      visible = false
      flush()
    }
    if (fade > 0) {
      overlay.animate().alpha(0f).setDuration(fade).withEndAction(finish).start()
    } else {
      finish.run()
    }
  }

  private fun flush() {
    val callbacks = pending.toList()
    pending.clear()
    hiding = false
    callbacks.forEach { it() }
  }

  // endregion

  // region Inputs

  fun setNumber(name: String, value: Double) = main.post { player?.setNumber(name, value) }

  fun setBoolean(name: String, value: Boolean) = main.post { player?.setBoolean(name, value) }

  fun trigger(name: String) = main.post { player?.trigger(name) }

  // endregion
}
