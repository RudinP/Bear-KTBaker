import path from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import type { ImageAsset } from '../../domain/theme/model';
import type { NinePatchGuides } from '../../domain/ninePatch';
import {
  KAKAO_RESOURCE_SLOTS,
  type KakaoResourceSlot,
  type PlatformResourceBinding,
} from '../../manifest/kakaoResources';
import {
  androidPngCandidates,
  androidResourceIdentity,
  isAndroidPngPath,
  type AndroidArchiveIndex,
} from '../androidArchiveResources';
import {
  parseCompiledNinePatchPng,
  parseNinePatchPng,
  stripNinePatchBorder,
} from '../ninePatchPng';

export interface RecoveredMappedImage {
  resourceId: string;
  asset: ImageAsset;
  guides?: NinePatchGuides;
}

export interface FailedAndroidResource {
  resourceKey: string;
  referencedPaths: string[];
  errors: string[];
}

export interface MappedImageImportResult {
  images: RecoveredMappedImage[];
  mappedIds: Set<string>;
  failedResources: FailedAndroidResource[];
}

export type MappedImageImportRequest =
  | {
      platform: 'ios';
      archiveKind: 'ios';
      zip: JSZip;
      referencedFiles: Readonly<Record<string, readonly string[]>>;
    }
  | {
      platform: 'android';
      archiveKind: 'source' | 'apk';
      zip: JSZip;
      androidIndex: AndroidArchiveIndex;
      resourceFiles?: Record<string, string[]>;
    };

interface MappedImageCandidate {
  path: string;
  entry: JSZip.JSZipObject;
  compiled: boolean;
}

interface DecodedMappedImage {
  asset: ImageAsset;
  guides?: NinePatchGuides;
}

function dataUrl(buffer: Buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function preferredFile(binding: PlatformResourceBinding, platform: 'ios' | 'android') {
  if (platform === 'ios') {
    return binding.files.find((file) => file.includes('@3x.')) ?? binding.files[0];
  }
  return binding.files.find((file) => file.includes('/mipmap-xxhdpi/'))
    ?? binding.files.find((file) => file.includes('/drawable-xxhdpi/'))
    ?? binding.files[0];
}

function orderedFiles(binding: PlatformResourceBinding, platform: 'ios' | 'android') {
  const preferred = preferredFile(binding, platform);
  return preferred
    ? [preferred, ...binding.files.filter((file) => file !== preferred)]
    : binding.files;
}

function importedSourceScale(
  resourceId: string,
  platform: 'ios' | 'android',
  fileName: string,
) {
  const iosScale = fileName.match(/@(\d+)x(?=\.[^.]+$)/i)?.[1];
  if (platform === 'ios') return iosScale ? Number(iosScale) : 1;
  if ([
    'main.background',
    'chat.background',
    'passcode.background',
    'main.tab.background',
    'splash.image',
  ].includes(resourceId)) return 4;
  if (/drawable-xhdpi/i.test(fileName)) return 2;
  if (/drawable-xxxhdpi/i.test(fileName)) return 4;
  return 3;
}

function iosImageCandidates(
  zip: JSZip,
  resourceId: string,
  binding: PlatformResourceBinding,
  referencedFiles: Readonly<Record<string, readonly string[]>>,
): MappedImageCandidate[] {
  return [...new Set([
    ...(referencedFiles[resourceId] ?? []),
    ...orderedFiles(binding, 'ios'),
  ])].flatMap((candidate) => {
    const entry = zip.file(candidate);
    return entry ? [{ path: candidate, entry, compiled: false }] : [];
  });
}

async function decodeMappedImage(
  platform: 'ios' | 'android',
  slot: KakaoResourceSlot,
  candidate: MappedImageCandidate,
): Promise<DecodedMappedImage> {
  const binding = slot[platform]!;
  const source = await candidate.entry.async('nodebuffer');
  if (platform === 'android' && binding.ninePatch) {
    const png = PNG.sync.read(source);
    const parsed = candidate.compiled && slot.id.startsWith('chat.bubble.')
      ? parseCompiledNinePatchPng(source)
      : candidate.compiled
        ? { width: png.width, height: png.height, guides: undefined }
        : parseNinePatchPng(source);
    const preview = candidate.compiled ? source : stripNinePatchBorder(source);
    return {
      asset: {
        fileName: path.basename(candidate.path).replace(/\.9\.png$/i, '.png'),
        dataUrl: dataUrl(preview),
        width: parsed.width,
        height: parsed.height,
        sourceScale: importedSourceScale(slot.id, platform, candidate.path),
        rawNinePatch: false,
      },
      guides: parsed.guides,
    };
  }
  const png = PNG.sync.read(source);
  return {
    asset: {
      fileName: path.basename(candidate.path),
      dataUrl: dataUrl(source),
      width: png.width,
      height: png.height,
      sourceScale: importedSourceScale(slot.id, platform, candidate.path),
      rawNinePatch: false,
    },
  };
}

export async function importMappedImages(
  request: MappedImageImportRequest,
): Promise<MappedImageImportResult> {
  const images: RecoveredMappedImage[] = [];
  const mappedIds = new Set<string>();
  const failedResources: FailedAndroidResource[] = [];

  for (const slot of KAKAO_RESOURCE_SLOTS) {
    const binding = slot[request.platform];
    if (!binding || binding.files.length === 0) continue;
    const candidates = request.platform === 'android'
      ? androidPngCandidates({
        index: request.androidIndex,
        kind: request.archiveKind,
        bindingFiles: orderedFiles(binding, request.platform),
        resourceFiles: request.resourceFiles,
      })
      : iosImageCandidates(request.zip, slot.id, binding, request.referencedFiles);
    const decodeErrors: string[] = [];
    let restored = false;
    for (const candidate of candidates) {
      let decoded: DecodedMappedImage;
      try {
        decoded = await decodeMappedImage(request.platform, slot, candidate);
      } catch (error) {
        decodeErrors.push(
          `${candidate.path}: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      images.push({ resourceId: slot.id, ...decoded });
      mappedIds.add(slot.id);
      restored = true;
      break;
    }
    if (!restored && request.platform === 'android') {
      const referencesByKey = new Map<string, string[]>();
      for (const file of binding.files) {
        const key = androidResourceIdentity(file)?.key;
        if (!key) continue;
        const paths = (request.resourceFiles?.[key] ?? []).filter(isAndroidPngPath);
        if (paths.length) referencesByKey.set(key, paths);
      }
      for (const [resourceKey, referencedPaths] of referencesByKey) {
        failedResources.push({
          resourceKey,
          referencedPaths,
          errors: [
            ...referencedPaths
              .filter((candidatePath) => !request.androidIndex.find(candidatePath))
              .map((candidatePath) => `${candidatePath}: ZIP 엔트리 없음`),
            ...decodeErrors,
          ],
        });
      }
    }
  }
  return { images, mappedIds, failedResources };
}
