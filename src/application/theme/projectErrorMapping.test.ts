import { describe, expect, it } from 'vitest';
import { ThemeProjectCodecFailure } from '../../domain/theme/codecFailure';
import { ThemeStudioError } from '../errors/ThemeStudioError';
import { mapProjectCodecFailure } from './projectErrorMapping';

describe('project codec error mapping', () => {
  it.each([
    {
      kind: 'invalid-format' as const,
      operation: 'project:save' as const,
      code: 'KTB-PROJECT-INVALID-FORMAT',
      stage: '프로젝트 파일 검증',
      message: '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.',
    },
    {
      kind: 'migration' as const,
      operation: 'theme:import' as const,
      code: 'KTB-PROJECT-MIGRATION',
      stage: '이전 프로젝트 변환',
      message: '이전 버전 프로젝트를 변환하지 못했습니다.',
    },
  ])(
    'maps $kind to $code while retaining the codec failure',
    ({ kind, operation, code, stage, message }) => {
      const codecFailure = new ThemeProjectCodecFailure({
        kind,
        message: 'codec detail',
        cause: new Error('codec cause'),
      });

      expect(mapProjectCodecFailure(codecFailure, operation)).toMatchObject({
        code,
        operation,
        stage,
        message,
        cause: codecFailure,
      });
    },
  );

  it('preserves an existing application error unchanged', () => {
    const original = new ThemeStudioError({
      code: 'KTB-FS-READ',
      operation: 'project:open',
      stage: '기존 단계',
      message: '기존 오류입니다.',
      cause: new Error('original cause'),
    });

    expect(mapProjectCodecFailure(original, 'theme:import')).toBe(original);
  });

  it('normalizes an unexpected parser failure as invalid format', () => {
    const cause = new Error('unexpected parser failure');

    expect(mapProjectCodecFailure(cause, 'project:save')).toMatchObject({
      code: 'KTB-PROJECT-INVALID-FORMAT',
      operation: 'project:save',
      stage: '프로젝트 파일 검증',
      message: '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.',
      cause,
    });
  });
});
