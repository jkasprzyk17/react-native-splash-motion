# react-native-splash-motion

**Animated Lottie & Rive splash screens for React Native — rendered natively, _before_ your JavaScript loads.**

Most "animated splash" solutions render the animation with React, so it can only start once the JS bundle has loaded. Until then your users stare at a static image. SplashMotion plays your animation in a native view from the very first frames of app launch, keeps it running **while** the bundle loads, and hands off to your app with a polished outro.

- 🎬 **Lottie, dotLottie or Rive** — bring the file your designer exported (`.json`, `.lottie` or `.riv`)
- ⚡ **Native from frame one** — Core Animation on iOS, off-main-thread rendering on Android
- 🪄 **Zero native code** — no `AppDelegate` / `MainActivity` edits, it wires itself up
- 🧩 **Expo & bare React Native** — config plugin + CLI share the same generator
- 🔥 **New Architecture only**, built on [Nitro Modules](https://nitro.margelo.com)
- 🎯 **Smart exit** — finishes the current loop, plays your outro, then fades
- 🕹️ **Interactive Rive** — drive state machine inputs (e.g. a progress bar) while your app boots
- 🪶 **Ships one runtime** — only Lottie _or_ Rive is compiled into your app, auto-detected

## Requirements

- React Native with the **New Architecture** enabled (the default since 0.76)
- [`react-native-nitro-modules`](https://github.com/mrousavy/nitro)
- iOS 15+ · Android 7+ (API 24)
- Expo: a development build (Expo Go can't load custom native code)

## Installation

```sh
npm install react-native-splash-motion react-native-nitro-modules
```

## Your animation file

Put the file anywhere in your project (e.g. `assets/splash.json`) and point the CLI or Expo plugin at it. The format is picked from the extension:

| Format    | Extension | Where it comes from                                                 |
| --------- | --------- | ------------------------------------------------------------------- |
| Lottie    | `.json`   | After Effects + Bodymovin, or "Lottie JSON" download on LottieFiles |
| dotLottie | `.lottie` | "dotLottie" download on LottieFiles, or any dotLottie v1/v2 export  |
| Rive      | `.riv`    | Export from the Rive editor                                         |

- **`.lottie`** files are unpacked at build time into plain Lottie JSON. Images bundled inside are embedded, so they render as-is. If the file contains several animations, the active one (or the first) is used.
- **`.riv`** files can also use state machines and inputs. See [Driving a Rive state machine](#driving-a-rive-state-machine).
- The animation is copied into the native project when you run the generator, so after replacing the file, run it again and rebuild.

See [Designing your animation](#designing-your-animation) for markers (`loop`, `outro`) and other tips.

### Size

The animation is drawn at a fixed size, centered on the splash background. Sizes are in points on iOS and dp on Android.

| Option     | Default                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| `--width`  | `160`                                                                                     |
| `--height` | Lottie (`.json` / `.lottie`): follows the file's own aspect ratio. Rive: same as `width`. |

Both must be positive numbers; decimals are fine. There is no upper limit, but at runtime the animation is **scaled down to fit 90% of the screen's width and height**, keeping its aspect ratio, so a large value never gets cut off (on phones, in landscape or in split-screen). It is never scaled up, so on tablets it stays at the size you set. The iOS launch-screen `--still` image follows the same rule, so the hand-off doesn't jump.

Since Rive files don't tell the CLI their aspect ratio, pass `--height` for non-square Rive artboards.

### Bare React Native

Generate the splash from your animation, then rebuild:

```sh
npx splash-motion generate assets/splash.json --background "#0F6E56"
cd ios && pod install
```

That's it — there is no native code to add.

### Expo

Remove `expo-splash-screen` (SplashMotion replaces it), then add the plugin:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-splash-motion",
        {
          "source": "./assets/splash.json",
          "background": "#0F6E56",
          "darkBackground": "#04342C",
          "width": 200
        }
      ]
    ]
  }
}
```

```sh
npx expo prebuild --clean
```

## Usage

Hide the splash once your app is ready:

```tsx
import SplashMotion from 'react-native-splash-motion';

<NavigationContainer onReady={() => SplashMotion.hide()}>
  {/* … */}
</NavigationContainer>
```

Or with the hook:

```tsx
import { useHideSplash } from 'react-native-splash-motion';

function App() {
  const [fontsLoaded] = useFonts(fonts);
  useHideSplash(fontsLoaded, { outro: 'outro' });
  // …
}
```

### Driving a Rive state machine

```ts
// While downloading remote config, fill a progress bar inside the animation
SplashMotion.setInput('progress', 0.42); // number input
SplashMotion.setInput('isDark', true); // boolean input
SplashMotion.trigger('wave'); // trigger input
```

## API

### `hide(options?): Promise<void>`

Resolves once the splash is fully gone. All options are optional.

| Option          | Default | Description                                                                    |
| --------------- | ------- | ------------------------------------------------------------------------------ |
| `waitForLoop`   | `true`  | Let the current loop finish instead of cutting the animation mid-motion.       |
| `outro`         | —       | Lottie: a **marker** name to play before leaving. Rive: a **trigger** to fire. |
| `outroDuration` | `600`   | Rive only: how long the outro lasts, in ms.                                    |
| `minDuration`   | `0`     | Keep the splash visible at least this long (ms since launch).                  |
| `fade`          | `220`   | Fade-out duration in ms. `0` disables it.                                      |

Order of events: `minDuration` → finish loop → `outro` → `fade`.

### `isVisible(): boolean`

### `setInput(name, value: number | boolean)` · `trigger(name)`

Rive only. No-ops for Lottie.

### `useHideSplash(ready?: boolean, options?)`

Calls `hide(options)` as soon as `ready` is `true`.

## CLI

```
npx splash-motion generate <animation> [options]

  <animation>               A Lottie .json, a dotLottie .lottie or a Rive .riv file

  --background <hex>        Background color              (default: #FFFFFF)
  --dark-background <hex>   Background color in dark mode
  --width <number>          Animation width in dp/pt      (default: 160)
  --height <number>         Animation height in dp/pt     (default: keeps aspect ratio)
                            Scaled down at runtime to fit 90% of the screen
  --still <png>             Image for the iOS launch screen (your first frame)
  --loop-marker <name>      Lottie: only loop this marker's range
  --no-loop                 Play once and hold the last frame
  --state-machine <name>    Rive: state machine           (default: "State Machine 1")
  --artboard <name>         Rive: artboard                (default: first one)
  --platforms <list>        ios,android                   (default: both)
```

The Expo plugin accepts the same options in camelCase (`darkBackground`, `loopMarker`, …) plus `source`.

## Designing your animation

**Lottie / dotLottie** — add markers in After Effects (or LottieFiles):

- `loop` → the section that repeats while the app loads (`--loop-marker loop`)
- `outro` → the exit, played by `hide({ outro: 'outro' })`

Design frame 0 to sit on the same background color as your splash so the launch is seamless.

**Rive** — build a state machine (default name `State Machine 1`) with an idle loop, and a trigger (e.g. `outro`) that transitions to your exit animation. Add number/boolean inputs if you want to drive it from JS.

## How it works

```
Tap icon ─▶ OS launch screen ─▶ native overlay (animation playing) ─▶ hide() ─▶ outro ─▶ your app
            (static, generated)   └── JS bundle loads in parallel ──┘
```

1. **Build time** — the CLI / Expo plugin copies your animation (unpacking a `.lottie` to JSON) into the app's asset catalog (iOS) and `assets/` (Android), generates a matching launch screen and theme, and records the config.
2. **Launch** — the OS shows the static launch screen. SplashMotion installs itself automatically (`+load` on iOS, an init `ContentProvider` on Android), attaches a native overlay to the first window and starts the animation. On Android the system splash is held until the animation's first frame is ready, so the hand-off is invisible.
3. **JS ready** — `hide()` goes through Nitro straight to Swift/Kotlin, which runs the exit sequence and removes the overlay.

## Testing

```js
// jest.setup.js
jest.mock('react-native-splash-motion', () => ({
  __esModule: true,
  default: {
    hide: jest.fn().mockResolvedValue(undefined),
    isVisible: jest.fn(() => false),
    setInput: jest.fn(),
    trigger: jest.fn(),
  },
  useHideSplash: jest.fn(),
}));
```

## Troubleshooting

- **Nothing changed** — native assets only update on a rebuild. Re-run `pod install` and rebuild; a JS reload isn't enough.
- **Expo shows the old splash** — make sure `expo-splash-screen` is removed, then `npx expo prebuild --clean`.
- **Switched between Lottie and Rive** — re-run `pod install` / a Gradle sync so the right runtime is linked.

## Roadmap

- Automatic first-frame extraction for the launch screen
- Per-platform animations and sizes

## Contributing

See the [contributing guide](CONTRIBUTING.md). After changing `src/SplashMotion.nitro.ts`, run `yarn nitrogen`.

## License

MIT
