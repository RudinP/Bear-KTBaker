import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProjectCodecFailure } from '../../domain/theme/codecFailure';

const codecControl = vi.hoisted(() => ({
  events: [] as string[],
  failure: undefined as unknown,
}));

vi.mock('../../domain/theme/codec', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain/theme/codec')>();
  return {
    ...actual,
    parseThemeProject(source: string) {
      codecControl.events.push('validate');
      if (codecControl.failure !== undefined) throw codecControl.failure;
      return actual.parseThemeProject(source);
    },
  };
});

import { createSaveProject } from './saveProject';

const minimalProject = JSON.stringify({
  schema: 'kakao-theme-studio',
  schemaVersion: 1,
});
const legacyFixture = resolve(
  'src/test/fixtures/projects/partial-schema-v1.ktstudio',
);

describe('save project', () => {
  const selectSavePath = vi.fn(async (): Promise<string | null> => {
    codecControl.events.push('dialog');
    return '/themes/saved.ktstudio';
  });
  const writeText = vi.fn();
  const saveProject = createSaveProject({
    dialogs: { selectSavePath },
    files: { writeText },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    codecControl.events.length = 0;
    codecControl.failure = undefined;
    selectSavePath.mockResolvedValue('/themes/saved.ktstudio');
  });

  it('validates the project before opening the save dialog', async () => {
    selectSavePath.mockImplementationOnce(async () => {
      codecControl.events.push('dialog');
      return '/themes/saved.ktstudio';
    });

    await saveProject(minimalProject, 'bear');

    expect(codecControl.events).toEqual(['validate', 'dialog']);
  });

  it('rejects an invalid project before opening the dialog or writing', async () => {
    await expect(saveProject('{"schema":', 'bear')).rejects.toMatchObject({
      code: 'KTB-PROJECT-INVALID-FORMAT',
      operation: 'project:save',
      stage: '프로젝트 파일 검증',
      message: '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.',
    });
    expect(selectSavePath).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('preserves a migration failure before opening the dialog or writing', async () => {
    const codecFailure = new ThemeProjectCodecFailure({
      kind: 'migration',
      message: 'migration failed',
      cause: new Error('legacy value'),
    });
    codecControl.failure = codecFailure;

    await expect(saveProject(minimalProject, 'bear')).rejects.toMatchObject({
      code: 'KTB-PROJECT-MIGRATION',
      operation: 'project:save',
      stage: '이전 프로젝트 변환',
      message: '이전 버전 프로젝트를 변환하지 못했습니다.',
      cause: codecFailure,
    });
    expect(selectSavePath).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('returns null on cancellation without writing', async () => {
    selectSavePath.mockResolvedValue(null);

    await expect(saveProject(minimalProject, 'bear')).resolves.toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('uses a project extension in the default path', async () => {
    await saveProject(minimalProject, 'my bear theme');

    expect(selectSavePath).toHaveBeenCalledWith({
      defaultPath: 'my bear theme.ktstudio',
      filters: [{
        name: '테마 스튜디오 프로젝트',
        extensions: ['ktstudio'],
      }],
    });
  });

  it('validates a legacy fixture but writes its exact original text', async () => {
    const content = await readFile(legacyFixture, 'utf8');

    await expect(saveProject(content, 'legacy'))
      .resolves.toBe('/themes/saved.ktstudio');
    expect(writeText).toHaveBeenCalledWith(
      '/themes/saved.ktstudio',
      content,
    );
  });

  it('normalizes a write failure at the project file boundary', async () => {
    const cause = Object.assign(new Error('read-only disk'), {
      code: 'EROFS',
    });
    writeText.mockRejectedValue(cause);

    await expect(saveProject(minimalProject, 'bear')).rejects.toMatchObject({
      code: 'KTB-FS-WRITE',
      operation: 'project:save',
      stage: '프로젝트 파일 쓰기',
      message: '프로젝트 파일을 저장하지 못했습니다.',
      cause,
      safeContext: { systemCode: 'EROFS' },
    });
  });
});
