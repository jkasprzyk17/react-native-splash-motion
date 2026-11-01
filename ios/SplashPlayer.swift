import UIKit

/// A renderer that can play the splash animation natively.
/// Implemented by `LottieSplashPlayer` and `RiveSplashPlayer`.
protocol SplashPlayer: AnyObject {
  var view: UIView { get }
  func play()
  /// Seconds left before the current loop ends (0 if not looping).
  func remainingLoopTime() -> TimeInterval
  /// Plays the outro. Returns `false` if this animation has no such outro.
  func playOutro(_ name: String, duration: TimeInterval, completion: @escaping () -> Void) -> Bool
  func setNumber(_ name: String, _ value: Double)
  func setBoolean(_ name: String, _ value: Bool)
  func trigger(_ name: String)
  func stop()
}
