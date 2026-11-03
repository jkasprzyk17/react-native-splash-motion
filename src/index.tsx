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

const SplashMotion = { hide, isVisible };

export { hide, isVisible };
export default SplashMotion;
