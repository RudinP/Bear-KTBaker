import { describe, expect, it } from 'vitest';
import { ThemeImportFailure } from '../../io/themeImport/importFailure';
import { ThemeStudioError } from '../errors/ThemeStudioError';
import { mapThemeImportFailure } from './importErrorMapping';

describe('theme import error mapping', () => {
  it.each([
    ['unsupported-format', 'KTB-THEME-UNSUPPORTED-FORMAT', '테마 파일 형식 확인'],
    ['ios-archive', 'KTB-IOS-IMPORT-ARCHIVE', 'iPhone 테마 압축 읽기'],
    ['ios-css', 'KTB-IOS-IMPORT-CSS', 'iPhone 테마 CSS 읽기'],
    ['android-archive', 'KTB-ANDROID-IMPORT-ARCHIVE', 'Android 테마 압축 읽기'],
    ['android-image-recovery', 'KTB-ANDROID-IMAGE-RECOVERY', 'Android 이미지 복원'],
  ] as const)('maps %s to its stable diagnostic', (kind, code, stage) => {
    const cause = new Error('decoder detail');
    const failure = new ThemeImportFailure({
      kind,
      message: 'unsafe decoder detail',
      safeContext: {
        archiveKind: kind.startsWith('ios') ? 'ios' : 'apk',
      },
      cause,
    });

    expect(mapThemeImportFailure(failure)).toMatchObject({
      code,
      operation: 'theme:import',
      stage,
      safeContext: failure.safeContext,
      cause: failure,
    });
  });

  it('preserves an existing application error', () => {
    const original = new ThemeStudioError({
      code: 'KTB-FS-READ',
      operation: 'theme:import',
      stage: '선택한 테마 파일 읽기',
      message: '선택한 테마 파일을 읽지 못했습니다.',
    });

    expect(mapThemeImportFailure(original)).toBe(original);
  });

  it('normalizes an unexpected value without exposing its text', () => {
    const unexpected = new Error(
      '/Users/private/theme.apk aapt output contained private data',
    );

    expect(mapThemeImportFailure(unexpected)).toMatchObject({
      code: 'KTB-UNKNOWN-UNEXPECTED',
      operation: 'theme:import',
      stage: '테마 가져오기',
      message: '테마를 가져오지 못했습니다.',
      cause: unexpected,
      safeContext: undefined,
    });
  });
});
