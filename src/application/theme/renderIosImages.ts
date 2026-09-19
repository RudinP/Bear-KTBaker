import type { ThemeProject } from '../../domain/theme/model';
import {
  flexibleBubbleTargetSize,
  uploadSourceScale,
} from '../../io/resourceGeometry';
import { getMappedResourceWrites } from '../../io/resourceWrites';
import {
  type ArchiveEntry,
} from '../../io/archiveEntries';
import { decodeImageDataUrl } from '../../io/imageDataUrl';
import { getResourceSlot } from '../../manifest/kakaoResources';
import { ThemeStudioError } from '../errors/ThemeStudioError';
import type { ImageProcessorPort } from '../ports/imageProcessor';

export async function renderIosImages({
  entries,
  project,
  images,
}: {
  entries: readonly ArchiveEntry[];
  project: ThemeProject;
  images: ImageProcessorPort;
}): Promise<readonly ArchiveEntry[]> {
  const output: ArchiveEntry[] = entries.map((entry) => ({
    ...entry,
    contents: entry.contents?.slice(),
  }));
  // Supply compatibility files even for an untouched sample theme. Custom
  // icons below replace both names with the user's image at each scale.
  for (const suffix of ['', 'Selected']) {
    for (const scale of [2, 3]) {
      const names = ['Now', 'View'].map(
        (name) => `Images/maintabIco${name}${suffix}@${scale}x.png`,
      );
      const source = names.map((name) => output.find(
        (entry) => !entry.directory && entry.relativePath === name,
      )).find((entry) => entry?.contents);
      if (!source?.contents) continue;
      for (const name of names) {
        const replacement = { ...source, relativePath: name, contents: source.contents.slice() };
        const index = output.findIndex((entry) => entry.relativePath === name);
        if (index >= 0) output[index] = replacement;
        else output.push(replacement);
      }
    }
  }
  for (const write of getMappedResourceWrites(project, 'ios')) {
    const slot = getResourceSlot(write.resourceId);
    let source: Uint8Array;
    try {
      source = decodeImageDataUrl(write.asset.dataUrl);
    } catch (cause) {
      throw new ThemeStudioError({
        code: 'KTB-IMAGE-DECODE',
        operation: 'theme:export-ios',
        stage: 'iPhone 이미지 디코딩',
        message: 'iPhone 테마 이미지를 읽지 못했습니다.',
        safeContext: { resourceId: write.resourceId },
        cause,
      });
    }

    const target = output.find(
      (entry) =>
        !entry.directory
        && entry.relativePath === write.path,
    );
    const targetSize = target?.contents
      ? images.dimensions(target.contents)
      : undefined;
    const scale = /@3x\.png$/i.test(write.path)
      ? 3
      : /@2x\.png$/i.test(write.path)
        ? 2
        : 1;
    const catalogSize = slot.ios?.outputSize
      ?? slot.ios?.exportOutputSize;
    const sourceSize = images.dimensions(source);
    const size = slot.render.mode === 'stretch' && sourceSize
      ? flexibleBubbleTargetSize(
          'ios',
          write.path,
          sourceSize,
          write.asset.sourceScale
            ?? uploadSourceScale('ios', '', write.asset.fileName),
          false,
          write.asset.mirroredFromPlatform,
        )
      : targetSize
        ?? (catalogSize
          ? {
              width: catalogSize[0] * scale,
              height: catalogSize[1] * scale,
            }
          : undefined);
    if (!size) continue;
    const png = images.resizeToPng({
      source,
      width: size.width,
      height: size.height,
      mode: slot.render.mode,
    });
    if (!png) {
      throw new ThemeStudioError({
        code: 'KTB-IMAGE-DECODE',
        operation: 'theme:export-ios',
        stage: 'iPhone 이미지 변환',
        message: 'iPhone 테마 이미지를 변환하지 못했습니다.',
        safeContext: { resourceId: write.resourceId },
      });
    }
    const replacement: ArchiveEntry = {
      relativePath: write.path,
      directory: false,
      contents: png,
    };
    const index = output.findIndex(
      (entry) => entry.relativePath === write.path,
    );
    if (index >= 0) output[index] = replacement;
    else output.push(replacement);
  }
  return output;
}
