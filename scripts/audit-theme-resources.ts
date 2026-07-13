import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { ANDROID_SAMPLE_COLORS, IOS_GUIDE_ONLY_COLORS, IOS_SAMPLE_ALPHAS, IOS_SAMPLE_COLORS, KAKAO_COLOR_SLOTS } from '../src/manifest/kakaoColors';
import { KAKAO_RESOURCE_SLOTS } from '../src/manifest/kakaoResources';

const root = process.cwd();

function missing(actual: readonly string[], mapped: readonly string[]) {
  const known = new Set(mapped);
  return actual.filter((entry) => !known.has(entry));
}

function xmlColors(xml: string) {
  return Object.fromEntries([...xml.matchAll(/<color\s+name=["']([^"']+)["']\s*>(#[0-9a-f]+)<\/color>/gi)]
    .map((match) => [match[1], match[2]]));
}

function cssColors(css: string) {
  const result: Record<string, string> = {};
  for (const block of css.matchAll(/([A-Za-z][\w-]*)\s*(?:\/\*[\s\S]*?\*\/\s*)?\{([\s\S]*?)\}/g)) {
    for (const declaration of block[2].matchAll(/([\w-]+)\s*:\s*(#[0-9a-f]{6,8})\s*;/gi)) {
      result[`${block[1]}|${declaration[1]}`] = declaration[2];
    }
  }
  return result;
}

function pngPixelSize(buffer: Buffer): readonly [number, number] {
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function preferredSampleFile(platform: 'ios' | 'android', files: readonly string[]) {
  if (platform === 'ios') return files.find((file) => file.includes('@3x.')) ?? files[0];
  return files.find((file) => file.includes('/drawable-xxhdpi/'))
    ?? files.find((file) => file.includes('/mipmap-xxhdpi/'))
    ?? files[0];
}

async function main() {
  const iosZip = await JSZip.loadAsync(await readFile(path.join(root, 'resources/templates/ios-base.ktheme')));
  const androidZip = await JSZip.loadAsync(await readFile(path.join(root, 'resources/templates/android-source.zip')));
  const iosImages = Object.keys(iosZip.files).filter((name) => /^Images\/.*\.png$/i.test(name)).sort();
  const androidImages = Object.keys(androidZip.files).filter((name) => /^src\/main\/.*\.png$/i.test(name)).sort();
  const mappedIosImages = KAKAO_RESOURCE_SLOTS.flatMap((slot) => slot.ios?.files ?? []);
  const mappedAndroidImages = KAKAO_RESOURCE_SLOTS.flatMap((slot) => slot.android?.files ?? []);
  const colorsPath = Object.keys(androidZip.files).find((name) => name.endsWith('src/main/theme/values/colors.xml'))!;
  const actualAndroidColors = xmlColors(await androidZip.file(colorsPath)!.async('string'));
  const actualIosColors = cssColors(await iosZip.file('KakaoTalkTheme.css')!.async('string'));
  const mappedAndroidColors = new Set(KAKAO_COLOR_SLOTS.flatMap((slot) => slot.android));
  const mappedIosColors = new Set(KAKAO_COLOR_SLOTS.flatMap((slot) => slot.ios));
  const dimensionMismatches: Array<{ slot: string; platform: 'ios' | 'android'; file: string; expected: readonly [number, number]; actual: readonly [number, number] }> = [];

  for (const slot of KAKAO_RESOURCE_SLOTS) {
    for (const platform of ['ios', 'android'] as const) {
      const binding = slot[platform];
      if (!binding?.samplePixelSize || binding.sampleIncluded === false) continue;
      const file = preferredSampleFile(platform, binding.files);
      const entry = file ? (platform === 'ios' ? iosZip : androidZip).file(file) : null;
      if (!file || !entry) continue;
      const actual = pngPixelSize(await entry.async('nodebuffer'));
      if (actual[0] !== binding.samplePixelSize[0] || actual[1] !== binding.samplePixelSize[1]) {
        dimensionMismatches.push({ slot: slot.id, platform, file, expected: binding.samplePixelSize, actual });
      }
    }
  }

  const report = {
    images: {
      ios: { package: iosImages.length, mapped: mappedIosImages.length, missing: missing(iosImages, mappedIosImages) },
      android: { package: androidImages.length, mapped: mappedAndroidImages.length, missing: missing(androidImages, mappedAndroidImages) },
      dimensionMismatches,
    },
    colors: {
      ios: {
        sampleColors: Object.keys(actualIosColors).length,
        sampleAlphas: Object.keys(IOS_SAMPLE_ALPHAS).length,
        guideOnly: Object.keys(IOS_GUIDE_ONLY_COLORS),
        missing: missing(Object.keys(actualIosColors), [...mappedIosColors]),
        guideMissing: missing(Object.keys(IOS_GUIDE_ONLY_COLORS), [...mappedIosColors]),
        alphaMissing: missing(Object.keys(IOS_SAMPLE_ALPHAS), KAKAO_COLOR_SLOTS.map((slot) => slot.iosAlpha).filter((key): key is string => Boolean(key))),
      },
      android: {
        package: Object.keys(actualAndroidColors).length,
        missing: missing(Object.keys(actualAndroidColors), [...mappedAndroidColors]),
      },
    },
  };

  if (JSON.stringify(actualAndroidColors) !== JSON.stringify(ANDROID_SAMPLE_COLORS)) throw new Error('Android colors.xml 기본값이 매니페스트와 다릅니다.');
  if (JSON.stringify(actualIosColors) !== JSON.stringify(IOS_SAMPLE_COLORS)) throw new Error('iOS CSS 기본값이 매니페스트와 다릅니다.');
  if (report.images.ios.missing.length || report.images.android.missing.length || report.images.dimensionMismatches.length || report.colors.ios.missing.length || report.colors.ios.guideMissing.length || report.colors.ios.alphaMissing.length || report.colors.android.missing.length) {
    throw new Error(`누락된 공식 리소스가 있습니다.\n${JSON.stringify(report, null, 2)}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

void main();
