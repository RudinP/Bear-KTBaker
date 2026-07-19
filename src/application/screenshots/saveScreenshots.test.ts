import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogPort } from '../ports/dialog';
import type { FileSystemPort, PathPort } from '../ports/fileSystem';

const imageCodec = vi.hoisted(() => ({
  decode: vi.fn(),
}));

vi.mock('../../io/imageDataUrl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../io/imageDataUrl')>();
  imageCodec.decode.mockImplementation(actual.decodeImageDataUrl);
  return {
    ...actual,
    decodeImageDataUrl: imageCodec.decode,
  };
});

import { createSaveScreenshots } from './saveScreenshots';

const png = (bytes: string) => `data:image/png;base64,${bytes}`;

describe('save screenshots', () => {
  const base64Decode = vi.spyOn(globalThis, 'atob');
  const selectDirectory = vi.fn<DialogPort['selectDirectory']>();
  const writeBytes = vi.fn<FileSystemPort['writeBytes']>();
  const join = vi.fn<PathPort['join']>(path.join);
  const basename = vi.fn<PathPort['basename']>(path.basename);
  const isAbsolute = vi.fn<PathPort['isAbsolute']>(path.isAbsolute);
  const saveScreenshots = createSaveScreenshots({
    dialogs: { selectDirectory },
    files: { writeBytes },
    paths: { join, basename, isAbsolute },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    selectDirectory.mockResolvedValue('/themes/screenshots');
    writeBytes.mockResolvedValue();
  });

  it('returns null on cancellation without decoding or writing', async () => {
    selectDirectory.mockResolvedValue(null);

    await expect(saveScreenshots([{
      name: 'preview.png',
      dataUrl: png('AAECA/7/'),
    }])).resolves.toBeNull();

    expect(imageCodec.decode).not.toHaveBeenCalled();
    expect(base64Decode).not.toHaveBeenCalled();
    expect(writeBytes).not.toHaveBeenCalled();
  });

  it('writes the exact PNG bytes and returns the selected directory', async () => {
    await expect(saveScreenshots([{
      name: 'preview.png',
      dataUrl: png('AAECA/7/'),
    }, {
      name: 'detail.png',
      dataUrl: png('/wABAg=='),
    }])).resolves.toBe('/themes/screenshots');

    expect(selectDirectory).toHaveBeenCalledWith({
      title: '홍보 이미지 저장 폴더',
      createDirectory: true,
    });
    expect(writeBytes).toHaveBeenNthCalledWith(
      1,
      path.join('/themes/screenshots', 'preview.png'),
      new Uint8Array([0, 1, 2, 3, 254, 255]),
    );
    expect(writeBytes).toHaveBeenNthCalledWith(
      2,
      path.join('/themes/screenshots', 'detail.png'),
      new Uint8Array([255, 0, 1, 2]),
    );
  });

  it.each([
    '',
    '/preview.png',
    'folder/preview.png',
    String.raw`folder\preview.png`,
    '.',
    '..',
  ])('rejects an unsafe screenshot name before opening the dialog: %s', async (name) => {
    await expect(saveScreenshots([{
      name,
      dataUrl: png('AA=='),
    }])).rejects.toMatchObject({
      code: 'KTB-IPC-INVALID-REQUEST',
      operation: 'screenshots:save',
      stage: '홍보 이미지 파일명 검증',
      message: '홍보 이미지 파일명이 올바르지 않습니다.',
    });

    expect(selectDirectory).not.toHaveBeenCalled();
    expect(imageCodec.decode).not.toHaveBeenCalled();
  });

  it('rejects a name whose basename differs before opening the dialog', async () => {
    basename.mockReturnValueOnce('preview.png');

    await expect(saveScreenshots([{
      name: 'different-name.png',
      dataUrl: png('AA=='),
    }])).rejects.toMatchObject({ code: 'KTB-IPC-INVALID-REQUEST' });

    expect(selectDirectory).not.toHaveBeenCalled();
  });

  it.each([
    'data:image/jpeg;base64,AA==',
    'data:image/webp;base64,AA==',
    'data:text/plain;base64,AA==',
    'data:image/png;base64,AA=A',
    'data:image/png;base64,@@@@',
    'data:image/png,AA==',
  ])('rejects an invalid screenshot data URL before opening the dialog: %s', async (dataUrl) => {
    await expect(saveScreenshots([{
      name: 'preview.png',
      dataUrl,
    }])).rejects.toMatchObject({
      code: 'KTB-IMAGE-DECODE',
      operation: 'screenshots:save',
      stage: '홍보 이미지 디코딩',
    });

    expect(selectDirectory).not.toHaveBeenCalled();
    expect(imageCodec.decode).not.toHaveBeenCalled();
  });

  it.each([
    'AA==',
    'AAA=',
  ])('accepts canonical padded PNG base64: %s', async (encoded) => {
    await expect(saveScreenshots([{
      name: 'preview.png',
      dataUrl: png(encoded),
    }])).resolves.toBe('/themes/screenshots');

    expect(selectDirectory).toHaveBeenCalledOnce();
    expect(writeBytes).toHaveBeenCalledOnce();
  });

  it.each([
    'AB==',
    'AAB=',
  ])('rejects PNG base64 with non-canonical unused pad bits: %s', async (encoded) => {
    await expect(saveScreenshots([{
      name: 'preview.png',
      dataUrl: png(encoded),
    }])).rejects.toMatchObject({
      code: 'KTB-IMAGE-DECODE',
      operation: 'screenshots:save',
      stage: '홍보 이미지 디코딩',
    });

    expect(selectDirectory).not.toHaveBeenCalled();
    expect(writeBytes).not.toHaveBeenCalled();
    expect(imageCodec.decode).not.toHaveBeenCalled();
    expect(base64Decode).not.toHaveBeenCalled();
  });

  it('normalizes a screenshot write failure', async () => {
    const cause = Object.assign(new Error('read-only disk'), {
      code: 'EROFS',
    });
    writeBytes.mockRejectedValueOnce(cause);

    await expect(saveScreenshots([{
      name: 'preview.png',
      dataUrl: png('AA=='),
    }])).rejects.toMatchObject({
      code: 'KTB-FS-WRITE',
      operation: 'screenshots:save',
      stage: '홍보 이미지 파일 쓰기',
      message: '홍보 이미지를 저장하지 못했습니다.',
      safeContext: { systemCode: 'EROFS' },
      cause,
    });
  });

  it('stops after a partial write failure without deleting earlier screenshots', async () => {
    const cause = new Error('disk full');
    writeBytes.mockResolvedValueOnce();
    writeBytes.mockRejectedValueOnce(cause);

    await expect(saveScreenshots([{
      name: 'first.png',
      dataUrl: png('AA=='),
    }, {
      name: 'second.png',
      dataUrl: png('AQ=='),
    }, {
      name: 'third.png',
      dataUrl: png('Ag=='),
    }])).rejects.toMatchObject({
      code: 'KTB-FS-WRITE',
      operation: 'screenshots:save',
      cause,
    });

    expect(writeBytes).toHaveBeenCalledTimes(2);
    expect(writeBytes).toHaveBeenNthCalledWith(
      1,
      path.join('/themes/screenshots', 'first.png'),
      new Uint8Array([0]),
    );
  });
});
