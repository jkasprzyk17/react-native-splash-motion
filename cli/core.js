'use strict';

/**
 * Shared asset generation used by both the CLI (`npx splash-motion generate`)
 * and the Expo config plugin. Zero dependencies.
 */
const fs = require('fs');
const path = require('path');

const LOG = '[splash-motion]';

// ---------------------------------------------------------------------------
// Helpers

function parseHex(hex) {
  let value = String(hex).trim().replace(/^#/, '');
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`${LOG} Invalid color "${hex}". Use a hex value like #0F6E56.`);
  }
  const int = parseInt(value, 16);
  return {
    hex: `#${value.toUpperCase()}`,
    r: ((int >> 16) & 255) / 255,
    g: ((int >> 8) & 255) / 255,
    b: (int & 255) / 255,
  };
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function writeJson(file, data) {
  write(file, JSON.stringify(data, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Input

/** Reads the animation and resolves the final, normalized config. */
function resolveOptions(projectRoot, options) {
  if (!options.source) {
    throw new Error(`${LOG} Missing animation file. Usage: npx splash-motion generate <file.json|file.riv>`);
  }
  const source = path.resolve(projectRoot, options.source);
  if (!fs.existsSync(source)) {
    throw new Error(`${LOG} Animation file not found: ${source}`);
  }

  const ext = path.extname(source).toLowerCase();
  let type;
  let ratio = 1;
  if (ext === '.json') {
    type = 'lottie';
    try {
      const json = JSON.parse(fs.readFileSync(source, 'utf8'));
      if (json.w && json.h) ratio = json.h / json.w;
    } catch {
      throw new Error(`${LOG} ${path.basename(source)} is not a valid Lottie JSON file.`);
    }
  } else if (ext === '.riv') {
    type = 'rive';
  } else if (ext === '.lottie') {
    throw new Error(`${LOG} .lottie files aren't supported yet. Export your animation as Lottie JSON.`);
  } else {
    throw new Error(`${LOG} Unsupported file type "${ext}". Use a Lottie .json or a Rive .riv file.`);
  }

  const width = Number(options.width ?? 160);
  const height = Number(options.height ?? Math.round(width * ratio));
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`${LOG} width/height must be positive numbers.`);
  }

  const background = parseHex(options.background ?? '#FFFFFF');
  const darkBackground = options.darkBackground ? parseHex(options.darkBackground) : null;
  const still = options.still ? path.resolve(projectRoot, options.still) : null;
  if (still && !fs.existsSync(still)) {
    throw new Error(`${LOG} Still image not found: ${still}`);
  }
  if (still && path.extname(still).toLowerCase() !== '.png') {
    throw new Error(`${LOG} The still image must be a PNG.`);
  }

  return {
    source,
    type,
    width,
    height,
    background,
    darkBackground,
    still,
    loop: options.loop !== false,
    loopMarker: options.loopMarker || null,
    stateMachine: options.stateMachine || null,
    artboard: options.artboard || null,
  };
}

function runtimeConfig(o, file) {
  return {
    type: o.type,
    file,
    width: o.width,
    height: o.height,
    background: o.background.hex,
    darkBackground: o.darkBackground ? o.darkBackground.hex : null,
    loop: o.loop,
    loopMarker: o.loopMarker,
    stateMachine: o.stateMachine,
    artboard: o.artboard,
  };
}

// ---------------------------------------------------------------------------
// iOS

function findIosApp(projectRoot) {
  const iosDir = path.join(projectRoot, 'ios');
  if (!fs.existsSync(iosDir)) return null;
  for (const entry of fs.readdirSync(iosDir)) {
    if (entry === 'Pods' || entry === 'build' || entry.endsWith('Tests')) continue;
    const dir = path.join(iosDir, entry);
    const plist = path.join(dir, 'Info.plist');
    if (!fs.statSync(dir).isDirectory() || !fs.existsSync(plist)) continue;
    const content = fs.readFileSync(plist, 'utf8');
    const match = content.match(/<key>UILaunchStoryboardName<\/key>\s*<string>([^<]+)<\/string>/);
    const xcassets = fs.readdirSync(dir).find((f) => f.endsWith('.xcassets'));
    return {
      dir,
      storyboardName: match ? match[1].replace(/\.storyboard$/, '') : 'LaunchScreen',
      xcassets: xcassets ? path.join(dir, xcassets) : null,
    };
  }
  return null;
}

function colorComponents(c) {
  return {
    'color-space': 'srgb',
    'components': {
      red: c.r.toFixed(3),
      green: c.g.toFixed(3),
      blue: c.b.toFixed(3),
      alpha: '1.000',
    },
  };
}

function launchStoryboard(o) {
  const c = o.background;
  const image = o.still
    ? `
                        <subviews>
                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" image="SplashMotionStill" translatesAutoresizingMaskIntoConstraints="NO" id="lsI-mg-001">
                                <constraints>
                                    <constraint firstAttribute="width" constant="${o.width}" id="lsW-id-001"/>
                                    <constraint firstAttribute="height" constant="${o.height}" id="lsH-gt-001"/>
                                </constraints>
                            </imageView>
                        </subviews>`
    : '';
  const constraints = o.still
    ? `
                        <constraints>
                            <constraint firstItem="lsI-mg-001" firstAttribute="centerX" secondItem="Ze5-6b-2t3" secondAttribute="centerX" id="lsC-x0-001"/>
                            <constraint firstItem="lsI-mg-001" firstAttribute="centerY" secondItem="Ze5-6b-2t3" secondAttribute="centerY" id="lsC-y0-001"/>
                        </constraints>`
    : '';
  const imageResource = o.still
    ? `\n        <image name="SplashMotionStill" width="${o.width}" height="${o.height}"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by react-native-splash-motion. Re-run \`npx splash-motion generate\` instead of editing. -->
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="23504" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="23506"/>
        <capability name="Named colors" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>${image}
                        <color key="backgroundColor" name="SplashMotionBackground"/>${constraints}
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="53" y="375"/>
        </scene>
    </scenes>
    <resources>${imageResource}
        <namedColor name="SplashMotionBackground">
            <color red="${c.r.toFixed(3)}" green="${c.g.toFixed(3)}" blue="${c.b.toFixed(3)}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
        </namedColor>
    </resources>
</document>
`;
}

/**
 * iOS output (no Xcode project edits needed — everything lives in files that
 * are already part of the project):
 * - Images.xcassets/SplashMotionBackground.colorset  (light + dark)
 * - Images.xcassets/SplashMotionConfig.dataset       (runtime config)
 * - Images.xcassets/SplashMotionAnimation.dataset    (the animation)
 * - Images.xcassets/SplashMotionStill.imageset       (optional)
 * - <LaunchScreen>.storyboard                       (overwritten)
 */
function generateIos(projectRoot, o) {
  const app = findIosApp(projectRoot);
  if (!app) throw new Error(`${LOG} Could not find an iOS app folder with an Info.plist in ./ios`);
  if (!app.xcassets) throw new Error(`${LOG} No .xcassets catalog found in ${app.dir}`);

  const assets = app.xcassets;
  const info = { author: 'react-native-splash-motion', version: 1 };

  const colors = [{ idiom: 'universal', color: colorComponents(o.background) }];
  if (o.darkBackground) {
    colors.push({
      idiom: 'universal',
      appearances: [{ appearance: 'luminosity', value: 'dark' }],
      color: colorComponents(o.darkBackground),
    });
  }
  writeJson(path.join(assets, 'SplashMotionBackground.colorset', 'Contents.json'), { colors, info });

  const animFile = o.type === 'rive' ? 'animation.riv' : 'animation.json';
  const animDir = path.join(assets, 'SplashMotionAnimation.dataset');
  fs.rmSync(animDir, { recursive: true, force: true });
  write(path.join(animDir, animFile), fs.readFileSync(o.source));
  writeJson(path.join(animDir, 'Contents.json'), {
    data: [
      {
        'filename': animFile,
        'idiom': 'universal',
        'universal-type-identifier': o.type === 'rive' ? 'public.data' : 'public.json',
      },
    ],
    info,
  });

  writeJson(path.join(assets, 'SplashMotionConfig.dataset', 'config.json'), runtimeConfig(o, animFile));
  writeJson(path.join(assets, 'SplashMotionConfig.dataset', 'Contents.json'), {
    data: [{ 'filename': 'config.json', 'idiom': 'universal', 'universal-type-identifier': 'public.json' }],
    info,
  });

  const stillDir = path.join(assets, 'SplashMotionStill.imageset');
  fs.rmSync(stillDir, { recursive: true, force: true });
  if (o.still) {
    write(path.join(stillDir, 'still.png'), fs.readFileSync(o.still));
    writeJson(path.join(stillDir, 'Contents.json'), {
      images: [{ filename: 'still.png', idiom: 'universal' }],
      info,
      properties: { 'preserves-vector-representation': false },
    });
  }

  const storyboard = path.join(app.dir, `${app.storyboardName}.storyboard`);
  write(storyboard, launchStoryboard(o));

  return { storyboard, assets };
}

// ---------------------------------------------------------------------------
// Android

function androidMain(projectRoot) {
  return path.join(projectRoot, 'android', 'app', 'src', 'main');
}

function colorsXml(hex) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by react-native-splash-motion. -->
<resources>
    <color name="splashmotion_background">${hex}</color>
</resources>
`;
}

/** Android files: assets + colors (shared by the CLI and the Expo plugin). */
function generateAndroidFiles(projectRoot, o) {
  const main = androidMain(projectRoot);
  if (!fs.existsSync(main)) throw new Error(`${LOG} Could not find ${main}`);

  const assetsDir = path.join(main, 'assets', 'splashmotion');
  fs.rmSync(assetsDir, { recursive: true, force: true });
  const animFile = o.type === 'rive' ? 'animation.riv' : 'animation.json';
  write(path.join(assetsDir, animFile), fs.readFileSync(o.source));
  writeJson(path.join(assetsDir, 'config.json'), runtimeConfig(o, animFile));

  write(path.join(main, 'res', 'values', 'splashmotion_colors.xml'), colorsXml(o.background.hex));
  const night = path.join(main, 'res', 'values-night', 'splashmotion_colors.xml');
  if (o.darkBackground) write(night, colorsXml(o.darkBackground.hex));
  else fs.rmSync(night, { force: true });

  return { assetsDir };
}

/** Bare React Native only: point MainActivity at the splash theme. */
function patchAndroidProject(projectRoot) {
  const main = androidMain(projectRoot);
  const manifestPath = path.join(main, 'AndroidManifest.xml');
  const stylesPath = path.join(main, 'res', 'values', 'styles.xml');

  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const activityRe = /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/;
  const activity = manifest.match(activityRe);
  if (!activity) throw new Error(`${LOG} Could not find .MainActivity in AndroidManifest.xml`);

  const current = activity[0].match(/android:theme="([^"]+)"/);
  const appTheme = manifest.match(/<application\b[^>]*android:theme="([^"]+)"/);
  let postTheme = '@style/AppTheme';
  if (current && current[1] !== '@style/SplashMotionTheme') postTheme = current[1];
  else if (appTheme && appTheme[1] !== '@style/SplashMotionTheme') postTheme = appTheme[1];

  const patchedActivity = current
    ? activity[0].replace(current[0], 'android:theme="@style/SplashMotionTheme"')
    : activity[0].replace('<activity', '<activity\n        android:theme="@style/SplashMotionTheme"');
  manifest = manifest.replace(activity[0], patchedActivity);
  fs.writeFileSync(manifestPath, manifest);

  let styles = fs.readFileSync(stylesPath, 'utf8');
  styles = styles.replace(/\s*<style name="SplashMotionTheme"[\s\S]*?<\/style>/, '');
  styles = styles.replace(
    '</resources>',
    `    <style name="SplashMotionTheme" parent="Theme.SplashMotion">
        <item name="postSplashScreenTheme">${postTheme}</item>
    </style>

</resources>`
  );
  fs.writeFileSync(stylesPath, styles);
}

module.exports = {
  LOG,
  resolveOptions,
  generateIos,
  generateAndroidFiles,
  patchAndroidProject,
};
