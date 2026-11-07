/**
 * Expo config plugin. Usage in app.json:
 *
 *   "plugins": [["react-native-splash-motion", {
 *     "source": "./assets/splash.json",
 *     "background": "#0F6E56"
 *   }]]
 *
 * `source` can be a Lottie .json or a dotLottie .lottie file.
 */
import * as core from '../cli/core';

// The slice of `expo/config-plugins` used here, typed locally so the package
// doesn't need Expo as a dependency.
type ExpoConfig = Record<string, unknown>;

type ModConfig<T> = ExpoConfig & {
  modRequest: { projectRoot: string };
  modResults: T;
};

type Mod<T> = (config: ModConfig<T>) => ModConfig<T>;

type ConfigPlugin<P> = (config: ExpoConfig, props?: P) => ExpoConfig;

interface StyleResource {
  $: { name: string; parent?: string };
  item: { $: { name: string }; _: string }[];
}

interface StylesXml {
  resources: { style?: StyleResource[] };
}

interface ConfigPlugins {
  AndroidConfig: {
    Manifest: {
      getMainActivityOrThrow(manifest: unknown): {
        $: Record<string, string | undefined>;
      };
    };
  };
  createRunOncePlugin<P>(
    plugin: ConfigPlugin<P>,
    name: string,
    version: string
  ): ConfigPlugin<P>;
  withAndroidManifest(config: ExpoConfig, action: Mod<unknown>): ExpoConfig;
  withAndroidStyles(config: ExpoConfig, action: Mod<StylesXml>): ExpoConfig;
  withDangerousMod(
    config: ExpoConfig,
    mod: ['ios' | 'android', Mod<unknown>]
  ): ExpoConfig;
}

function loadConfigPlugins(): ConfigPlugins {
  try {
    return require('expo/config-plugins');
  } catch {
    return require('@expo/config-plugins');
  }
}

const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withAndroidStyles,
  withDangerousMod,
} = loadConfigPlugins();

// Resolved by package name, so it works from the compiled lib/plugin folder.
const pkg: {
  name: string;
  version: string;
} = require('react-native-splash-motion/package.json');

const withSplashMotion: ConfigPlugin<core.SplashOptions> = (
  config,
  props = {}
) => {
  if (!props.source) {
    throw new Error(
      `${core.LOG} The Expo plugin needs a "source" option pointing to your animation.`
    );
  }

  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const root = c.modRequest.projectRoot;
      core.generateIos(root, core.resolveOptions(root, props));
      return c;
    },
  ]);

  config = withDangerousMod(config, [
    'android',
    (c) => {
      const root = c.modRequest.projectRoot;
      core.generateAndroidFiles(root, core.resolveOptions(root, props));
      return c;
    },
  ]);

  config = withAndroidStyles(config, (c) => {
    const resources = c.modResults.resources;
    resources.style = (resources.style ?? []).filter(
      (s) => s.$.name !== 'SplashMotionTheme'
    );
    resources.style.push({
      $: { name: 'SplashMotionTheme', parent: 'Theme.SplashMotion' },
      item: [{ $: { name: 'postSplashScreenTheme' }, _: '@style/AppTheme' }],
    });
    return c;
  });

  config = withAndroidManifest(config, (c) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(
      c.modResults
    );
    activity.$['android:theme'] = '@style/SplashMotionTheme';
    return c;
  });

  return config;
};

export = createRunOncePlugin(withSplashMotion, pkg.name, pkg.version);
