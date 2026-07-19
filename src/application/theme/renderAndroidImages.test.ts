import path from 'node:path';
import { PNG } from 'pngjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileSystemPort, PathPort } from '../ports/fileSystem';
import type { ImageProcessorPort } from '../ports/imageProcessor';
import { createDefaultTheme } from '../../domain/theme/defaults';
import type { ThemeProject } from '../../domain/theme/model';
import type { NinePatchGuides } from '../../domain/ninePatch';
import {
  buildNinePatchPng,
  parseNinePatchPng,
  stripNinePatchBorder,
} from '../../io/ninePatchPng';
import { renderAndroidImages } from './renderAndroidImages';

function png(
  width: number,
  height: number,
  red = 40,
): Uint8Array {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data.set([red, 20, 30, 255], offset);
  }
  return PNG.sync.write(image);
}

function dataUrl(bytes: Uint8Array) {
  return `data:image/png;base64,${
    Buffer.from(bytes).toString('base64')
  }`;
}

function projectWith(
  resources: ThemeProject['platformResources']['android'],
) {
  const project = createDefaultTheme('Android render', false);
  project.platformResources.android = resources;
  return project;
}

function asset(
  bytes: Uint8Array,
  options: Partial<
    ThemeProject['platformResources']['android'][string]
  > = {},
) {
  return {
    fileName: 'source.png',
    dataUrl: dataUrl(bytes),
    ...options,
  };
}

