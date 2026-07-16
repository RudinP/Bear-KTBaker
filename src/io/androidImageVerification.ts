import JSZip from 'jszip';
import type { NinePatchGuides } from '../domain/ninePatch';
import {
  androidResourceIdentity,
  createAndroidArchiveIndex,
  fingerprintAndroidPng,
  isAndroidPngPath,
} from './androidArchiveResources';
import { parseCompiledNinePatchPng, parseNinePatchPng } from './ninePatchPng';
import type { AndroidCompiledMetadata } from './androidCompiledMetadata';

export interface AndroidImageExpectation {
  resourceId: string;
  sourcePath: string;
  resourceKey: string;
  semanticQualifier: string;
  ninePatch: boolean;
  width: number;
  height: number;
  pixelFingerprint: string;
  guides?: NinePatchGuides;
}

export function assertAndroidImageOutputPossible(options: {
  resourceId: string;
  sourcePath: string;
  hasTemplate: boolean;
  hasOutputSize: boolean;
  flexibleBubble: boolean;
}) {
  if (!options.hasTemplate && !options.hasOutputSize && !options.flexibleBubble) {
    throw new Error(`Android 이미지 출력 크기를 결정할 수 없습니다: ${options.resourceId} (${options.sourcePath})`);
  }
}

export function createAndroidImageExpectation(
  resourceId: string,
  sourcePath: string,
  png: Buffer,
  ninePatch: boolean,
): AndroidImageExpectation | undefined {
  const identity = androidResourceIdentity(sourcePath);
  if (!identity || !/^src\/main\/(?:res|theme|theme-adv)\//.test(identity.sourcePath)) return undefined;
  const fingerprint = fingerprintAndroidPng(png, ninePatch);
  return {
    resourceId,
    sourcePath: identity.sourcePath,
    resourceKey: identity.key,
    semanticQualifier: identity.semanticQualifier,
    ninePatch,
    width: fingerprint.width,
    height: fingerprint.height,
    pixelFingerprint: fingerprint.sha256,
    ...(ninePatch ? { guides: parseNinePatchPng(png).guides } : {}),
  };
}

function guidePixels(guides: NinePatchGuides, width: number, height: number) {
  return [
    guides.stretch.x[0] * width,
    guides.stretch.x[1] * width,
    guides.stretch.y[0] * height,
    guides.stretch.y[1] * height,
    guides.content.left * width,
    guides.content.top * height,
    guides.content.right * width,
    guides.content.bottom * height,
  ];
}

function guidesWithinOnePixel(
  expected: NinePatchGuides,
  actual: NinePatchGuides,
  width: number,
  height: number,
) {
  const expectedPixels = guidePixels(expected, width, height);
  const actualPixels = guidePixels(actual, width, height);
  return expectedPixels.every((value, index) => Math.abs(value - actualPixels[index]) <= 1);
}

export async function verifyCompiledAndroidImages(
  apk: Buffer,
  metadata: AndroidCompiledMetadata,
  expectations: readonly AndroidImageExpectation[],
) {
  const zip = await JSZip.loadAsync(apk);
  const index = createAndroidArchiveIndex(zip, 'apk');
  const mismatches: string[] = [];
  for (const expected of expectations) {
    const paths = (metadata.resourceFiles?.[expected.resourceKey] ?? [])
      .filter(isAndroidPngPath)
      .filter((path) => {
        const identity = androidResourceIdentity(path);
        return identity?.key === expected.resourceKey
          && identity.semanticQualifier === expected.semanticQualifier;
      });
    if (paths.length === 0) {
      mismatches.push(`${expected.resourceId}:${expected.sourcePath}: compiled reference missing`);
      continue;
    }
    const errors: string[] = [];
    let matched = false;
    for (const path of paths) {
      const entry = index.find(path);
      if (!entry) {
        errors.push(`${path}: ZIP entry missing`);
        continue;
      }
      try {
        const compiled = await entry.async('nodebuffer');
        const fingerprint = fingerprintAndroidPng(compiled, false);
        if (fingerprint.width !== expected.width
          || fingerprint.height !== expected.height
          || fingerprint.sha256 !== expected.pixelFingerprint) {
          errors.push(`${path}: decoded pixels differ`);
          continue;
        }
        if (expected.ninePatch) {
          const actual = parseCompiledNinePatchPng(compiled);
          if (!expected.guides
            || !guidesWithinOnePixel(expected.guides, actual.guides, expected.width, expected.height)) {
            errors.push(`${path}: nine-patch guides differ`);
            continue;
          }
        }
        matched = true;
        break;
      } catch (error) {
        errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!matched) {
      mismatches.push(`${expected.resourceId}:${expected.sourcePath}: ${errors.join(' | ')}`);
    }
  }
  if (mismatches.length) {
    throw new Error(`Android APK 이미지 검증에 실패했습니다 (${mismatches.join('; ')}).`);
  }
}
