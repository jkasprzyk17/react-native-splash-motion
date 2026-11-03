import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Options for `SplashMotion.hide()`. Every field is optional — the defaults
 * give a polished result with zero configuration.
 */
export interface HideConfig {
  /** Fade-out duration in ms once the animation is done. `0` disables it. Default: `220`. */
  fade?: number;
  /** Keep the splash visible at least this long (ms since launch). Default: `0`. */
  minDuration?: number;
  /** Let the current loop finish instead of cutting the animation mid-way. Default: `true`. */
  waitForLoop?: boolean;
  /** Play an outro before leaving: the name of a marker in your animation (e.g. `"outro"`). */
  outro?: string;
}

export interface SplashMotionModule
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  hide(config: HideConfig): Promise<void>;
  isVisible(): boolean;
}
