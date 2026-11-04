package com.margelo.nitro.splashmotion.players

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.content.Context
import android.util.Log
import android.view.View
import com.airbnb.lottie.AsyncUpdates
import com.airbnb.lottie.LottieAnimationView
import com.airbnb.lottie.LottieCompositionFactory
import com.airbnb.lottie.LottieDrawable
import com.margelo.nitro.splashmotion.SplashConfig
import com.margelo.nitro.splashmotion.SplashPlayer
import java.io.ByteArrayInputStream
import kotlin.math.abs

internal class LottieSplashPlayer(context: Context) : SplashPlayer {
  // Frames are rendered synchronously: with async updates the first frames
  // after the launch-screen still are drawn empty.
  private val lottie = LottieAnimationView(context).apply {
    asyncUpdates = AsyncUpdates.DISABLED
  }

  override val view: View get() = lottie

  override fun load(bytes: ByteArray, config: SplashConfig, onReady: () -> Unit) {
    // Synchronous on purpose: usually a cache hit thanks to preload(). The async
    // API would deliver the result through the main thread's queue, behind
    // React Native's startup work, leaving the overlay empty for a while.
    val result = LottieCompositionFactory.fromJsonInputStreamSync(ByteArrayInputStream(bytes), CACHE_KEY)
    val composition = result.value
    if (composition == null) {
      Log.e("SplashMotion", "Could not parse the Lottie animation.", result.exception)
      return onReady()
    }
    lottie.setComposition(composition)
    config.loopMarker?.let { marker ->
      if (composition.getMarker(marker) != null) lottie.setMinAndMaxFrame(marker)
    }
    lottie.repeatCount = if (config.loop) LottieDrawable.INFINITE else 0
    // Hold the first frame (it matches the launch-screen still) until play().
    lottie.frame = lottie.minFrame.toInt()
    onReady()
  }

  override fun play() {
    if (lottie.composition != null && !lottie.isAnimating) lottie.playAnimation()
  }

  override fun remainingLoopMs(): Long {
    val composition = lottie.composition ?: return 0
    if (!lottie.isAnimating) return 0
    val framesLeft = (lottie.maxFrame - lottie.frame).coerceAtLeast(0f)
    val speed = abs(lottie.speed).coerceAtLeast(0.01f)
    return (framesLeft / composition.frameRate * 1000f / speed).toLong()
  }

  override fun playOutro(name: String, onEnd: () -> Unit): Boolean {
    val composition = lottie.composition ?: return false
    composition.getMarker(name) ?: return false

    lottie.removeAllAnimatorListeners()
    lottie.repeatCount = 0
    lottie.setMinAndMaxFrame(name)
    var finished = false
    lottie.addAnimatorListener(object : AnimatorListenerAdapter() {
      override fun onAnimationEnd(animation: Animator) {
        if (finished) return
        finished = true
        lottie.removeAllAnimatorListeners()
        onEnd()
      }
    })
    lottie.playAnimation()
    return true
  }

  override fun stop() {
    lottie.removeAllAnimatorListeners()
    lottie.cancelAnimation()
  }

  companion object {
    private const val CACHE_KEY = "splashmotion"

    /** Starts parsing in the background; load() then picks the result up from Lottie's cache. */
    fun preload(bytes: ByteArray) {
      LottieCompositionFactory.fromJsonInputStream(ByteArrayInputStream(bytes), CACHE_KEY)
    }
  }
}
