import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../../domain/theme/defaults';
import { decodeArchiveEntries } from '../../io/archiveEntries';
import { buildIosCss } from '../../io/iosTheme';
import type { ImageProcessorPort } from '../ports/imageProcessor';
import { createExportIosTheme } from './exportIosTheme';

const templateCss = [
  "ManifestStyle { -kakaotalk-theme-name: 'Template'; }",
  'MainViewStyle-Primary { color: #000000; }',
  '',
].join('\n');

async function archive(
  entries: Record<string, string | Uint8Array>,
  createFolders = true,
) {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(entries)) {
    zip.file(name, contents, { createFolders });
  }
  return zip.generateAsync({ type: 'uint8array' });
}

describe('export iOS theme', () => {
  const selectSavePath = vi.fn();
  const readBytes = vi.fn();
  const writeBytes = vi.fn();
  const dimensions = vi.fn<ImageProcessorPort['dimensions']>();
  const resizeToPng = vi.fn<ImageProcessorPort['resizeToPng']>();
  const images: ImageProcessorPort = { dimensions, resizeToPng };
  const exportIosTheme = createExportIosTheme({
    dialogs: { selectSavePath },
    files: { readBytes, writeBytes },
    images,
    iosTemplatePath: '/app/templates/ios-base.ktheme',
  });
  const project = createDefaultTheme('곰 테마', false);

  beforeEach(async () => {
    vi.clearAllMocks();
    selectSavePath.mockResolvedValue('/themes/bear.ktheme');
    readBytes.mockResolvedValue(await archive({
      'KakaoTalkTheme.css': templateCss,
      'Images/base.png': new Uint8Array([1, 2, 3]),
    }));
  });

  it('returns null on cancellation without reading, converting, or writing', async () => {
    selectSavePath.mockResolvedValue(null);

    await expect(exportIosTheme(project)).resolves.toBeNull();
    expect(readBytes).not.toHaveBeenCalled();
    expect(dimensions).not.toHaveBeenCalled();
    expect(resizeToPng).not.toHaveBeenCalled();
    expect(writeBytes).not.toHaveBeenCalled();
  });

  it('offers the project name and ktheme extension in the save dialog', async () => {
    await exportIosTheme(project);

    expect(selectSavePath).toHaveBeenCalledWith({
      title: 'iPhone 테마 저장',
      defaultPath: '곰 테마.ktheme',
      filters: [{
        name: '카카오톡 iPhone 테마',
        extensions: ['ktheme'],
      }],
    });
  });

  it('replaces KakaoTalkTheme.css with the exact generated CSS bytes', async () => {
    await expect(exportIosTheme(project))
      .resolves.toBe('/themes/bear.ktheme');
    const output = writeBytes.mock.calls[0][1] as Uint8Array;
    const entries = await decodeArchiveEntries(output);
    const css = entries.find(
      (entry) => entry.relativePath === 'KakaoTalkTheme.css',
    );

    expect(new TextDecoder().decode(css?.contents))
      .toBe(buildIosCss(project, templateCss));
    expect(writeBytes).toHaveBeenCalledWith(
      '/themes/bear.ktheme',
      expect.any(Uint8Array),
    );
  });

  it('reports a missing CSS entry as an iOS template failure', async () => {
    readBytes.mockResolvedValue(await archive({
      'Images/base.png': new Uint8Array([1, 2, 3]),
    }));

    await expect(exportIosTheme(project)).rejects.toMatchObject({
      code: 'KTB-IOS-EXPORT-TEMPLATE',
      operation: 'theme:export-ios',
      stage: 'iPhone 템플릿 CSS 읽기',
      message: 'iPhone 테마 템플릿 CSS를 읽지 못했습니다.',
    });
    expect(writeBytes).not.toHaveBeenCalled();
  });

  it('removes macOS junk from the written archive', async () => {
    readBytes.mockResolvedValue(await archive({
      'KakaoTalkTheme.css': templateCss,
      '__MACOSX/._KakaoTalkTheme.css': 'junk',
      '.DS_Store': 'junk',
      'Images/._base.png': 'junk',
      'Images/base.png': new Uint8Array([1, 2, 3]),
    }));

    await exportIosTheme(project);

    const output = writeBytes.mock.calls[0][1] as Uint8Array;
    const entries = await decodeArchiveEntries(output);
    expect(entries.map((entry) => entry.relativePath)).not.toEqual(
      expect.arrayContaining([
        '__MACOSX/',
        '__MACOSX/._KakaoTalkTheme.css',
        '.DS_Store',
        'Images/._base.png',
      ]),
    );
    expect(entries.map((entry) => entry.relativePath))
      .toContain('Images/base.png');
  });

  it('removes case-insensitive Apple metadata while preserving clean entry order and implicit Images', async () => {
    readBytes.mockResolvedValue(await archive({
      'KakaoTalkTheme.css': templateCss,
      '.ds_store': 'finder',
      '.COM.APPLE.QUARANTINE': 'quarantine',
      'Images/com.apple.metadata:kMDItemWhereFroms': 'metadata',
      'Images/nested/.Com.Apple.Metadata:FinderComment':
        'nested metadata',
      'Images/base.png': new Uint8Array([1, 2, 3]),
      'after.txt': 'after',
    }, false));

    await exportIosTheme(project);

    const output = writeBytes.mock.calls[0][1] as Uint8Array;
    const entries = await decodeArchiveEntries(output);
    expect(entries.map((entry) => entry.relativePath)).toEqual([
      'KakaoTalkTheme.css',
      'Images/base.png',
      'after.txt',
    ]);
  });

  it('normalizes output write failures at the filesystem boundary', async () => {
    const cause = Object.assign(new Error('read-only disk'), {
      code: 'EROFS',
    });
    writeBytes.mockRejectedValue(cause);

    await expect(exportIosTheme(project)).rejects.toMatchObject({
      code: 'KTB-FS-WRITE',
      operation: 'theme:export-ios',
      stage: 'iPhone 테마 파일 쓰기',
      message: 'iPhone 테마 파일을 저장하지 못했습니다.',
      safeContext: { systemCode: 'EROFS' },
      cause,
    });
  });
});
