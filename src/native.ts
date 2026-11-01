import { NitroModules } from 'react-native-nitro-modules';
import type { SplashMotionModule } from './SplashMotion.nitro';

export const native =
  NitroModules.createHybridObject<SplashMotionModule>('SplashMotionModule');
