'use strict';

/**
 * Shared asset generation used by both the CLI (`npx splash-motion generate`)
 * and the Expo config plugin. Zero dependencies.
 */
const { Buffer } = require('buffer');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LOG = '[splash-motion]';

// ---------------------------------------------------------------------------
// Helpers

function parseHex(hex) {
  let value = String(hex).trim().replace(/^#/, '');
  if (value.length === 3)
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(
      `${LOG} Invalid color "${hex}". Use a hex value like #0F6E56.`
    );
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

/** True if the PNG can be transparent: an alpha color type, or a tRNS chunk. */
function pngHasAlpha(buffer) {
  const colorType = buffer[25]; // IHDR, right after the 8-byte signature and chunk header
  if (colorType === 4 || colorType === 6) return true;
  for (let offset = 8; offset + 8 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'tRNS') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    offset += 12 + length;
  }
  return false;
}

function writeJson(file, data) {
  write(file, JSON.stringify(data, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// dotLottie

/** Minimal ZIP reader (stored + deflate entries), enough for .lottie archives. */
function readZip(buffer) {
  let eocd = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 22 - 0xffff);
    i--
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a ZIP archive');

  const entries = new Map();
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let n = buffer.readUInt16LE(eocd + 10); n > 0; n--) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new Error('corrupt ZIP directory');
    const nameLength = buffer.readUInt16LE(offset + 28);
    entries.set(
      buffer.toString('utf8', offset + 46, offset + 46 + nameLength),
      {
        method: buffer.readUInt16LE(offset + 10),
        size: buffer.readUInt32LE(offset + 20),
        header: buffer.readUInt32LE(offset + 42),
      }
    );
    offset +=
      46 +
      nameLength +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32);
  }

  return {
    names: [...entries.keys()],
    has: (name) => entries.has(name),
    read(name) {
      const { method, size, header } = entries.get(name);
      const start =
        header +
        30 +
        buffer.readUInt16LE(header + 26) +
        buffer.readUInt16LE(header + 28);
      const data = buffer.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`unsupported compression method ${method}`);
    },
  };
}

const IMAGE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Unpacks a .lottie (v1 or v2) into plain Lottie JSON. Uses the active (or first)
 * animation and inlines bundled images, since the native players get one file.
 */
function readDotLottie(file) {
  const name = path.basename(file);
  let zip;
  let manifest = {};
  try {
    zip = readZip(fs.readFileSync(file));
    if (zip.has('manifest.json'))
      manifest = JSON.parse(zip.read('manifest.json').toString('utf8'));
  } catch (error) {
    throw new Error(
      `${LOG} ${name} is not a valid .lottie file (${error.message}).`
    );
  }

  const animations = manifest.animations ?? [];
  const id = manifest.activeAnimationId ?? animations[0]?.id;
  const entry =
    [`a/${id}.json`, `animations/${id}.json`].find((p) => id && zip.has(p)) ??
    zip.names.find((p) => /^(a|animations)\/[^/]+\.json$/.test(p));
  if (!entry)
    throw new Error(`${LOG} ${name} doesn't contain a Lottie animation.`);
  if (animations.length > 1) {
    console.warn(
      `${LOG} ${name} has ${animations.length} animations — using "${path.basename(entry, '.json')}".`
    );
  }

  let json;
  try {
    json = JSON.parse(zip.read(entry).toString('utf8'));
  } catch {
    throw new Error(
      `${LOG} ${name} contains an invalid Lottie animation (${entry}).`
    );
  }

  for (const asset of json.assets ?? []) {
    if (!asset.p || asset.e === 1 || String(asset.p).startsWith('data:'))
      continue;
    const image = [`i/${asset.p}`, `images/${asset.p}`].find((p) => zip.has(p));
    if (!image) continue;
    const mime = IMAGE_TYPES[path.extname(image).toLowerCase()] ?? 'image/png';
    asset.p = `data:${mime};base64,${zip.read(image).toString('base64')}`;
    asset.u = '';
    asset.e = 1;
  }
  return json;
}

// ---------------------------------------------------------------------------
// Input

