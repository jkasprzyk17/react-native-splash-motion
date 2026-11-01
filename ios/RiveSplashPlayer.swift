#if canImport(RiveRuntime)
import RiveRuntime
import UIKit

final class RiveSplashPlayer: SplashPlayer {
  private let viewModel: RiveViewModel
  private let riveView: RiveView

  var view: UIView { riveView }

  init?(data: Data, config: SplashMotionConfig) {
    guard let file = try? RiveFile(data: data, loadCdn: false) else {
      NSLog("[SplashMotion] Could not decode the Rive file.")
      return nil
    }
    let model = RiveModel(riveFile: file)
    viewModel = RiveViewModel(
      model,
      stateMachineName: config.stateMachine ?? "State Machine 1",
      fit: .contain,
      alignment: .center,
      autoPlay: true,
      artboardName: config.artboard
    )
    riveView = viewModel.createRiveView()
    riveView.backgroundColor = .clear
  }

  func play() {
    viewModel.play()
  }

  // State machines drive their own timing — nothing to wait for.
  func remainingLoopTime() -> TimeInterval { 0 }

  func playOutro(_ name: String, duration: TimeInterval, completion: @escaping () -> Void) -> Bool {
    viewModel.triggerInput(name)
    DispatchQueue.main.asyncAfter(deadline: .now() + duration, execute: completion)
    return true
  }

  func setNumber(_ name: String, _ value: Double) {
    viewModel.setInput(name, value: value)
  }

  func setBoolean(_ name: String, _ value: Bool) {
    viewModel.setInput(name, value: value)
  }

  func trigger(_ name: String) {
    viewModel.triggerInput(name)
  }

  func stop() {
    viewModel.stop()
  }
}
#endif
