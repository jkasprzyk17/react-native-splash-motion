'use strict';

/**
 * Expo config plugin. Usage in app.json:
 *
 *   "plugins": [["react-native-splash-motion", {
 *     "source": "./assets/splash.json",
 *     "background": "#0F6E56"
 *   }]]
 *
 * `source` can be a Lottie .json, a dotLottie .lottie or a Rive .riv file.
 */
const core = require('../cli/core');

function loadConfigPlugins() {
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

const pkg = require('../package.json');

function withSplashMotion(config, props = {}) {
  if (!props.source) {
    throw new Error(`${core.LOG} The Expo plugin needs a "source" option pointing to your animation.`);
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
    resources.style = (resources.style ?? []).filter((s) => s.$.name !== 'SplashMotionTheme');
    resources.style.push({
      $: { name: 'SplashMotionTheme', parent: 'Theme.SplashMotion' },
      item: [{ $: { name: 'postSplashScreenTheme' }, _: '@style/AppTheme' }],
    });
    return c;
  });

  config = withAndroidManifest(config, (c) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(c.modResults);
    activity.$['android:theme'] = '@style/SplashMotionTheme';
    return c;
  });

  return config;
}

module.exports = createRunOncePlugin(withSplashMotion, pkg.name, pkg.version);