describe('Android image rendering', () => {
  const readOptionalBytes =
    vi.fn<FileSystemPort['readOptionalBytes']>();
  const writeBytes = vi.fn<FileSystemPort['writeBytes']>();
  const ensureDirectory =
    vi.fn<FileSystemPort['ensureDirectory']>();
  const dimensions = vi.fn<ImageProcessorPort['dimensions']>();
  const resizeToPng =
    vi.fn<ImageProcessorPort['resizeToPng']>();
  const paths: Pick<PathPort, 'join' | 'dirname'> = {
    join: path.posix.join,
    dirname: path.posix.dirname,
  };
  const files = {
    readOptionalBytes,
    writeBytes,
    ensureDirectory,
  };
  const images = { dimensions, resizeToPng };

  beforeEach(() => {
    vi.clearAllMocks();
    readOptionalBytes.mockResolvedValue(null);
    dimensions.mockImplementation((source) => {
      try {
        const decoded = PNG.sync.read(Buffer.from(source));
        return { width: decoded.width, height: decoded.height };
      } catch {
        return null;
      }
    });
    resizeToPng.mockImplementation(({ width, height }) =>
      png(width, height));
  });

  it('renders a missing optional template from catalog output size', async () => {
    const project = projectWith({
      'main.profile.02': asset(png(8, 8)),
    });

    const expectedImages = await renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    });

    expect(resizeToPng).toHaveBeenCalledWith({
      source: expect.any(Uint8Array),
      width: 220,
      height: 220,
      mode: 'cover',
    });
    expect(writeBytes).toHaveBeenCalledWith(
      '/build/src/main/theme/drawable-xxhdpi/theme_profile_02_image.png',
      expect.anything(),
    );
    expect(ArrayBuffer.isView(writeBytes.mock.calls[0][1])).toBe(true);
    expect(expectedImages).toHaveLength(1);
  });

  it('rejects a compiled resource whose output size is impossible', async () => {
    const project = projectWith({
      'main.background': asset(png(8, 8)),
    });

    await expect(renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    })).rejects.toThrow('main.background');
    expect(resizeToPng).not.toHaveBeenCalled();
    expect(writeBytes).not.toHaveBeenCalled();
  });

  it('strips a source nine-patch border before flexible resizing', async () => {
    const guides: NinePatchGuides = {
      stretch: { x: [0.2, 0.6], y: [0.3, 0.7] },
      content: {
        left: 0.1,
        top: 0.2,
        right: 0.8,
        bottom: 0.9,
      },
    };
    const raw = buildNinePatchPng(png(10, 8), guides);
    const project = projectWith({
      'chat.bubble.me.first.normal': asset(raw, {
        fileName: 'bubble.9.png',
        rawNinePatch: true,
      }),
    });

    await renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    });

    expect(resizeToPng).toHaveBeenCalledWith({
      source: stripNinePatchBorder(raw),
      width: 10,
      height: 8,
      mode: 'stretch',
    });
  });

  it('retains existing target guides for non-bubble nine-patches', async () => {
    const guides: NinePatchGuides = {
      stretch: { x: [0.1, 0.5], y: [0.2, 0.6] },
      content: {
        left: 0.1,
        top: 0.1,
        right: 0.9,
        bottom: 0.8,
      },
    };
    const target = buildNinePatchPng(png(10, 10), guides);
    readOptionalBytes.mockResolvedValue(target);
    const project = projectWith({
      'main.tab.background': asset(png(5, 5)),
    });

    await renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    });

    for (const [, output] of writeBytes.mock.calls) {
      expect(parseNinePatchPng(Buffer.from(output)).guides)
        .toEqual(parseNinePatchPng(target).guides);
    }
  });

  it('builds bubble nine-patches from project Android guides', async () => {
    const guides: NinePatchGuides = {
      stretch: { x: [0.25, 0.5], y: [0.25, 0.75] },
      content: {
        left: 0.125,
        top: 0.25,
        right: 0.875,
        bottom: 0.75,
      },
    };
    const project = projectWith({
      'chat.bubble.you.first.normal': asset(png(8, 8)),
    });
    project.chat.bubbles.you.normal.stretchByPlatform = {
      android: guides,
    };

    await renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    });

    const output = writeBytes.mock.calls[0][1];
    expect(parseNinePatchPng(Buffer.from(output)).guides)
      .toEqual(guides);
  });

  it('preserves mirrored flexible-bubble target geometry', async () => {
    const project = projectWith({
      'chat.bubble.me.first.normal': asset(png(80, 70), {
        sourceScale: 2,
        mirroredFromPlatform: 'ios',
      }),
    });

    await renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    });

    expect(resizeToPng).toHaveBeenCalledWith({
      source: expect.any(Uint8Array),
      width: 120,
      height: 105,
      mode: 'stretch',
    });
  });

  it('creates both 0.1.3 maintab expectations and prepares each directory first', async () => {
    const target = buildNinePatchPng(png(10, 10), {
      stretch: { x: [0, 1], y: [0, 1] },
      content: {
        left: 0,
        top: 0,
        right: 1,
        bottom: 1,
      },
    });
    readOptionalBytes.mockResolvedValue(target);
    const events: string[] = [];
    ensureDirectory.mockImplementation(async (directory) => {
      events.push(`directory:${directory}`);
    });
    writeBytes.mockImplementation(async (destination) => {
      events.push(`write:${destination}`);
    });
    const project = projectWith({
      'main.tab.background': asset(png(5, 5)),
    });

    const expectedImages = await renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    });

    expect(expectedImages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'main.tab.background',
        sourcePath:
          'src/main/theme/drawable-xxhdpi/theme_maintab_cell_image.9.png',
        resourceKey: 'drawable/theme_maintab_cell_image',
        semanticQualifier: 'drawable-xxhdpi',
        ninePatch: true,
      }),
      expect.objectContaining({
        resourceId: 'main.tab.background',
        sourcePath:
          'src/main/theme/drawable-sw600dp/theme_maintab_cell_image.9.png',
        resourceKey: 'drawable/theme_maintab_cell_image',
        semanticQualifier: 'drawable-sw600dp',
        ninePatch: true,
      }),
    ]));
    expect(events).toEqual([
      'directory:/build/src/main/theme/drawable-xxhdpi',
      'write:/build/src/main/theme/drawable-xxhdpi/theme_maintab_cell_image.9.png',
      'directory:/build/src/main/theme/drawable-sw600dp',
      'write:/build/src/main/theme/drawable-sw600dp/theme_maintab_cell_image.9.png',
    ]);
  });

  it('maps image decode failure with only the safe resource id', async () => {
    const project = projectWith({
      'main.profile.02': {
        fileName: 'broken.png',
        dataUrl: 'data:text/plain;base64,dW5zYWZl',
      },
    });

    let failure: unknown;
    try {
      await renderAndroidImages({
        buildDirectory: '/build',
        project,
        files,
        paths,
        images,
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      code: 'KTB-IMAGE-DECODE',
      operation: 'theme:export-android',
      stage: 'Android 이미지 디코딩',
      safeContext: { resourceId: 'main.profile.02' },
    });
    expect(Object.keys(
      (failure as { safeContext: object }).safeContext,
    )).toEqual(['resourceId']);
  });

  it('maps template reads and output writes at their filesystem boundaries', async () => {
    const project = projectWith({
      'main.profile.02': asset(png(8, 8)),
    });
    const readCause = Object.assign(new Error('denied'), {
      code: 'EACCES',
    });
    readOptionalBytes.mockRejectedValueOnce(readCause);

    await expect(renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    })).rejects.toMatchObject({
      code: 'KTB-FS-READ',
      stage: 'Android 이미지 템플릿 읽기',
      safeContext: {
        resourceId: 'main.profile.02',
        systemCode: 'EACCES',
      },
    });

    readOptionalBytes.mockResolvedValue(null);
    writeBytes.mockRejectedValueOnce(
      Object.assign(new Error('full'), { code: 'ENOSPC' }),
    );
    await expect(renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    })).rejects.toMatchObject({
      code: 'KTB-FS-WRITE',
      stage: 'Android 이미지 리소스 쓰기',
      safeContext: {
        resourceId: 'main.profile.02',
        systemCode: 'ENOSPC',
      },
    });
  });

  it('maps a null image conversion as an image decode failure', async () => {
    resizeToPng.mockReturnValue(null);
    const project = projectWith({
      'main.profile.02': asset(png(8, 8)),
    });

    await expect(renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    })).rejects.toMatchObject({
      code: 'KTB-IMAGE-DECODE',
      stage: 'Android 이미지 변환',
      safeContext: { resourceId: 'main.profile.02' },
    });
  });

  it.each([
    'main.profile.02',
    'chat.bubble.me.first.normal',
  ] as const)(
    'rejects malformed present source bytes for %s before writing',
    async (resourceId) => {
      const project = projectWith({
        [resourceId]: asset(new Uint8Array([1, 2, 3, 4])),
      });

      await expect(renderAndroidImages({
        buildDirectory: '/build',
        project,
        files,
        paths,
        images,
      })).rejects.toMatchObject({
        code: 'KTB-IMAGE-DECODE',
        operation: 'theme:export-android',
        stage: 'Android 이미지 디코딩',
        safeContext: { resourceId },
      });
      expect(resizeToPng).not.toHaveBeenCalled();
      expect(writeBytes).not.toHaveBeenCalled();
    },
  );

  it('rejects a malformed present template before sizing or writing', async () => {
    readOptionalBytes.mockResolvedValue(
      new Uint8Array([1, 2, 3, 4]),
    );
    const project = projectWith({
      'main.profile.02': asset(png(8, 8)),
    });

    await expect(renderAndroidImages({
      buildDirectory: '/build',
      project,
      files,
      paths,
      images,
    })).rejects.toMatchObject({
      code: 'KTB-IMAGE-DECODE',
      operation: 'theme:export-android',
      stage: 'Android 이미지 템플릿 디코딩',
      safeContext: { resourceId: 'main.profile.02' },
    });
    expect(resizeToPng).not.toHaveBeenCalled();
    expect(writeBytes).not.toHaveBeenCalled();
  });
});
