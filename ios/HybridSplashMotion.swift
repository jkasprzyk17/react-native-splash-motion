import NitroModules

/// Nitro HybridObject backing the JS `SplashMotion` API.
class HybridSplashMotion: HybridSplashMotionModuleSpec {
  func hide(config: HideConfig) throws -> Promise<Void> {
    let promise = Promise<Void>()
    SplashMotionController.shared.hide(
      fade: config.fade ?? 220,
      minDuration: config.minDuration ?? 0,
      waitForLoop: config.waitForLoop ?? true,
      outro: config.outro,
      outroDuration: config.outroDuration ?? 600
    ) {
      promise.resolve(withResult: ())
    }
    return promise
  }

  func isVisible() throws -> Bool {
    SplashMotionController.shared.isVisible
  }

  func setNumber(name: String, value: Double) throws {
    SplashMotionController.shared.setNumber(name, value)
  }

  func setBoolean(name: String, value: Bool) throws {
    SplashMotionController.shared.setBoolean(name, value)
  }

  func trigger(name: String) throws {
    SplashMotionController.shared.trigger(name)
  }
}
