import path from 'node:path';
import { ThemeImportFailure } from './importFailure';

export type ThemeImportKind = 'project' | 'ios' | 'android-apk' | 'android-source';

export function detectThemeImportKind(fileName: string): ThemeImportKind {
  switch (path.extname(fileName).toLowerCase()) {
    case '.ktstudio': return 'project';
    case '.ktheme': return 'ios';
    case '.apk': return 'android-apk';
    case '.zip': return 'android-source';
    default:
      throw new ThemeImportFailure({
        kind: 'unsupported-format',
        message: '지원하지 않는 파일입니다. .ktstudio, .ktheme, .apk 또는 .zip 파일을 선택해 주세요.',
      });
  }
}
