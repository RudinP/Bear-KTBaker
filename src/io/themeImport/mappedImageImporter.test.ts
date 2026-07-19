import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { guidesToAndroidMarkers, type NinePatchGuides } from '../../domain/ninePatch';
import { createAndroidArchiveIndex } from '../androidArchiveResources';
import { buildNinePatchPng } from '../ninePatchPng';
import { importMappedImages } from './mappedImageImporter';

function solidPng(red: number, width = 2, height = 2) {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data.set([red, 20, 30, 255], offset);
  }
  return PNG.sync.write(png);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function compiledNinePatchPng(interior: Buffer, guides: NinePatchGuides) {
  const decoded = PNG.sync.read(interior);
  const markers = guidesToAndroidMarkers(guides, decoded.width, decoded.height);
  const colors = [1];
  const payload = Buffer.alloc(
    32 + (markers.stretchX.length + markers.stretchY.length + colors.length) * 4,
  );
  payload[1] = markers.stretchX.length;
  payload[2] = markers.stretchY.length;
  payload[3] = colors.length;
  payload.writeUInt32BE(markers.contentX[0], 12);
  payload.writeUInt32BE(decoded.width - markers.contentX[1], 16);
  payload.writeUInt32BE(markers.contentY[0], 20);
  payload.writeUInt32BE(decoded.height - markers.contentY[1], 24);
  [...markers.stretchX, ...markers.stretchY, ...colors].forEach((value, index) => {
    payload.writeUInt32BE(value, 32 + index * 4);
  });
  const type = Buffer.from('npTc');
  const chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length, 0);
  type.copy(chunk, 4);
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, payload])), payload.length + 8);
  const encoded = PNG.sync.write(decoded);
  let iendOffset = 8;
  while (encoded.toString('ascii', iendOffset + 4, iendOffset + 8) !== 'IEND') {
    iendOffset += encoded.readUInt32BE(iendOffset) + 12;
  }
  return Buffer.concat([encoded.subarray(0, iendOffset), chunk, encoded.subarray(iendOffset)]);
}

