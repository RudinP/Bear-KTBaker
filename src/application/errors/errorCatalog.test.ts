import { describe, expect, it } from 'vitest';
import { ERROR_CATALOG } from './errorCatalog';

describe('diagnostic error catalog', () => {
  it('defines unique, searchable public error codes', () => {
    expect(new Set(Object.keys(ERROR_CATALOG)).size)
      .toBe(Object.keys(ERROR_CATALOG).length);
    expect(Object.keys(ERROR_CATALOG)).toHaveLength(23);
    expect(Object.keys(ERROR_CATALOG).every(
      (code) => /^KTB-[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(code),
    )).toBe(true);
  });

  it('keeps the catalog metadata stable', () => {
    expect(ERROR_CATALOG['KTB-ANDROID-AAPT2-COMPILE']).toEqual({
      operation: 'theme:export-android',
      stage: 'APK 리소스 컴파일',
      message: 'Android 리소스 컴파일에 실패했습니다.',
      source: 'electron/adapters/androidStandaloneBuild.ts#buildStandaloneAndroidApk.compile',
    });
    expect(ERROR_CATALOG['KTB-UNKNOWN-UNEXPECTED']).toEqual({
      operation: 'ipc:validate',
      stage: '알 수 없는 작업',
      message: '예상하지 못한 오류가 발생했습니다.',
      source: 'electron/ipc/errorBoundary.ts#withIpcErrorBoundary',
    });
  });
});
