import UIKit

/// A renderer that can play the splash animation natively.
/// Implemented by `LottieSplashPlayer`.
protocol SplashPlayer: AnyObject {
  var view: UIView { get }
  func play()
  /// Seconds left before the current loop ends (0 if not looping).
  func remainingLoopTime() -> TimeInterval
  /// Plays the outro marker. Returns `false` if this animation has no such marker.
  func playOutro(_ name: String, completion: @escaping () -> Void) -> Bool
  func stop()
}
