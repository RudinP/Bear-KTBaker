import { describe, expect, it } from 'vitest';
import type { ThemeImportKind as FacadeThemeImportKind } from '../themeImport';
import { detectThemeImportKind } from './detectImportKind';
import { ThemeImportFailure } from './importFailure';

describe('detectThemeImportKind', () => {
  it('keeps the legacy facade type export compatible', () => {
    const kind: FacadeThemeImportKind = 'ios';

    expect(kind).toBe('ios');
  });

  it.each([
    ['theme.ktstudio', 'project'],
    ['theme.KTHEME', 'ios'],
    ['theme.APK', 'android-apk'],
    ['theme.zip', 'android-source'],
  ] as const)('detects %s as %s', (fileName, kind) => {
    expect(detectThemeImportKind(fileName)).toBe(kind);
  });

  it('reports an unsupported suffix as a safe import failure', () => {
    expect(() => detectThemeImportKind('theme.rar')).toThrow('지원하지 않는 파일입니다.');
    try {
      detectThemeImportKind('theme.rar');
    } catch (error) {
      expect(error).toBeInstanceOf(ThemeImportFailure);
      expect((error as ThemeImportFailure).kind).toBe('unsupported-format');
    }
  });
});
