import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateAndroidFiles,
  generateIos,
  patchAndroidProject,
  resolveOptions,
} from '../core';
import type { ResolvedOptions } from '../core';
import {
  makeAndroidProject,
  makeIosProject,
  makeLottie,
  makePng,
  read,
  readJson,
  removeTempDirs,
  shapeLayer,
  tempDir,
  writeAnimation,
} from './helpers';

let root: string;

beforeEach(() => {
  root = tempDir();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  removeTempDirs();
});

function options(overrides: Record<string, unknown> = {}): ResolvedOptions {
  const source = writeAnimation(
    root,
    makeLottie({ w: 200, h: 100, layers: [shapeLayer()] })
  );
  return resolveOptions(root, { source, width: 160, ...overrides });
}

function withStill(): ResolvedOptions {
  const still = path.join(root, 'still.png');
  fs.writeFileSync(still, makePng());
  return options({ still });
}

describe('generateIos', () => {
  it('writes the asset catalog and storyboard', () => {
    const appDir = makeIosProject(root);
    const { storyboard } = generateIos(
      root,
      options({ background: '#0F6E56' })
    );
    const assets = path.join(appDir, 'Images.xcassets');

    const color = readJson(
      path.join(assets, 'SplashMotionBackground.colorset', 'Contents.json')
    );
    expect(color.colors[0].color.components.red).toBe('0.059');
    expect(color.colors[0].color.components.green).toBe('0.431');

    const config = readJson(
      path.join(assets, 'SplashMotionConfig.dataset', 'config.json')
    );
    expect(config).toEqual({
      file: 'animation.json',
      width: 160,
      height: 80,
      background: '#0F6E56',
      loop: true,
      loopMarker: null,
    });

    const animation = readJson(
      path.join(assets, 'SplashMotionAnimation.dataset', 'animation.json')
    );
    expect(animation.w).toBe(200);

    expect(storyboard).toBe(path.join(appDir, 'LaunchScreen.storyboard'));
    const xml = read(storyboard);
    expect(xml).toContain('launchScreen="YES"');
    expect(xml).toContain('green="0.431"');
    expect(xml).not.toContain('SplashMotionStill');
  });

  it('uses the storyboard name from Info.plist', () => {
    const appDir = makeIosProject(root, { storyboardName: 'CustomLaunch' });
    generateIos(root, options());
    expect(fs.existsSync(path.join(appDir, 'CustomLaunch.storyboard'))).toBe(
      true
    );
  });

  it('adds the still image and removes it on a later run without one', () => {
    const appDir = makeIosProject(root);
    generateIos(root, withStill());
    const imageset = path.join(
      appDir,
      'Images.xcassets',
      'SplashMotionStill.imageset'
    );
    expect(fs.existsSync(path.join(imageset, 'still.png'))).toBe(true);
    expect(read(path.join(appDir, 'LaunchScreen.storyboard'))).toContain(
      'SplashMotionStill'
    );

    generateIos(root, options());
    expect(fs.existsSync(imageset)).toBe(false);
    expect(read(path.join(appDir, 'LaunchScreen.storyboard'))).not.toContain(
      'SplashMotionStill'
    );
  });

  it('ignores Pods and build folders when locating the app', () => {
    makeIosProject(root, { appDir: 'Pods' });
    makeIosProject(root, { appDir: 'ZApp' });
    const { storyboard } = generateIos(root, options());
    expect(storyboard).toContain('ZApp');
  });

  it('fails without an iOS project', () => {
    expect(() => generateIos(root, options())).toThrow(
      /Could not find an iOS app folder/
    );
  });

  it('fails without an asset catalog', () => {
    makeIosProject(root, { xcassets: false });
    expect(() => generateIos(root, options())).toThrow(
      /No \.xcassets catalog found/
    );
  });
});

