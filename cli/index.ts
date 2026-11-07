#!/usr/bin/env node
import path from 'path';
import * as core from './core';

const HELP = `
  Usage: npx splash-motion generate <animation> [options]

  Generates everything your app needs to show a native animated splash.
  <animation> is a Lottie .json or a dotLottie .lottie file.

  Options:
    --background <hex>        Background color              (default: #FFFFFF)
    --width <number>          Animation width in dp/pt      (default: 160)
    --height <number>         Animation height in dp/pt     (default: keeps aspect ratio)
                              Scaled down at runtime to fit 90% of the screen
    --still <png>             Your animation's first frame, shown by the system
                              launch screen (iOS + Android) before the app starts
    --loop-marker <name>      Only loop this marker's range
    --no-loop                 Play once and hold the last frame
    --keep-background         Keep a full-canvas background solid in the
                              animation (removed by default)
    --platforms <list>        ios,android                   (default: both)
    --project-root <path>     Your app's root folder        (default: current directory)

  Example:
    npx splash-motion generate assets/splash.json --background "#0F6E56" --width 200
`;

const BOOLEAN_FLAGS = new Set(['keep-background']);

type Flags = Record<string, string | boolean | undefined>;

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '-h' || arg === '--help') {
      flags.help = true;
    } else if (BOOLEAN_FLAGS.has(arg.slice(2))) {
      flags[toCamel(arg.slice(2))] = true;
    } else if (arg.startsWith('--no-')) {
      flags[toCamel(arg.slice(5))] = false;
    } else if (arg.startsWith('--')) {
      const [key = '', inline] = arg.slice(2).split('=');
      const value = inline ?? argv[++i];
      if (value === undefined)
        throw new Error(`${core.LOG} Missing value for --${key}`);
      flags[toCamel(key)] = value;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function toCamel(s: string) {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, source] = positional;

  if (flags.help || !command) {
    console.log(HELP);
    return;
  }
  if (command !== 'generate') {
    throw new Error(
      `${core.LOG} Unknown command "${command}". Run with --help.`
    );
  }

  const projectRoot = path.resolve(
    typeof flags.projectRoot === 'string' ? flags.projectRoot : process.cwd()
  );
  const platforms = String(flags.platforms ?? 'ios,android')
    .split(',')
    .map((p) => p.trim());
  // Flags are untyped argv strings; resolveOptions validates them.
  const options = core.resolveOptions(projectRoot, {
    ...flags,
    source,
  } as core.SplashOptions);

  console.log(
    `\n✨ SplashMotion — Lottie splash (${options.width}×${options.height})\n`
  );

  if (platforms.includes('ios')) {
    const { storyboard } = core.generateIos(projectRoot, options);
    console.log(
      `  ✓ iOS      assets + ${path.relative(projectRoot, storyboard)}`
    );
  }
  if (platforms.includes('android')) {
    core.generateAndroidFiles(projectRoot, options);
    core.patchAndroidProject(projectRoot);
    console.log('  ✓ Android  assets, colors, theme and manifest');
  }

  console.log(`
  Next steps:
    1. cd ios && pod install
    2. Rebuild the app (a JS reload is not enough)
    3. Call SplashMotion.hide() when your app is ready
`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
