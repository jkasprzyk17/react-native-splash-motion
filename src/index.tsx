import { useEffect, useRef } from 'react';
import { native } from './native';
import type { HideConfig } from './SplashMotion.nitro';

export type HideOptions = HideConfig;

/**
 * Hide the splash screen. Resolves once it is fully gone.
 *
 * By default the current animation loop finishes first, then the splash
 * fades out — so it never gets cut off mid-motion.
 *
 * @example
 * await SplashMotion.hide();
 * await SplashMotion.hide({ outro: 'outro', minDuration: 1200 });
 */
function hide(options: HideOptions = {}): Promise<void> {
  return native.hide(options);
}

/** `true` while the splash is on screen. */
function isVisible(): boolean {
  return native.isVisible();
}

/**
 * Rive only: drive a state machine input while the app is loading.
 *
 * @example
 * SplashMotion.setInput('progress', 0.42); // number input
 * SplashMotion.setInput('isDark', true);   // boolean input
 */
function setInput(name: string, value: number | boolean): void {
  if (typeof value === 'boolean') {
    native.setBoolean(name, value);
  } else {
    native.setNumber(name, value);
  }
}

/** Rive only: fire a trigger input. */
function trigger(name: string): void {
  native.trigger(name);
}

/**
 * Hide the splash as soon as `ready` becomes `true`.
 *
 * @example
 * const fontsLoaded = useFonts(...);
 * useHideSplash(fontsLoaded && !!user);
 */
export function useHideSplash(
  ready: boolean = true,
  options?: HideOptions
): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (ready) {
      hide(optionsRef.current);
    }
  }, [ready]);
}

const SplashMotion = { hide, isVisible, setInput, trigger };

export { hide, isVisible, setInput, trigger };
export default SplashMotion;