describe('generateAndroidFiles', () => {
  it('writes the animation, config and colors', () => {
    const main = makeAndroidProject(root);
    generateAndroidFiles(root, options({ background: '#0F6E56' }));

    const config = readJson(
      path.join(main, 'assets', 'splashmotion', 'config.json')
    );
    expect(config).toEqual({
      file: 'animation.json',
      width: 160,
      height: 80,
      background: '#0F6E56',
      loop: true,
      loopMarker: null,
    });
    expect(
      readJson(path.join(main, 'assets', 'splashmotion', 'animation.json')).w
    ).toBe(200);
    expect(
      read(path.join(main, 'res', 'values', 'splashmotion_colors.xml'))
    ).toContain('<color name="splashmotion_background">#0F6E56</color>');
  });

  it('writes the still and both splash icons, sized per platform version', () => {
    const main = makeAndroidProject(root);
    generateAndroidFiles(root, withStill());

    expect(
      fs.existsSync(
        path.join(main, 'res', 'drawable-nodpi', 'splashmotion_still.png')
      )
    ).toBe(true);
    const legacy = read(
      path.join(main, 'res', 'drawable', 'splashmotion_icon.xml')
    );
    expect(legacy).toContain('android:width="160dp"');
    expect(legacy).toContain('android:height="80dp"');
    const v31 = read(
      path.join(main, 'res', 'drawable-v31', 'splashmotion_icon.xml')
    );
    expect(v31).toContain('android:width="90dp"'); // 160 × 108/192
    expect(v31).toContain('android:height="45dp"');
  });

  it('removes stale still files when regenerating without one', () => {
    const main = makeAndroidProject(root);
    generateAndroidFiles(root, withStill());
    generateAndroidFiles(root, options());
    for (const file of [
      path.join(main, 'res', 'drawable-nodpi', 'splashmotion_still.png'),
      path.join(main, 'res', 'drawable', 'splashmotion_icon.xml'),
      path.join(main, 'res', 'drawable-v31', 'splashmotion_icon.xml'),
    ]) {
      expect(fs.existsSync(file)).toBe(false);
    }
  });

  it('warns when the still is larger than the visible splash circle', () => {
    makeAndroidProject(root);
    generateAndroidFiles(root, withStill());
    expect(console.warn).not.toHaveBeenCalled();

    const still = path.join(root, 'still.png');
    generateAndroidFiles(root, options({ still, width: 400, height: 400 }));
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('192dp circle')
    );
  });

  it('fails without an Android project', () => {
    expect(() => generateAndroidFiles(root, options())).toThrow(
      /Could not find/
    );
  });
});

describe('patchAndroidProject', () => {
  function themeOf(main: string) {
    return read(path.join(main, 'res', 'values', 'styles.xml'));
  }

  it('points MainActivity at the splash theme, defaulting to AppTheme', () => {
    const main = makeAndroidProject(root);
    patchAndroidProject(root);
    expect(read(path.join(main, 'AndroidManifest.xml'))).toContain(
      'android:theme="@style/SplashMotionTheme"'
    );
    const styles = themeOf(main);
    expect(styles).toContain('<style name="SplashMotionTheme"');
    expect(styles).toContain(
      '<item name="postSplashScreenTheme">@style/AppTheme</item>'
    );
    expect(styles).toContain('<style name="AppTheme"'); // untouched
  });

  it('preserves an existing activity theme as the post-splash theme', () => {
    const main = makeAndroidProject(root, {
      manifest: `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:theme="@style/AppTheme">
        <activity android:name=".MainActivity" android:theme="@style/CustomTheme" />
    </application>
</manifest>
`,
    });
    patchAndroidProject(root);
    const manifest = read(path.join(main, 'AndroidManifest.xml'));
    expect(manifest).toContain('android:theme="@style/SplashMotionTheme"');
    expect(manifest).not.toContain('CustomTheme');
    expect(themeOf(main)).toContain(
      '<item name="postSplashScreenTheme">@style/CustomTheme</item>'
    );
  });

  it('falls back to the application theme', () => {
    const main = makeAndroidProject(root, {
      manifest: `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:theme="@style/CustomAppTheme">
        <activity android:name=".MainActivity" />
    </application>
</manifest>
`,
    });
    patchAndroidProject(root);
    expect(themeOf(main)).toContain(
      '<item name="postSplashScreenTheme">@style/CustomAppTheme</item>'
    );
  });

  it('is idempotent when re-run', () => {
    const main = makeAndroidProject(root);
    patchAndroidProject(root);
    const manifestOnce = read(path.join(main, 'AndroidManifest.xml'));
    patchAndroidProject(root);
    expect(read(path.join(main, 'AndroidManifest.xml'))).toBe(manifestOnce);

    const styles = themeOf(main);
    expect(styles.match(/<style name="SplashMotionTheme"/g)).toHaveLength(1);
    expect(styles).toContain(
      '<item name="postSplashScreenTheme">@style/AppTheme</item>'
    );
  });

  it('keeps the original post-splash theme across re-runs', () => {
    const main = makeAndroidProject(root, {
      manifest: `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:theme="@style/AppTheme">
        <activity android:name=".MainActivity" android:theme="@style/CustomTheme" />
    </application>
</manifest>
`,
    });
    patchAndroidProject(root);
    patchAndroidProject(root);
    expect(themeOf(main)).toContain(
      '<item name="postSplashScreenTheme">@style/CustomTheme</item>'
    );
  });

  it('fails without a MainActivity', () => {
    makeAndroidProject(root, {
      manifest: `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application />
</manifest>
`,
    });
    expect(() => patchAndroidProject(root)).toThrow(
      /Could not find \.MainActivity/
    );
  });
});
