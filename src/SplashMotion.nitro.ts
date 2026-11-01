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
  /**
   * Play an outro before leaving.
   * - Lottie: name of a marker in your animation (e.g. `"outro"`).
   * - Rive: name of a trigger input in your state machine.
   */
  outro?: string;
  /** Rive only: how long the outro lasts (ms). Default: `600`. */
  outroDuration?: number;
}

export interface SplashMotionModule
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  hide(config: HideConfig): Promise<void>;
  isVisible(): boolean;
  setNumber(name: string, value: number): void;
  setBoolean(name: string, value: boolean): void;
  trigger(name: string): void;
}
