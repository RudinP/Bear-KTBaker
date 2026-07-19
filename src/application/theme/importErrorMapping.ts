import { ThemeImportFailure } from '../../io/themeImport/importFailure';
import {
  normalizeThemeStudioError,
  ThemeStudioError,
} from '../errors/ThemeStudioError';
import { ERROR_CATALOG } from '../errors/errorCatalog';

export function mapThemeImportFailure(error: unknown): ThemeStudioError {
  if (error instanceof ThemeStudioError) return error;
  if (error instanceof ThemeImportFailure) {
    const codes = {
      'unsupported-format': 'KTB-THEME-UNSUPPORTED-FORMAT',
      'ios-archive': 'KTB-IOS-IMPORT-ARCHIVE',
      'ios-css': 'KTB-IOS-IMPORT-CSS',
      'android-archive': 'KTB-ANDROID-IMPORT-ARCHIVE',
      'android-image-recovery': 'KTB-ANDROID-IMAGE-RECOVERY',
    } as const;
    const code = codes[error.kind];
    const catalog = ERROR_CATALOG[code];
    return new ThemeStudioError({
      code,
      operation: 'theme:import',
      stage: catalog.stage,
      message: catalog.message,
      safeContext: error.safeContext,
      cause: error,
    });
  }
  return normalizeThemeStudioError(error, {
    code: 'KTB-UNKNOWN-UNEXPECTED',
    operation: 'theme:import',
    stage: '테마 가져오기',
    message: '테마를 가져오지 못했습니다.',
  });
}
