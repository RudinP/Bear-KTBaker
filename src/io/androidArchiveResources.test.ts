import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import {
  androidPngCandidates,
  androidResourceIdentity,
  createAndroidArchiveIndex,
  fingerprintAndroidPng,
  normalizeAndroidArchivePath,
} from './androidArchiveResources';
import { buildNinePatchPng } from './ninePatchPng';

function rgbaPng(pixels: number[][], width: number, height: number) {
  const image = new PNG({ width, height });
  pixels.forEach((pixel, index) => image.data.set(pixel, index * 4));
  return PNG.sync.write(image);
}

describe('Android archive resource lookup', () => {
  it('normalizes separators and rejects traversal', () => {
    expect(normalizeAndroidArchivePath('.\\res\\drawable-xxhdpi-v31\\bubble.9.png'))
      .toBe('res/drawable-xxhdpi-v31/bubble.9.png');
    expect(() => normalizeAndroidArchivePath('../res/drawable/bubble.png'))
      .toThrow('안전하지 않은 Android 압축 경로');
    expect(() => normalizeAndroidArchivePath('/res/drawable/bubble.png'))
      .toThrow('안전하지 않은 Android 압축 경로');
  });

  it('derives one semantic identity from source and compiled paths', () => {
    expect(androidResourceIdentity('src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png'))
      .toMatchObject({
        key: 'drawable/theme_chatroom_bubble_me_01_image',
        semanticQualifier: 'drawable-xxhdpi',
        fileName: 'theme_chatroom_bubble_me_01_image.9.png',
      });
    expect(androidResourceIdentity('res/drawable-xxhdpi-v4/theme_chatroom_bubble_me_01_image.9.png'))
      .toMatchObject({
        key: 'drawable/theme_chatroom_bubble_me_01_image',
        semanticQualifier: 'drawable-xxhdpi',
      });
    expect(androidResourceIdentity('src/main/ic_launcher-web.png')).toBeUndefined();
  });

  it('rejects traversal preserved by JSZip after load sanitizes the entry name', async () => {
    const source = new JSZip();
    source.file('../res/drawable/theme_background_image.png', 'unsafe');
    const loaded = await JSZip.loadAsync(await source.generateAsync({ type: 'nodebuffer' }));
    expect(loaded.file('res/drawable/theme_background_image.png')).toBeDefined();
    expect(() => createAndroidArchiveIndex(loaded, 'apk'))
      .toThrow('안전하지 않은 Android 압축 경로');
  });

  it.each([
    {
      kind: 'source' as const,
      archivePath: 'res/drawable-xxhdpi-v4/theme_background_image.png',
      bindingPath: 'src/main/theme/drawable-xxhdpi/theme_background_image.png',
    },
    {
      kind: 'apk' as const,
      archivePath: 'src/main/theme/drawable-xxhdpi/theme_background_image.png',
      bindingPath: 'src/main/theme/drawable-xxhdpi/theme_background_image.png',
    },
  ])('does not return $archivePath from a $kind index', ({ kind, archivePath, bindingPath }) => {
    const zip = new JSZip();
    zip.file(archivePath, 'wrong archive representation');
    const index = createAndroidArchiveIndex(zip, kind);

    expect(androidPngCandidates({ index, kind, bindingFiles: [bindingPath] })).toEqual([]);
    expect(index.identity(archivePath)).toBeUndefined();
  });

  it('indexes one wrapped source while excluding Finder metadata from roots and lookup', () => {
    const zip = new JSZip();
    const resource = 'theme-project/src/main/theme/drawable-xxhdpi/theme_background_image.png';
    const macosx = '__MACOSX/theme-project/src/main/theme/drawable-xxhdpi/._theme_background_image.png';
    const appleDouble = 'theme-project/src/main/theme/drawable-xxhdpi/._theme_background_image.png';
    const appleDoubleDirectory = 'theme-project/.AppleDouble/src/main/theme/drawable-xxhdpi/theme_background_image.png';
    zip.file(resource, 'png');
    zip.file(macosx, 'finder metadata');
    zip.file(appleDouble, 'finder metadata');
    zip.file(appleDoubleDirectory, 'finder metadata');

    const index = createAndroidArchiveIndex(zip, 'source');

    expect(index.find('src/main/theme/drawable-xxhdpi/theme_background_image.png')).toBeDefined();
    expect(index.find(macosx)).toBeUndefined();
    expect(index.find(appleDouble)).toBeUndefined();
    expect(index.find(appleDoubleDirectory)).toBeUndefined();
    expect(index.resourceEntries('drawable', 'theme_background_image').map(({ path }) => path))
      .toEqual([resource]);
  });

  it('rejects unsafeOriginalName traversal before excluding Finder metadata', async () => {
    const source = new JSZip();
    source.file(
      '../__MACOSX/theme-project/src/main/theme/drawable-xxhdpi/._theme_background_image.png',
      'unsafe finder metadata',
    );
    const loaded = await JSZip.loadAsync(await source.generateAsync({ type: 'nodebuffer' }));

    expect(() => createAndroidArchiveIndex(loaded, 'source'))
      .toThrow('안전하지 않은 Android 압축 경로');
  });

  it('finds a case-varied backslash entry through a metadata path', async () => {
    const zip = new JSZip();
    zip.file('RES\\DRAWABLE-XXHDPI-V31\\THEME_BACKGROUND_IMAGE.PNG', Buffer.from('png'));
    const index = createAndroidArchiveIndex(zip, 'apk');
    const candidates = androidPngCandidates({
      index,
      kind: 'apk',
      bindingFiles: ['src/main/theme/drawable-xxhdpi/theme_background_image.png'],
      resourceFiles: {
        'drawable/theme_background_image': [
          'res/drawable/theme_background_image.xml',
          'res/drawable-xxhdpi-v31/theme_background_image.png',
        ],
      },
    });
    expect(candidates.map(({ path }) => path)).toEqual([
      'RES/DRAWABLE-XXHDPI-V31/THEME_BACKGROUND_IMAGE.PNG',
    ]);
  });

  it('accepts one source wrapper root and rejects normalized collisions', () => {
    const wrapped = new JSZip();
    wrapped.file('theme-project/src/main/theme/drawable-xxhdpi/theme_background_image.png', 'png');
    const wrappedIndex = createAndroidArchiveIndex(wrapped, 'source');
    expect(wrappedIndex.find('src/main/theme/drawable-xxhdpi/theme_background_image.png')).toBeDefined();
    expect(wrappedIndex.resourceEntries('drawable', 'theme_background_image')[0]?.identity)
      .toMatchObject({ sourcePath: 'src/main/theme/drawable-xxhdpi/theme_background_image.png' });

    const collided = new JSZip();
    collided.file('res/drawable/Icon.png', 'one');
    collided.file('RES/DRAWABLE/icon.png', 'two');
    expect(() => createAndroidArchiveIndex(collided, 'apk')).toThrow('Android 압축 경로가 충돌');
  });

  it('never returns the same basename from a different resource type', () => {
    const zip = new JSZip();
    zip.file('res/mipmap-xxhdpi-v4/theme_background_image.png', 'wrong type');
    const index = createAndroidArchiveIndex(zip, 'apk');
    expect(index.resourceEntries('drawable', 'theme_background_image')).toEqual([]);
  });

  it('keeps ARSC references ahead of a preferred binding qualifier fallback', () => {
    const zip = new JSZip();
    zip.file('res/drawable-xxhdpi-v4/theme_background_image.png', 'fallback');
    zip.file('res/drawable-sw600dp-v31/theme_background_image.png', 'metadata');
    const index = createAndroidArchiveIndex(zip, 'apk');
    const candidates = androidPngCandidates({
      index,
      kind: 'apk',
      bindingFiles: [
        'src/main/theme/drawable-xxhdpi/theme_background_image.png',
        'src/main/theme/drawable-sw600dp/theme_background_image.png',
      ],
      resourceFiles: { 'drawable/theme_background_image': [
        'res/drawable-sw600dp-v31/theme_background_image.png',
      ] },
    });
    expect(candidates.map(({ path }) => path)).toEqual([
      'res/drawable-sw600dp-v31/theme_background_image.png',
      'res/drawable-xxhdpi-v4/theme_background_image.png',
    ]);
  });

  it('rejects a source root nested below two wrapper directories', () => {
    const zip = new JSZip();
    zip.file('outer/inner/src/main/theme/drawable-xxhdpi/theme_background_image.png', 'png');
    expect(() => createAndroidArchiveIndex(zip, 'source')).toThrow('Android 소스 ZIP 루트');
  });

  it('ignores unrelated nested files while accepting one source wrapper', () => {
    const zip = new JSZip();
    zip.file('docs/outer/inner/readme.txt', 'notes');
    zip.file('theme-project/src/main/theme/drawable-xxhdpi/theme_background_image.png', 'png');
    expect(createAndroidArchiveIndex(zip, 'source')
      .find('src/main/theme/drawable-xxhdpi/theme_background_image.png')).toBeDefined();
  });

  it('rejects two distinct Android source wrapper roots', () => {
    const zip = new JSZip();
    zip.file('first/src/main/theme/drawable-xxhdpi/theme_background_image.png', 'one');
    zip.file('second/src/main/theme/drawable-xxhdpi/theme_chatroom_background_image.png', 'two');
    expect(() => createAndroidArchiveIndex(zip, 'source')).toThrow('Android 소스 ZIP 루트');
  });

  it('fingerprints re-encoded pixels identically and ignores transparent RGB noise', () => {
    const left = rgbaPng([[10, 20, 30, 0], [40, 50, 60, 255]], 2, 1);
    const right = rgbaPng([[200, 210, 220, 0], [40, 50, 60, 255]], 2, 1);
    expect(fingerprintAndroidPng(left, false)).toEqual(fingerprintAndroidPng(right, false));
  });

  it('fingerprints a source nine-patch by its visible interior', () => {
    const interior = rgbaPng([[90, 20, 30, 255]], 1, 1);
    const source = buildNinePatchPng(interior, {
      stretch: { x: [0, 1], y: [0, 1] },
      content: { left: 0, top: 0, right: 1, bottom: 1 },
    });
    expect(fingerprintAndroidPng(source, true)).toEqual(fingerprintAndroidPng(interior, false));
  });
});