/** Reads the animation and resolves the final, normalized config. */
function resolveOptions(projectRoot, options) {
  if (!options.source) {
    throw new Error(
      `${LOG} Missing animation file. Usage: npx splash-motion generate <file.json|file.lottie>`
    );
  }
  const source = path.resolve(projectRoot, options.source);
  if (!fs.existsSync(source)) {
    throw new Error(`${LOG} Animation file not found: ${source}`);
  }

  const ext = path.extname(source).toLowerCase();
  let lottie;
  if (ext === '.json') {
    try {
      lottie = JSON.parse(fs.readFileSync(source, 'utf8'));
    } catch {
      throw new Error(
        `${LOG} ${path.basename(source)} is not a valid Lottie JSON file.`
      );
    }
  } else if (ext === '.lottie') {
    lottie = readDotLottie(source);
  } else {
    throw new Error(
      `${LOG} Unsupported file type "${ext}". Use a Lottie .json or a dotLottie .lottie file.`
    );
  }
  const ratio = lottie.w && lottie.h ? lottie.h / lottie.w : 1;
  // A .json is copied as-is; a .lottie ships as the plain JSON unpacked above.
  const data =
    ext === '.lottie'
      ? Buffer.from(JSON.stringify(lottie))
      : fs.readFileSync(source);

  const width = Number(options.width ?? 160);
  const height = Number(options.height ?? Math.round(width * ratio));
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`${LOG} width/height must be positive numbers.`);
  }

  const background = parseHex(options.background ?? '#FFFFFF');
  const still = options.still ? path.resolve(projectRoot, options.still) : null;
  if (still && !fs.existsSync(still)) {
    throw new Error(`${LOG} Still image not found: ${still}`);
  }
  if (still && path.extname(still).toLowerCase() !== '.png') {
    throw new Error(`${LOG} The still image must be a PNG.`);
  }
  if (still && !pngHasAlpha(fs.readFileSync(still))) {
    console.warn(
      `${LOG} ${path.basename(still)} has no transparency, so its background shows as a box on the launch ` +
        `screen whenever it isn't exactly the splash color. Export the first frame with a transparent background.`
    );
  }

  return {
    source,
    data,
    width,
    height,
    background,
    still,
    loop: options.loop !== false,
    loopMarker: options.loopMarker || null,
  };
}

function runtimeConfig(o, file) {
  return {
    file,
    width: o.width,
    height: o.height,
    background: o.background.hex,
    loop: o.loop,
    loopMarker: o.loopMarker,
  };
}

// ---------------------------------------------------------------------------
// iOS

