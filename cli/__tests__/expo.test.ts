import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { expoSplashScreenUsage } from '../core';
import { removeTempDirs, tempDir } from './helpers';

let root: string;

afterEach(removeTempDirs);

function writePackage(
  dependencies?: Record<string, string>,
  devDependencies?: Record<string, string>
) {
  root = tempDir();
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ dependencies, devDependencies })
  );
}

describe('expoSplashScreenUsage', () => {
  it('returns no conflict without the dependency or plugin', () => {
    writePackage({ 'react-native': '0.88.0' });
    expect(expoSplashScreenUsage(root, ['expo-router'])).toEqual([]);
  });

  it('detects dependencies and devDependencies', () => {
    writePackage({ 'expo-splash-screen': '~58.0.0' });
    expect(expoSplashScreenUsage(root)).toEqual(['dependency']);
    writePackage(undefined, { 'expo-splash-screen': '~58.0.0' });
    expect(expoSplashScreenUsage(root)).toEqual(['dependency']);
  });

  it('detects string and tuple Expo plugin entries', () => {
    writePackage();
    expect(expoSplashScreenUsage(root, ['expo-splash-screen'])).toEqual([
      'plugin',
    ]);
    expect(
      expoSplashScreenUsage(root, [['expo-splash-screen', { image: 'x.png' }]])
    ).toEqual(['plugin']);
  });

  it('reports both locations together so callers can warn once', () => {
    writePackage({ 'expo-splash-screen': '~58.0.0' });
    expect(expoSplashScreenUsage(root, ['expo-splash-screen'])).toEqual([
      'dependency',
      'plugin',
    ]);
  });

  it('handles a missing package.json', () => {
    root = tempDir();
    expect(expoSplashScreenUsage(root)).toEqual([]);
  });
});