describe('mapped image importer', () => {
  it('prefers an iOS CSS reference over the catalog filename', async () => {
    const custom = solidPng(12);
    const catalog = solidPng(200);
    const zip = new JSZip();
    zip.file('Images/customMain@3x.png', custom);
    zip.file('Images/mainBgImage@3x.png', catalog);

    const result = await importMappedImages({
      platform: 'ios',
      archiveKind: 'ios',
      zip,
      referencedFiles: { 'main.background': ['Images/customMain@3x.png'] },
    });

    expect(result.mappedIds).toEqual(new Set(['main.background']));
    expect(result.images[0]).toMatchObject({
      resourceId: 'main.background',
      asset: {
        fileName: 'customMain@3x.png',
        dataUrl: `data:image/png;base64,${custom.toString('base64')}`,
        sourceScale: 3,
        rawNinePatch: false,
      },
    });
  });

  it('prefers iOS @3x, then @2x, then suffixless referenced images', async () => {
    const references = [
      'Images/customTab@3x.png',
      'Images/customTab@2x.png',
      'Images/customTab.png',
    ];
    const files = [
      ['Images/customTab@3x.png', solidPng(30)],
      ['Images/customTab@2x.png', solidPng(20)],
      ['Images/customTab.png', solidPng(10)],
    ] as const;

    for (const [removed, expectedFile, expectedScale] of [
      [0, 'customTab@3x.png', 3],
      [1, 'customTab@2x.png', 2],
      [2, 'customTab.png', 1],
    ] as const) {
      const zip = new JSZip();
      for (const [name, png] of files.slice(removed)) zip.file(name, png);
      const result = await importMappedImages({
        platform: 'ios',
        archiveKind: 'ios',
        zip,
        referencedFiles: { 'main.tab.background': references },
      });

      expect(result.images.find(({ resourceId }) => resourceId === 'main.tab.background')?.asset)
        .toMatchObject({ fileName: expectedFile, sourceScale: expectedScale });
    }
  });

  it('uses an Android compiled metadata path before constrained binding fallbacks', async () => {
    const metadataImage = solidPng(40);
    const fallbackImage = solidPng(180);
    const zip = new JSZip();
    zip.file('res/drawable-xxhdpi-v4/theme_background_image.png', fallbackImage);
    zip.file('res/drawable-sw600dp-v13/theme_background_image.png', metadataImage);
    const androidIndex = createAndroidArchiveIndex(zip, 'apk');

    const result = await importMappedImages({
      platform: 'android',
      archiveKind: 'apk',
      zip,
      androidIndex,
      resourceFiles: {
        'drawable/theme_background_image': [
          'res/drawable-sw600dp-v13/theme_background_image.png',
        ],
      },
    });

    expect(result.images.find(({ resourceId }) => resourceId === 'main.background')?.asset.dataUrl)
      .toBe(`data:image/png;base64,${metadataImage.toString('base64')}`);
  });

  it('prefers the Android phone main-tab icon over its tablet variant in source archives', async () => {
    const phone = solidPng(60);
    const tablet = solidPng(160);
    const zip = new JSZip();
    zip.file(
      'src/main/theme/drawable-xxhdpi/theme_maintab_ico_now_image.png',
      phone,
    );
    zip.file(
      'src/main/theme/drawable-sw600dp/theme_maintab_ico_now_image.png',
      tablet,
    );
    const androidIndex = createAndroidArchiveIndex(zip, 'source');

    const result = await importMappedImages({
      platform: 'android',
      archiveKind: 'source',
      zip,
      androidIndex,
    });

    expect(result.images.find(({ resourceId }) => resourceId === 'main.tab.now.normal')?.asset)
      .toMatchObject({
        fileName: 'theme_maintab_ico_now_image.png',
        dataUrl: `data:image/png;base64,${phone.toString('base64')}`,
        sourceScale: 3,
      });
  });

  it('continues from a corrupt Android candidate to a valid PNG', async () => {
    const valid = solidPng(80);
    const zip = new JSZip();
    zip.file('res/drawable-xxhdpi-v4/theme_background_image.png', Buffer.from('not a png'));
    zip.file('res/drawable-sw600dp-v13/theme_background_image.png', valid);
    const androidIndex = createAndroidArchiveIndex(zip, 'apk');

    const result = await importMappedImages({
      platform: 'android',
      archiveKind: 'apk',
      zip,
      androidIndex,
      resourceFiles: {
        'drawable/theme_background_image': [
          'res/drawable-xxhdpi-v4/theme_background_image.png',
          'res/drawable-sw600dp-v13/theme_background_image.png',
        ],
      },
    });

    expect(result.mappedIds).toEqual(new Set(['main.background']));
    expect(result.images[0]).toMatchObject({
      resourceId: 'main.background',
      asset: { rawNinePatch: false },
    });
    expect(result.images[0].asset.dataUrl)
      .toBe(`data:image/png;base64,${valid.toString('base64')}`);
    expect(result.failedResources).toEqual([]);
  });

  it('removes a mixed-case source .9.PNG border and recovers its guides', async () => {
    const guides: NinePatchGuides = {
      stretch: { x: [1 / 7, 6 / 7], y: [1 / 5, 4 / 5] },
      content: { left: 2 / 7, top: 1 / 5, right: 6 / 7, bottom: 4 / 5 },
    };
    const interior = solidPng(100, 7, 5);
    const zip = new JSZip();
    zip.file(
      'src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.PNG',
      buildNinePatchPng(interior, guides),
    );
    const androidIndex = createAndroidArchiveIndex(zip, 'source');

    const result = await importMappedImages({
      platform: 'android',
      archiveKind: 'source',
      zip,
      androidIndex,
    });

    const recovered = result.images.find(
      ({ resourceId }) => resourceId === 'chat.bubble.me.first.normal',
    );
    expect(recovered).toMatchObject({
      resourceId: 'chat.bubble.me.first.normal',
      asset: {
        fileName: 'theme_chatroom_bubble_me_01_image.png',
        width: 7,
        height: 5,
        sourceScale: 3,
        rawNinePatch: false,
      },
      guides,
    });
    expect(PNG.sync.read(Buffer.from(recovered!.asset.dataUrl.split(',')[1], 'base64')))
      .toMatchObject({ width: 7, height: 5 });
  });

  it('recovers compiled chat bubble npTc guides', async () => {
    const guides: NinePatchGuides = {
      stretch: { x: [2 / 8, 6 / 8], y: [1 / 6, 5 / 6] },
      content: { left: 1 / 8, top: 2 / 6, right: 7 / 8, bottom: 5 / 6 },
    };
    const compiled = compiledNinePatchPng(solidPng(120, 8, 6), guides);
    const zip = new JSZip();
    zip.file(
      'res/drawable-xxhdpi-v4/theme_chatroom_bubble_me_01_image.9.png',
      compiled,
    );
    const androidIndex = createAndroidArchiveIndex(zip, 'apk');

    const result = await importMappedImages({
      platform: 'android',
      archiveKind: 'apk',
      zip,
      androidIndex,
      resourceFiles: {
        'drawable/theme_chatroom_bubble_me_01_image': [
          'res/drawable-xxhdpi-v4/theme_chatroom_bubble_me_01_image.9.png',
        ],
      },
    });

    expect(result.images.find(
      ({ resourceId }) => resourceId === 'chat.bubble.me.first.normal',
    )).toMatchObject({
      asset: { width: 8, height: 6, sourceScale: 3, rawNinePatch: false },
      guides,
    });
  });

  it('reports missing and corrupt compiled paths for an advertised Android resource', async () => {
    const zip = new JSZip();
    zip.file('res/drawable-xxhdpi-v4/theme_background_image.png', Buffer.from('broken'));
    const androidIndex = createAndroidArchiveIndex(zip, 'apk');

    const result = await importMappedImages({
      platform: 'android',
      archiveKind: 'apk',
      zip,
      androidIndex,
      resourceFiles: {
        'drawable/theme_background_image': [
          'res/drawable-xhdpi-v4/theme_background_image.png',
          'res/drawable-xxhdpi-v4/theme_background_image.png',
        ],
      },
    });

    expect(result.mappedIds).toEqual(new Set());
    expect(result.failedResources).toEqual([{
      resourceKey: 'drawable/theme_background_image',
      referencedPaths: [
        'res/drawable-xhdpi-v4/theme_background_image.png',
        'res/drawable-xxhdpi-v4/theme_background_image.png',
      ],
      errors: expect.arrayContaining([
        'res/drawable-xhdpi-v4/theme_background_image.png: ZIP 엔트리 없음',
        expect.stringContaining('res/drawable-xxhdpi-v4/theme_background_image.png:'),
      ]),
    }]);
  });
});
