import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageProcessorPort } from '../ports/imageProcessor';
import { createDefaultTheme } from '../../domain/theme/defaults';
import type { ThemeProject } from '../../domain/theme/model';
import type { ArchiveEntry } from '../../io/archiveEntries';
import { renderIosImages } from './renderIosImages';

const imageDataUrl = 'data:image/png;base64,AQIDBA==';

function projectWith(
  resources: ThemeProject['platformResources']['ios'],
) {
  const project = createDefaultTheme('iOS render', false);
  project.platformResources.ios = resources;
  return project;
}

function asset(fileName = 'source.png') {
  return {
    fileName,
    dataUrl: imageDataUrl,
  };
}

describe('iOS image rendering', () => {
  const dimensions = vi.fn<ImageProcessorPort['dimensions']>();
  const resizeToPng = vi.fn<ImageProcessorPort['resizeToPng']>();
  const images: ImageProcessorPort = { dimensions, resizeToPng };

  beforeEach(() => {
    vi.clearAllMocks();
    dimensions.mockReturnValue({ width: 40, height: 20 });
    resizeToPng.mockReturnValue(new Uint8Array([137, 80, 78, 71]));
  });

  it('uses existing template dimensions and the catalog render mode', async () => {
    const template = new Uint8Array([9, 9, 9]);
    dimensions.mockImplementation((source) =>
      source[0] === template[0]
        ? { width: 72, height: 64 }
        : { width: 40, height: 20 });
    const entries: readonly ArchiveEntry[] = [{
      relativePath: 'Images/commonIcoTheme.png',
      directory: false,
      contents: template,
    }];

    await renderIosImages({
      entries,
      project: projectWith({
        'common.theme-icon': asset(),
      }),
      images,
    });

    expect(resizeToPng).toHaveBeenCalledWith({
      source: new Uint8Array([1, 2, 3, 4]),
      width: 72,
      height: 64,
      mode: 'contain',
    });
  });

  it('scales catalog output sizes for missing @2x and @3x entries', async () => {
    await renderIosImages({
      entries: [],
      project: projectWith({
        'main.tab.piccoma.normal': asset('piccoma.png'),
      }),
      images,
    });

    expect(resizeToPng).toHaveBeenNthCalledWith(1, {
      source: new Uint8Array([1, 2, 3, 4]),
      width: 76,
      height: 76,
      mode: 'contain',
    });
    expect(resizeToPng).toHaveBeenNthCalledWith(2, {
      source: new Uint8Array([1, 2, 3, 4]),
      width: 114,
      height: 114,
      mode: 'contain',
    });
  });

  it('derives flexible @2x and @3x bubble targets from source scale', async () => {
    dimensions.mockReturnValue({ width: 80, height: 70 });

    await renderIosImages({
      entries: [],
      project: projectWith({
        'chat.bubble.me.first.normal': {
          ...asset('bubble@2x.png'),
          sourceScale: 2,
        },
      }),
      images,
    });

    expect(resizeToPng).toHaveBeenNthCalledWith(1, {
      source: new Uint8Array([1, 2, 3, 4]),
      width: 80,
      height: 70,
      mode: 'stretch',
    });
    expect(resizeToPng).toHaveBeenNthCalledWith(2, {
      source: new Uint8Array([1, 2, 3, 4]),
      width: 120,
      height: 105,
      mode: 'stretch',
    });
  });

  it.each([
    [
      'main.background',
      'Images/mainBgImage@3x.png',
      'top-center-crop',
    ],
    [
      'main.tab.background',
      'Images/maintabBgImage@2x.png',
      'center-crop',
    ],
    [
      'main.profile.01',
      'Images/profileImg01@3x.png',
      'cover',
    ],
  ] as const)(
    'preserves %s resource geometry as %s',
    async (resourceId, relativePath, mode) => {
      const target = new Uint8Array([7, 7]);
      dimensions.mockImplementation((source) =>
        source[0] === target[0]
          ? { width: 300, height: 200 }
          : { width: 40, height: 20 });

      await renderIosImages({
        entries: [{
          relativePath,
          directory: false,
          contents: target,
        }],
        project: projectWith({
          [resourceId]: asset(),
        }),
        images,
      });

      expect(resizeToPng).toHaveBeenCalledWith({
        source: new Uint8Array([1, 2, 3, 4]),
        width: 300,
        height: 200,
        mode,
      });
    },
  );

  it('maps an invalid data URL to a safe image-decode error', async () => {
    const project = projectWith({
      'common.theme-icon': {
        fileName: 'broken.png',
        dataUrl: 'data:text/plain;base64,dW5zYWZl',
      },
    });

    await expect(renderIosImages({
      entries: [],
      project,
      images,
    })).rejects.toMatchObject({
      code: 'KTB-IMAGE-DECODE',
      operation: 'theme:export-ios',
      stage: 'iPhone 이미지 디코딩',
      safeContext: { resourceId: 'common.theme-icon' },
    });
    expect(resizeToPng).not.toHaveBeenCalled();
  });

  it('maps a null image conversion with only the safe resource id', async () => {
    resizeToPng.mockReturnValue(null);

    let failure: unknown;
    try {
      await renderIosImages({
        entries: [{
          relativePath: 'Images/commonIcoTheme.png',
          directory: false,
          contents: new Uint8Array([8]),
        }],
        project: projectWith({
          'common.theme-icon': asset(),
        }),
        images,
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      code: 'KTB-IMAGE-DECODE',
      operation: 'theme:export-ios',
      stage: 'iPhone 이미지 변환',
      safeContext: { resourceId: 'common.theme-icon' },
    });
    expect(Object.keys(
      (failure as { safeContext: object }).safeContext,
    )).toEqual(['resourceId']);
  });

  it('returns copy-on-write entries without mutating the input array', async () => {
    const originalContents = new Uint8Array([5, 6, 7]);
    const originalEntry: ArchiveEntry = {
      relativePath: 'unrelated.bin',
      directory: false,
      contents: originalContents,
    };
    const entries = Object.freeze([Object.freeze(originalEntry)]);

    const result = await renderIosImages({
      entries,
      project: projectWith({}),
      images,
    });

    expect(result).not.toBe(entries);
    expect(result[0]).not.toBe(originalEntry);
    expect(result[0].contents).not.toBe(originalContents);
    expect(result[0].contents).toEqual(originalContents);
    expect(entries[0]).toBe(originalEntry);
    expect(entries[0].contents).toBe(originalContents);
  });
});
