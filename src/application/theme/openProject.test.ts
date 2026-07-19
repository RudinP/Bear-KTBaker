import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ThemeStudioError,
} from '../errors/ThemeStudioError';
import { createOpenProject } from './openProject';

describe('open project', () => {
  const selectFile = vi.fn();
  const readText = vi.fn();
  const openProject = createOpenProject({
    dialogs: { selectFile },
    files: { readText },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null on cancellation without reading a file', async () => {
    selectFile.mockResolvedValue(null);

    await expect(openProject()).resolves.toBeNull();
    expect(readText).not.toHaveBeenCalled();
  });

  it('forwards the project filter and returns the raw selected content', async () => {
    const content = '{\n  "schema": "raw and unparsed"\n}\n';
    selectFile.mockResolvedValue('/themes/bear.ktstudio');
    readText.mockResolvedValue(content);

    await expect(openProject()).resolves.toEqual({
      path: '/themes/bear.ktstudio',
      content,
    });
    expect(selectFile).toHaveBeenCalledWith({
      title: '테마 스튜디오 프로젝트 열기',
      filters: [{
        name: '테마 스튜디오 프로젝트',
        extensions: ['ktstudio'],
      }],
    });
    expect(readText).toHaveBeenCalledWith('/themes/bear.ktstudio');
  });

  it('normalizes a read failure at the project file boundary', async () => {
    const cause = Object.assign(new Error('disk offline'), {
      code: 'EIO',
    });
    selectFile.mockResolvedValue('/themes/bear.ktstudio');
    readText.mockRejectedValue(cause);

    await expect(openProject()).rejects.toMatchObject({
      code: 'KTB-FS-READ',
      operation: 'project:open',
      stage: '프로젝트 파일 읽기',
      message: '프로젝트 파일을 읽지 못했습니다.',
      cause,
      safeContext: { systemCode: 'EIO' },
    });
  });

  it('preserves an existing application error unchanged', async () => {
    const original = new ThemeStudioError({
      code: 'KTB-PROJECT-MIGRATION',
      operation: 'theme:import',
      stage: '기존 단계',
      message: '기존 오류입니다.',
      cause: new Error('original cause'),
    });
    selectFile.mockResolvedValue('/themes/bear.ktstudio');
    readText.mockRejectedValue(original);

    await expect(openProject()).rejects.toBe(original);
    expect(original).toMatchObject({
      code: 'KTB-PROJECT-MIGRATION',
      operation: 'theme:import',
      stage: '기존 단계',
      cause: original.cause,
    });
  });
});
