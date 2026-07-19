import type { ThemeProject } from './model';
import {
  migrateSchemaV1Project,
  type SchemaV1ProjectEnvelope,
} from './migrations';
import { ThemeProjectCodecFailure } from './codecFailure';

export function serializeThemeProject(project: ThemeProject): string {
  return JSON.stringify(project, null, 2);
}

export function parseThemeProject(source: string): ThemeProject {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (cause) {
    throw new ThemeProjectCodecFailure({
      kind: 'invalid-format',
      message: '테마 스튜디오 프로젝트 파일이 아닙니다.',
      cause,
    });
  }
  if (
    value === null ||
    typeof value !== 'object' ||
    (value as { schema?: unknown }).schema !== 'kakao-theme-studio' ||
    (value as { schemaVersion?: unknown }).schemaVersion !== 1
  ) {
    throw new ThemeProjectCodecFailure({
      kind: 'invalid-format',
      message: '테마 스튜디오 프로젝트 파일이 아닙니다.',
    });
  }
  try {
    return migrateSchemaV1Project(value as SchemaV1ProjectEnvelope);
  } catch (cause) {
    if (cause instanceof ThemeProjectCodecFailure) throw cause;
    throw new ThemeProjectCodecFailure({
      kind: 'migration',
      message: '이전 버전 프로젝트를 변환하지 못했습니다.',
      cause,
    });
  }
}
