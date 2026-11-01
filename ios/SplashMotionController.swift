import UIKit

/// Owns the native overlay: shows it on the first app window and removes it
/// when JavaScript calls `hide()`.
final class SplashMotionController {
  static let shared = SplashMotionController()

  private let lock = NSLock()
  private var _visible = false

  // Main-thread state
  private var attached = false
  private var container: UIView?
  private var player: SplashPlayer?
  private var shownAt = Date()
  private var hiding = false
  private var pending: [() -> Void] = []

  var isVisible: Bool {
    lock.lock(); defer { lock.unlock() }
    return _visible
  }

  private func setVisible(_ value: Bool) {
    lock.lock(); _visible = value; lock.unlock()
  }

  // MARK: Showing

  /// Returns `true` once the overlay is attached (or definitively skipped).
  @discardableResult
  func attach(to window: UIWindow) -> Bool {
    guard !attached else { return true }
    attached = true

    guard let config = SplashMotionConfig.load() else {
      NSLog("[SplashMotion] No config found. Run `npx splash-motion generate <file>` and rebuild.")
      return true
    }
    guard let data = SplashMotionConfig.animationData(),
          let player = makePlayer(config: config, data: data) else {
      return true
    }

    let container = UIView(frame: window.bounds)
    container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    container.backgroundColor = config.backgroundColor
    container.isUserInteractionEnabled = true // swallow touches while visible
    container.layer.zPosition = .greatestFiniteMagnitude
    container.accessibilityViewIsModal = true

    let animationView = player.view
    animationView.translatesAutoresizingMaskIntoConstraints = false
    container.addSubview(animationView)
    NSLayoutConstraint.activate([
      animationView.centerXAnchor.constraint(equalTo: container.centerXAnchor),
      animationView.centerYAnchor.constraint(equalTo: container.centerYAnchor),
      animationView.widthAnchor.constraint(equalToConstant: CGFloat(config.width)),
      animationView.heightAnchor.constraint(equalToConstant: CGFloat(config.height)),
    ])

    window.addSubview(container)
    self.container = container
    self.player = player
    shownAt = Date()
    setVisible(true)
    player.play()
    return true
  }

  private func makePlayer(config: SplashMotionConfig, data: Data) -> SplashPlayer? {
    if config.type == "rive" {
      #if canImport(RiveRuntime)
      return RiveSplashPlayer(data: data, config: config)
      #else
      NSLog("[SplashMotion] This is a Rive splash but RiveRuntime isn't linked. Run `pod install` again.")
      return nil
      #endif
    }
    #if canImport(Lottie)
    return LottieSplashPlayer(data: data, config: config)
    #else
    NSLog("[SplashMotion] This is a Lottie splash but lottie-ios isn't linked. Run `pod install` again.")
    return nil
    #endif
  }

  // MARK: Hiding

  func hide(
    fade: Double,
    minDuration: Double,
    waitForLoop: Bool,
    outro: String?,
    outroDuration: Double,
    completion: @escaping () -> Void
  ) {
    DispatchQueue.main.async {
      guard self.container != nil else {
        completion()
        return
      }
      self.pending.append(completion)
      if self.hiding { return }
      self.hiding = true

      let elapsed = Date().timeIntervalSince(self.shownAt) * 1000
      let delay = max(0, minDuration - elapsed) / 1000
      DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
        self.runExit(fade: fade, waitForLoop: waitForLoop, outro: outro, outroDuration: outroDuration)
      }
    }
  }

  private func runExit(fade: Double, waitForLoop: Bool, outro: String?, outroDuration: Double) {
    guard let player else {
      dismiss(fade: fade)
      return
    }
    let afterLoop = { [weak self] in
      guard let self else { return }
      if let outro,
         player.playOutro(outro, duration: outroDuration / 1000, completion: { [weak self] in
           self?.dismiss(fade: fade)
         }) {
        return
      }
      self.dismiss(fade: fade)
    }
    if waitForLoop {
      let wait = min(player.remainingLoopTime(), 5)
      DispatchQueue.main.asyncAfter(deadline: .now() + wait, execute: afterLoop)
    } else {
      afterLoop()
    }
  }

  private func dismiss(fade: Double) {
    guard let container else {
      flush()
      return
    }
    let finish = { [weak self] in
      guard let self else { return }
      container.removeFromSuperview()
      self.player?.stop()
      self.player = nil
      self.container = nil
      self.setVisible(false)
      self.flush()
    }
    if fade > 0 {
      UIView.animate(withDuration: fade / 1000, delay: 0, options: [.curveEaseOut]) {
        container.alpha = 0
      } completion: { _ in
        finish()
      }
    } else {
      finish()
    }
  }

  private func flush() {
    let callbacks = pending
    pending.removeAll()
    hiding = false
    callbacks.forEach { $0() }
  }

  // MARK: Inputs

  func setNumber(_ name: String, _ value: Double) {
    DispatchQueue.main.async { self.player?.setNumber(name, value) }
  }

  func setBoolean(_ name: String, _ value: Bool) {
    DispatchQueue.main.async { self.player?.setBoolean(name, value) }
  }

  func trigger(_ name: String) {
    DispatchQueue.main.async { self.player?.trigger(name) }
  }
}
