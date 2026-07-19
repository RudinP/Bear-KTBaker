import type { ThemeProject } from '../../domain/theme';
import { androidResourceIdentity } from '../../io/androidArchiveResources';
import {
  assertAndroidImageOutputPossible,
  createAndroidImageExpectation,
  type AndroidImageExpectation,
} from '../../io/androidImageVerification';
import { decodeImageDataUrl } from '../../io/imageDataUrl';
import {
  buildNinePatchPng,
  replaceNinePatchInterior,
  stripNinePatchBorder,
} from '../../io/ninePatchPng';
import {
  flexibleBubbleTargetSize,
  sourceHasNinePatchBorder,
  uploadSourceScale,
} from '../../io/resourceGeometry';
import { getMappedResourceWrites } from '../../io/resourceWrites';
import { resolveBubbleGuides } from '../../manifest/bubbleGuideResolver';
import { getResourceSlot } from '../../manifest/kakaoResources';
import {
  normalizeThemeStudioError,
  ThemeStudioError,
} from '../errors/ThemeStudioError';
import type { FileSystemPort, PathPort } from '../ports/fileSystem';
import type { ImageProcessorPort } from '../ports/imageProcessor';

export interface RenderAndroidImagesInput {
  buildDirectory: string;
  project: ThemeProject;
  files: Pick<
    FileSystemPort,
    'readOptionalBytes' | 'writeBytes' | 'ensureDirectory'
  >;
  paths: Pick<PathPort, 'join' | 'dirname'>;
  images: ImageProcessorPort;
}

export async function renderAndroidImages({
  buildDirectory,
  project,
  files,
  paths,
  images,
}: RenderAndroidImagesInput): Promise<
  readonly AndroidImageExpectation[]
> {
  const expectations: AndroidImageExpectation[] = [];
  for (const write of getMappedResourceWrites(project, 'android')) {
    const targetPath = paths.join(buildDirectory, write.path);
    let target: Uint8Array | null;
    try {
      target = await files.readOptionalBytes(targetPath);
    } catch (cause) {
      throw normalizeThemeStudioError(cause, {
        code: 'KTB-FS-READ',
        operation: 'theme:export-android',
        stage: 'Android 이미지 템플릿 읽기',
        message: 'Android 이미지 템플릿을 읽지 못했습니다.',
        safeContext: { resourceId: write.resourceId },
      });
    }
    const slot = getResourceSlot(write.resourceId);
    const flexibleBubble = slot.render.mode === 'stretch';
    const outputSize = slot.android?.outputSize;
    const compiledIdentity = androidResourceIdentity(write.path);
    if (
      !compiledIdentity
      && !target
      && !outputSize
      && !flexibleBubble
    ) {
      continue;
    }
    if (compiledIdentity) {
      assertAndroidImageOutputPossible({
        resourceId: write.resourceId,
        sourcePath: write.path,
        hasTemplate: Boolean(target),
        hasOutputSize: Boolean(outputSize),
        flexibleBubble,
      });
    }

    let rawSource: Uint8Array;
    try {
      rawSource = decodeImageDataUrl(write.asset.dataUrl);
    } catch (cause) {
      throw new ThemeStudioError({
        code: 'KTB-IMAGE-DECODE',
        operation: 'theme:export-android',
        stage: 'Android 이미지 디코딩',
        message: 'Android 테마 이미지를 읽지 못했습니다.',
        safeContext: { resourceId: write.resourceId },
        cause,
      });
    }
    const sourceIsNinePatch = sourceHasNinePatchBorder(
      write.asset.rawNinePatch,
      write.asset.fileName,
    );
    const source = sourceIsNinePatch
      ? stripNinePatchBorder(rawSource)
      : rawSource;
    const rawSize = images.dimensions(rawSource);
    const targetSize = target ? images.dimensions(target) : null;
    const size = flexibleBubble && rawSize
      ? flexibleBubbleTargetSize(
          'android',
          write.path,
          rawSize,
          write.asset.sourceScale
            ?? uploadSourceScale(
              'android',
              '',
              write.asset.fileName,
            ),
          sourceIsNinePatch,
          write.asset.mirroredFromPlatform,
        )
      : targetSize
        ? {
            width: targetSize.width - (write.ninePatch ? 2 : 0),
            height:
              targetSize.height - (write.ninePatch ? 2 : 0),
          }
        : outputSize
          ? { width: outputSize[0], height: outputSize[1] }
          : undefined;
    if (!size) continue;
    const resized = images.resizeToPng({
      source,
      width: size.width,
      height: size.height,
      mode: flexibleBubble ? 'stretch' : slot.render.mode,
    });
    if (!resized) {
      throw new ThemeStudioError({
        code: 'KTB-IMAGE-DECODE',
        operation: 'theme:export-android',
        stage: 'Android 이미지 변환',
        message: 'Android 테마 이미지를 변환하지 못했습니다.',
        safeContext: { resourceId: write.resourceId },
      });
    }
    const guides = /^chat\.bubble\./.test(write.resourceId)
      ? resolveBubbleGuides(
          project,
          'android',
          write.resourceId,
        ).guides
      : undefined;
    if (write.ninePatch && !guides && !target) {
      throw new ThemeStudioError({
        code: 'KTB-IMAGE-NINE-PATCH',
        operation: 'theme:export-android',
        stage: 'Android 9-patch 템플릿 적용',
        message:
          'Android 9-patch 기준 이미지를 찾지 못했습니다.',
        safeContext: { resourceId: write.resourceId },
      });
    }
    const output = write.ninePatch
      ? guides
        ? buildNinePatchPng(resized, guides)
        : replaceNinePatchInterior(target!, resized)
      : resized;
    try {
      await files.ensureDirectory(paths.dirname(targetPath));
      await files.writeBytes(targetPath, output);
    } catch (cause) {
      throw normalizeThemeStudioError(cause, {
        code: 'KTB-FS-WRITE',
        operation: 'theme:export-android',
        stage: 'Android 이미지 리소스 쓰기',
        message: 'Android 이미지 리소스를 저장하지 못했습니다.',
        safeContext: { resourceId: write.resourceId },
      });
    }
    const expectation = createAndroidImageExpectation(
      write.resourceId,
      write.path,
      output,
      write.ninePatch,
    );
    if (expectation) expectations.push(expectation);
  }
  return expectations;
}
