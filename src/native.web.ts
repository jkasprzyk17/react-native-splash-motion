import type { HideConfig } from './SplashMotion.nitro';

// No native splash on web: every call is a harmless no-op.
export const native = {
  hide: (_config: HideConfig) => Promise.resolve(),
  isVisible: () => false,
  setNumber: (_name: string, _value: number) => {},
  setBoolean: (_name: string, _value: boolean) => {},
  trigger: (_name: string) => {},
};