function findIosApp(projectRoot) {
  const iosDir = path.join(projectRoot, 'ios');
  if (!fs.existsSync(iosDir)) return null;
  for (const entry of fs.readdirSync(iosDir)) {
    if (entry === 'Pods' || entry === 'build' || entry.endsWith('Tests'))
      continue;
    const dir = path.join(iosDir, entry);
    const plist = path.join(dir, 'Info.plist');
    if (!fs.statSync(dir).isDirectory() || !fs.existsSync(plist)) continue;
    const content = fs.readFileSync(plist, 'utf8');
    const match = content.match(
      /<key>UILaunchStoryboardName<\/key>\s*<string>([^<]+)<\/string>/
    );
    const xcassets = fs.readdirSync(dir).find((f) => f.endsWith('.xcassets'));
    return {
      dir,
      storyboardName: match
        ? match[1].replace(/\.storyboard$/, '')
        : 'LaunchScreen',
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

// Same sizing as the native overlay: the configured size, scaled down (keeping
// the aspect ratio) to fit MAX_SCREEN_FRACTION of the screen.
const MAX_SCREEN_FRACTION = 0.9;

function launchStoryboard(o) {
  const c = o.background;
  // The background is a plain sRGB color: iOS doesn't resolve named asset-catalog
  // colors on the launch screen (neither here nor in UILaunchScreen) and shows
  // its own blue instead.
  const image = o.still
    ? `
                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" image="SplashMotionStill" translatesAutoresizingMaskIntoConstraints="NO" id="lsI-mg-001">
                                <constraints>
                                    <constraint firstAttribute="width" constant="${o.width}" priority="750" id="lsW-id-001"/>
                                    <constraint firstAttribute="width" secondItem="lsI-mg-001" secondAttribute="height" multiplier="${o.width / o.height}" id="lsA-sp-001"/>
                                </constraints>
                            </imageView>`
    : '';
  const subviews = image
    ? `\n                        <subviews>${image}\n                        </subviews>`
    : '';
  const constraints = o.still
    ? `
                            <constraint firstItem="lsI-mg-001" firstAttribute="centerX" secondItem="Ze5-6b-2t3" secondAttribute="centerX" id="lsC-x0-001"/>
                            <constraint firstItem="lsI-mg-001" firstAttribute="centerY" secondItem="Ze5-6b-2t3" secondAttribute="centerY" id="lsC-y0-001"/>
                            <constraint firstItem="lsI-mg-001" firstAttribute="width" relation="lessThanOrEqual" secondItem="Ze5-6b-2t3" secondAttribute="width" multiplier="${MAX_SCREEN_FRACTION}" id="lsM-xw-001"/>
                            <constraint firstItem="lsI-mg-001" firstAttribute="height" relation="lessThanOrEqual" secondItem="Ze5-6b-2t3" secondAttribute="height" multiplier="${MAX_SCREEN_FRACTION}" id="lsM-xh-001"/>
                        </constraints>`
    : '';
  const resources = o.still
    ? `\n    <resources>\n        <image name="SplashMotionStill" width="${o.width}" height="${o.height}"/>\n    </resources>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by react-native-splash-motion. Re-run \`npx splash-motion generate\` instead of editing. -->
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="23504" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="23506"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>${subviews}
                        <color key="backgroundColor" red="${c.r.toFixed(3)}" green="${c.g.toFixed(3)}" blue="${c.b.toFixed(3)}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>${constraints}
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="53" y="375"/>
        </scene>
    </scenes>${resources}
</document>
`;
}

/**
 * iOS output (no Xcode project edits needed — everything lives in files that
 * are already part of the project):
 * - Images.xcassets/SplashMotionBackground.colorset  (overlay background)
 * - Images.xcassets/SplashMotionConfig.dataset       (runtime config)
 * - Images.xcassets/SplashMotionAnimation.dataset    (the animation)
 * - Images.xcassets/SplashMotionStill.imageset       (optional)
 * - <LaunchScreen>.storyboard                       (overwritten)
 */
function generateIos(projectRoot, o) {
  const app = findIosApp(projectRoot);
  if (!app)
    throw new Error(
      `${LOG} Could not find an iOS app folder with an Info.plist in ./ios`
    );
  if (!app.xcassets)
    throw new Error(`${LOG} No .xcassets catalog found in ${app.dir}`);

  const assets = app.xcassets;
  const info = { author: 'react-native-splash-motion', version: 1 };

  const colors = [{ idiom: 'universal', color: colorComponents(o.background) }];
  writeJson(
    path.join(assets, 'SplashMotionBackground.colorset', 'Contents.json'),
    { colors, info }
  );

  const animFile = 'animation.json';
  const animDir = path.join(assets, 'SplashMotionAnimation.dataset');
  fs.rmSync(animDir, { recursive: true, force: true });
  write(path.join(animDir, animFile), o.data);
  writeJson(path.join(animDir, 'Contents.json'), {
    data: [
      {
        'filename': animFile,
        'idiom': 'universal',
        'universal-type-identifier': 'public.json',
      },
    ],
    info,
  });

  writeJson(
    path.join(assets, 'SplashMotionConfig.dataset', 'config.json'),
    runtimeConfig(o, animFile)
  );
  writeJson(path.join(assets, 'SplashMotionConfig.dataset', 'Contents.json'), {
    data: [
      {
        'filename': 'config.json',
        'idiom': 'universal',
        'universal-type-identifier': 'public.json',
      },
    ],
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

// How the system splash draws its icon (no icon background), so the still lands
// exactly where the overlay's first frame will be. Only a centered circle of
// ANDROID_ICON_VISIBLE dp is visible on every version.
// - Android 12+: the icon is laid out in a 108dp box and scaled up to 192dp.
// - Android 7–11 (AndroidX backport): drawn 1:1 in a 288dp box.
const ANDROID_ICON_VISIBLE = 192;
const ANDROID_ICON = {
  v31: { canvas: 108, scale: 108 / 192 },
  legacy: { canvas: 288, scale: 1 },
};

/** The still image, centered at the animation's on-screen size inside the splash icon. */
function androidIconXml(o, { canvas, scale }) {
  const dp = (n) => `${+(n * scale).toFixed(2)}dp`;
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by react-native-splash-motion. -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="@android:color/transparent" />
            <size android:width="${canvas}dp" android:height="${canvas}dp" />
        </shape>
    </item>
    <item
        android:width="${dp(o.width)}"
        android:height="${dp(o.height)}"
        android:gravity="center"
        android:drawable="@drawable/splashmotion_still" />
</layer-list>
`;
}

/** Android files: assets + colors (shared by the CLI and the Expo plugin). */
function generateAndroidFiles(projectRoot, o) {
  const main = androidMain(projectRoot);
  if (!fs.existsSync(main)) throw new Error(`${LOG} Could not find ${main}`);

  const assetsDir = path.join(main, 'assets', 'splashmotion');
  fs.rmSync(assetsDir, { recursive: true, force: true });
  const animFile = 'animation.json';
  write(path.join(assetsDir, animFile), o.data);
  writeJson(path.join(assetsDir, 'config.json'), runtimeConfig(o, animFile));

  write(
    path.join(main, 'res', 'values', 'splashmotion_colors.xml'),
    colorsXml(o.background.hex)
  );

  const icon = path.join(main, 'res', 'drawable', 'splashmotion_icon.xml');
  const iconV31 = path.join(
    main,
    'res',
    'drawable-v31',
    'splashmotion_icon.xml'
  );
  const still = path.join(
    main,
    'res',
    'drawable-nodpi',
    'splashmotion_still.png'
  );
  if (o.still) {
    write(still, fs.readFileSync(o.still));
    write(icon, androidIconXml(o, ANDROID_ICON.legacy));
    write(iconV31, androidIconXml(o, ANDROID_ICON.v31));
    if (Math.hypot(o.width, o.height) > ANDROID_ICON_VISIBLE) {
      console.warn(
        `${LOG} Android only shows a ${ANDROID_ICON_VISIBLE}dp circle of the launch-screen still, so its corners ` +
          `are hidden until the animation starts. Keep the artwork inside that circle, or use a width ≤ ` +
          `${Math.floor(ANDROID_ICON_VISIBLE / Math.hypot(1, o.height / o.width))} to show all of it.`
      );
    }
  } else {
    fs.rmSync(still, { force: true });
    fs.rmSync(icon, { force: true });
    fs.rmSync(iconV31, { force: true });
  }

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
  if (!activity)
    throw new Error(
      `${LOG} Could not find .MainActivity in AndroidManifest.xml`
    );

  const current = activity[0].match(/android:theme="([^"]+)"/);
  const appTheme = manifest.match(/<application\b[^>]*android:theme="([^"]+)"/);
  let postTheme = '@style/AppTheme';
  if (current && current[1] !== '@style/SplashMotionTheme')
    postTheme = current[1];
  else if (appTheme && appTheme[1] !== '@style/SplashMotionTheme')
    postTheme = appTheme[1];

  const patchedActivity = current
    ? activity[0].replace(
        current[0],
        'android:theme="@style/SplashMotionTheme"'
      )
    : activity[0].replace(
        '<activity',
        '<activity\n        android:theme="@style/SplashMotionTheme"'
      );
  manifest = manifest.replace(activity[0], patchedActivity);
  fs.writeFileSync(manifestPath, manifest);

  let styles = fs.readFileSync(stylesPath, 'utf8');
  styles = styles.replace(
    /\s*<style name="SplashMotionTheme"[\s\S]*?<\/style>/,
    ''
  );
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
