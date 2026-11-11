import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveOptions } from '../core';
import {
  makeLottie,
  makeZip,
  removeTempDirs,
  shapeLayer,
  tempDir,
  writeDotLottie,
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

function animationFile(source: string) {
  const o = resolveOptions(root, { source });
  return JSON.parse(o.data.toString('utf8'));
}

function dotLottieEntry(id: string, lottie: unknown) {
  return { name: `a/${id}.json`, data: JSON.stringify(lottie) };
}

describe('dotLottie — archive layouts', () => {
  it('reads a v2 archive (a/<id>.json)', () => {
    const source = writeDotLottie(root, [
      {
        name: 'manifest.json',
        data: JSON.stringify({ animations: [{ id: 'intro' }] }),
      },
      dotLottieEntry('intro', makeLottie({ w: 400, h: 200 })),
    ]);
    const o = resolveOptions(root, { source });
    expect(o.width).toBe(160);
    expect(o.height).toBe(80);
    expect(animationFile(source).w).toBe(400);
  });

  it('reads a v1 archive (animations/<id>.json)', () => {
    const source = writeDotLottie(root, [
      {
        name: 'manifest.json',
        data: JSON.stringify({ animations: [{ id: 'intro' }] }),
      },
      {
        name: 'animations/intro.json',
        data: JSON.stringify(makeLottie({ w: 100, h: 100 })),
      },
    ]);
    expect(animationFile(source).w).toBe(100);
  });

  it('finds the animation without a manifest', () => {
    const source = writeDotLottie(root, [
      {
        name: 'animations/solo.json',
        data: JSON.stringify(makeLottie({ w: 120, h: 60 })),
      },
    ]);
    expect(animationFile(source).w).toBe(120);
  });

  it('reads deflate-compressed entries', () => {
    const source = writeDotLottie(root, [
      {
        name: 'manifest.json',
        data: JSON.stringify({ animations: [{ id: 'intro' }] }),
        deflate: true,
      },
      { ...dotLottieEntry('intro', makeLottie()), deflate: true },
    ]);
    expect(animationFile(source).layers).toBeDefined();
  });

  it('rejects a file that is not a ZIP archive', () => {
    const source = path.join(root, 'splash.lottie');
    fs.writeFileSync(source, 'definitely not a zip');
    expect(() => resolveOptions(root, { source })).toThrow(
      /not a valid \.lottie file/
    );
  });

  it('rejects an archive without an animation', () => {
    const source = writeDotLottie(root, [
      { name: 'manifest.json', data: '{}' },
    ]);
    expect(() => resolveOptions(root, { source })).toThrow(
      /doesn't contain a Lottie animation/
    );
  });

  it('rejects an archive with a corrupt animation', () => {
    const source = writeDotLottie(root, [
      { name: 'a/broken.json', data: '{nope' },
    ]);
    expect(() => resolveOptions(root, { source })).toThrow(
      /contains an invalid Lottie animation/
    );
  });
});

describe('dotLottie — multiple animations', () => {
  const files = (activeAnimationId?: string) => [
    {
      name: 'manifest.json',
      data: JSON.stringify({
        animations: [{ id: 'one' }, { id: 'two' }],
        ...(activeAnimationId ? { activeAnimationId } : {}),
      }),
    },
    dotLottieEntry('one', makeLottie({ w: 111 })),
    dotLottieEntry('two', makeLottie({ w: 222 })),
  ];

  it('uses the active animation and warns about the others', () => {
    const source = writeDotLottie(root, files('two'));
    expect(animationFile(source).w).toBe(222);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('has 2 animations')
    );
  });

  it('falls back to the first animation without an active id', () => {
    const source = writeDotLottie(root, files());
    expect(animationFile(source).w).toBe(111);
  });
});

describe('dotLottie — bundled images', () => {
  it('inlines images as data URIs (images/ layout)', () => {
    const withAssets = {
      ...makeLottie({ layers: [shapeLayer()] }),
      assets: [{ p: 'img.png', u: 'images/', e: 0 }],
    };
    const source = writeDotLottie(root, [
      dotLottieEntry('intro', withAssets),
      { name: 'images/img.png', data: Buffer.from([1, 2, 3]) },
    ]);
    const [asset] = animationFile(source).assets;
    expect(asset.p).toBe('data:image/png;base64,AQID');
    expect(asset.u).toBe('');
    expect(asset.e).toBe(1);
  });

  it('supports the i/ layout and other mime types', () => {
    const source = writeDotLottie(root, [
      dotLottieEntry('intro', {
        ...makeLottie(),
        assets: [{ p: 'photo.webp', u: '', e: 0 }],
      }),
      { name: 'i/photo.webp', data: Buffer.from([9]) },
    ]);
    expect(animationFile(source).assets[0].p).toBe(
      'data:image/webp;base64,CQ=='
    );
  });

  it('leaves already-embedded assets alone', () => {
    const embedded = { p: 'data:image/png;base64,AAAA', u: '', e: 1 };
    const source = writeDotLottie(root, [
      dotLottieEntry('intro', { ...makeLottie(), assets: [embedded] }),
    ]);
    expect(animationFile(source).assets[0]).toEqual(embedded);
  });

  it('leaves assets whose image is missing from the archive', () => {
    const missing = { p: 'gone.png', u: 'images/', e: 0 };
    const source = writeDotLottie(root, [
      dotLottieEntry('intro', { ...makeLottie(), assets: [missing] }),
    ]);
    expect(animationFile(source).assets[0]).toEqual(missing);
  });
});

describe('dotLottie — background removal still applies', () => {
  it('strips background solids from the unpacked animation', () => {
    const source = writeDotLottie(root, [
      dotLottieEntry(
        'intro',
        makeLottie({
          layers: [
            shapeLayer(),
            {
              ty: 1,
              nm: 'BG',
              ind: 2,
              sw: 200,
              sh: 100,
              sc: '#ffffff',
              ks: {
                o: { a: 0, k: 100 },
                r: { a: 0, k: 0 },
                p: { a: 0, k: [100, 50] },
                a: { a: 0, k: [100, 50] },
                s: { a: 0, k: [100, 100] },
              },
            },
          ],
        })
      ),
    ]);
    expect(animationFile(source).layers).toHaveLength(1);
  });

  it('builds a valid archive with the test helper (sanity check)', () => {
    const zip = makeZip([{ name: 'hello.txt', data: 'hi' }]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  });
});
