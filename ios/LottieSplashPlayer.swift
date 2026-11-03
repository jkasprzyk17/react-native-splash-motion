import Lottie
import UIKit

final class LottieSplashPlayer: SplashPlayer {
  private let animationView: LottieAnimationView
  private let animation: LottieAnimation
  private let config: SplashMotionConfig

  var view: UIView { animationView }

  init?(data: Data, config: SplashMotionConfig) {
    guard let animation = try? JSONDecoder().decode(LottieAnimation.self, from: data) else {
      NSLog("[SplashMotion] Could not decode the Lottie animation.")
      return nil
    }
    self.animation = animation
    self.config = config
    // The Core Animation engine renders on the system render server,
    // so the animation stays smooth even while React Native boots.
    animationView = LottieAnimationView(
      animation: animation,
      configuration: LottieConfiguration(renderingEngine: .automatic)
    )
    animationView.contentMode = .scaleAspectFit
    animationView.backgroundBehavior = .pauseAndRestore
    animationView.backgroundColor = .clear
  }

  private func range(of marker: String) -> (start: AnimationFrameTime, end: AnimationFrameTime)? {
    guard let start = animation.frameTime(forMarker: marker) else { return nil }
    let duration = animation.durationFrameTime(forMarker: marker) ?? 0
    return (start, start + duration)
  }

  func play() {
    if let marker = config.loopMarker, let loop = range(of: marker) {
      animationView.play(fromFrame: loop.start, toFrame: loop.end, loopMode: .loop)
    } else {
      animationView.loopMode = (config.loop ?? true) ? .loop : .playOnce
      animationView.play()
    }
  }

  func remainingLoopTime() -> TimeInterval {
    guard animationView.isAnimationPlaying else { return 0 }
    let end = config.loopMarker.flatMap { range(of: $0)?.end } ?? animation.endFrame
    let framesLeft = max(0, Double(end - animationView.realtimeAnimationFrame))
    let speed = max(0.01, Double(abs(animationView.animationSpeed)))
    return framesLeft / animation.framerate / speed
  }

  func playOutro(_ name: String, completion: @escaping () -> Void) -> Bool {
    guard let outro = range(of: name) else { return false }
    animationView.play(fromFrame: outro.start, toFrame: outro.end, loopMode: .playOnce) { _ in
      completion()
    }
    return true
  }

  func stop() {
    animationView.stop()
  }
}
