import {
  normalizeThemeStudioError,
  ThemeStudioError,
} from '../errors/ThemeStudioError';
import { ERROR_CATALOG } from '../errors/errorCatalog';
import { ThemeProjectCodecFailure } from '../../domain/theme/codecFailure';

export function mapProjectCodecFailure(
  error: unknown,
  operation: 'project:save' | 'theme:import',
): ThemeStudioError {
  if (error instanceof ThemeStudioError) return error;
  if (error instanceof ThemeProjectCodecFailure) {
    const code = error.kind === 'migration'
      ? 'KTB-PROJECT-MIGRATION'
      : 'KTB-PROJECT-INVALID-FORMAT';
    const catalog = ERROR_CATALOG[code];
    return new ThemeStudioError({
      code,
      operation,
      stage: catalog.stage,
      message: catalog.message,
      cause: error,
    });
  }
  return normalizeThemeStudioError(error, {
    code: 'KTB-PROJECT-INVALID-FORMAT',
    operation,
    stage: '프로젝트 파일 검증',
    message: '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.',
  });
}
