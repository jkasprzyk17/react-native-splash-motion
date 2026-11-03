package com.margelo.nitro.splashmotion.players

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.content.Context
import android.view.View
import com.airbnb.lottie.AsyncUpdates
import com.airbnb.lottie.LottieAnimationView
import com.airbnb.lottie.LottieDrawable
import com.margelo.nitro.splashmotion.SplashConfig
import com.margelo.nitro.splashmotion.SplashPlayer
import java.io.ByteArrayInputStream
import kotlin.math.abs

internal class LottieSplashPlayer(context: Context) : SplashPlayer {
  private val lottie = LottieAnimationView(context).apply {
    // Render frames off the main thread so React Native's startup work
    // can't make the animation stutter.
    asyncUpdates = AsyncUpdates.ENABLED
  }

  override val view: View get() = lottie

  override fun load(bytes: ByteArray, config: SplashConfig, onReady: () -> Unit) {
    lottie.addLottieOnCompositionLoadedListener { composition ->
      config.loopMarker?.let { marker ->
        if (composition.getMarker(marker) != null) lottie.setMinAndMaxFrame(marker)
      }
      lottie.repeatCount = if (config.loop) LottieDrawable.INFINITE else 0
      lottie.playAnimation()
      onReady()
    }
    lottie.setAnimation(ByteArrayInputStream(bytes), "splashmotion")
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
}
