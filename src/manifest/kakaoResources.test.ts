import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { KAKAO_RESOURCE_SLOTS, getResourceSlot } from './kakaoResources';

const root = process.cwd();

function pngPixelSize(buffer: Buffer): readonly [number, number] {
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function preferredSampleFile(platform: 'ios' | 'android', files: readonly string[]) {
  if (platform === 'ios') return files.find((file) => file.includes('@3x.')) ?? files[0];
  return files.find((file) => file.includes('/drawable-xxhdpi/'))
    ?? files.find((file) => file.includes('/mipmap-xxhdpi/'))
    ?? files[0];
}

describe('KakaoTalk official resource manifest', () => {
  it('maps every PNG shipped in the iOS sample theme', async () => {
    const zip = await JSZip.loadAsync(await readFile(path.join(root, 'resources/templates/ios-base.ktheme')));
    const sample = Object.keys(zip.files).filter((name) => /^Images\/.*\.png$/i.test(name)).sort();
    const mapped = KAKAO_RESOURCE_SLOTS.flatMap((slot) => slot.ios?.files ?? []).sort();

    expect(sample.filter((name) => !mapped.includes(name))).toEqual([]);
    expect(mapped.filter((name) => !sample.includes(name))).toEqual([
      'Images/maintabIcoPiccoma@2x.png',
      'Images/maintabIcoPiccoma@3x.png',
      'Images/maintabIcoPiccomaSelected@2x.png',
      'Images/maintabIcoPiccomaSelected@3x.png',
      'Images/profileImg02@3x.png',
      'Images/profileImg03@3x.png',
    ].sort());
  });

  it('maps every PNG shipped in the Android source sample, including launcher layers', async () => {
    const zip = await JSZip.loadAsync(await readFile(path.join(root, 'resources/templates/android-source.zip')));
    const sample = Object.keys(zip.files).filter((name) => /^src\/main\/.*\.png$/i.test(name)).sort();
    const mapped = KAKAO_RESOURCE_SLOTS.flatMap((slot) => slot.android?.files ?? []).sort();

    expect(sample.filter((name) => !mapped.includes(name))).toEqual([]);
  });

  it('also records the optional Android profile images documented by the 26.5 guide', () => {
    const mapped = KAKAO_RESOURCE_SLOTS.flatMap((slot) => slot.android?.files ?? []);
    expect(mapped).toEqual(expect.arrayContaining([
      'src/main/theme/drawable-xxhdpi/theme_profile_02_image.png',
      'src/main/theme/drawable-xxhdpi/theme_profile_03_image.png',
      'src/main/theme/drawable-nodpi/theme_profile_01_image_full.png',
      'src/main/theme/drawable-nodpi/theme_profile_02_image_full.png',
      'src/main/theme/drawable-nodpi/theme_profile_03_image_full.png',
    ]));
  });

  it('records optional second and third iOS default-profile slots', () => {
    expect(getResourceSlot('main.profile.02').ios).toMatchObject({
      files: ['Images/profileImg02@3x.png'], outputSize: [120, 120], sampleIncluded: false,
    });
    expect(getResourceSlot('main.profile.03').ios).toMatchObject({
      files: ['Images/profileImg03@3x.png'], outputSize: [120, 120], sampleIncluded: false,
    });
  });

  it('records the exact crop and stretch rules from the guide and iOS CSS', () => {
    expect(getResourceSlot('main.background')).toMatchObject({
      render: { mode: 'top-center-crop' },
      ios: { css: { block: 'MainViewStyle-Primary', property: '-ios-background-image' } },
      android: { colorResource: 'theme_background_color' },
    });
    expect(getResourceSlot('chat.bubble.me.first.normal')).toMatchObject({
      render: { mode: 'stretch', iosStretchPoint: [17, 17], iosContentInsets: [10, 11, 7, 17] },
      android: { ninePatch: true },
    });
    expect(getResourceSlot('chat.bubble.you.first.normal')).toMatchObject({
      render: { mode: 'stretch', iosStretchPoint: [22, 17], iosContentInsets: [10, 17, 7, 11] },
      android: { ninePatch: true },
    });
  });

  it('keeps the different iOS and Android sample pixel sizes instead of assuming matching assets', () => {
    expect(getResourceSlot('main.background')).toMatchObject({
      ios: { samplePixelSize: [1125, 2250], sampleLogicalSize: [375, 750] },
      android: { samplePixelSize: [1440, 2880], sampleLogicalSize: [480, 960] },
    });
    expect(getResourceSlot('main.tab.background')).toMatchObject({
      ios: { samplePixelSize: [1410, 147], sampleLogicalSize: [470, 49] },
      android: { samplePixelSize: [1442, 214], sampleContentSize: [1440, 212], sampleLogicalSize: [360, 53] },
    });
    expect(getResourceSlot('main.profile.01')).toMatchObject({
      ios: { samplePixelSize: [360, 360], sampleLogicalSize: [120, 120] },
      android: { samplePixelSize: [240, 240], sampleLogicalSize: [80, 80] },
    });
    expect(getResourceSlot('chat.bubble.me.first.normal')).toMatchObject({
      ios: { samplePixelSize: [120, 105], sampleContentSize: [120, 105], sampleLogicalSize: [40, 35] },
      android: { samplePixelSize: [124, 114], sampleContentSize: [122, 112], sampleLogicalSize: [122 / 3, 112 / 3] },
    });
    expect(getResourceSlot('passcode.background')).toMatchObject({
      ios: { samplePixelSize: [1200, 1200], sampleLogicalSize: [400, 400] },
      android: { samplePixelSize: [1440, 1440], sampleLogicalSize: [480, 480] },
    });
  });

  it('matches every recorded canonical pixel size to the PNG inside each official sample package', async () => {
    const packages = {
      ios: await JSZip.loadAsync(await readFile(path.join(root, 'resources/templates/ios-base.ktheme'))),
      android: await JSZip.loadAsync(await readFile(path.join(root, 'resources/templates/android-source.zip'))),
    } as const;

    for (const slot of KAKAO_RESOURCE_SLOTS) {
      for (const platform of ['ios', 'android'] as const) {
        const binding = slot[platform];
        if (!binding?.samplePixelSize || binding.sampleIncluded === false) continue;
        const file = preferredSampleFile(platform, binding.files);
        const entry = file ? packages[platform].file(file) : null;
        expect(entry, `${slot.id} ${platform} sample file`).not.toBeNull();
        expect(pngPixelSize(await entry!.async('nodebuffer')), `${slot.id} ${platform} ${file}`).toEqual(binding.samplePixelSize);
      }
    }
  });

  it('preserves the official one-pixel-wide iOS pressed received-bubble variants', () => {
    expect(getResourceSlot('chat.bubble.you.first.pressed').ios).toMatchObject({
      samplePixelSize: [121, 105],
      sampleLogicalSize: [121 / 3, 35],
    });
    expect(getResourceSlot('chat.bubble.you.grouped.pressed').ios).toMatchObject({
      samplePixelSize: [121, 105],
      sampleLogicalSize: [121 / 3, 35],
    });
  });
});
