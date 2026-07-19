import { ThemeStudioError } from '../../src/application/errors/ThemeStudioError';
import {
  parseThemeProject,
  type ThemeProject,
} from '../../src/domain/theme';

export interface ProjectSaveRequest {
  content: string;
  suggestedName: string;
}

export interface ScreenshotSaveRequest {
  name: string;
  dataUrl: string;
}

function invalidRequest(cause?: unknown) {
  return new ThemeStudioError({
    code: 'KTB-IPC-INVALID-REQUEST',
    operation: 'ipc:validate',
    stage: '요청 데이터 검증',
    message: '앱 요청 데이터가 올바르지 않습니다.',
    cause,
  });
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value);
}

export function parseProjectSaveRequest(
  value: unknown,
): ProjectSaveRequest {
  if (
    !isRecord(value)
    || typeof value.content !== 'string'
    || typeof value.suggestedName !== 'string'
    || value.suggestedName.trim().length === 0
  ) {
    throw invalidRequest();
  }
  return {
    content: value.content,
    suggestedName: value.suggestedName,
  };
}

export function parseThemeProjectRequest(
  value: unknown,
): ThemeProject {
  if (!isRecord(value)) throw invalidRequest();
  try {
    return parseThemeProject(JSON.stringify(value));
  } catch (cause) {
    throw invalidRequest(cause);
  }
}

export function parseScreenshotSaveRequests(
  value: unknown,
): ScreenshotSaveRequest[] {
  if (!Array.isArray(value)) throw invalidRequest();
  return value.map((candidate) => {
    if (
      !isRecord(candidate)
      || typeof candidate.name !== 'string'
      || candidate.name.length === 0
      || candidate.name.includes('/')
      || candidate.name.includes('\\')
      || typeof candidate.dataUrl !== 'string'
      || !candidate.dataUrl.startsWith('data:image/')
    ) {
      throw invalidRequest();
    }
    return {
      name: candidate.name,
      dataUrl: candidate.dataUrl,
    };
  });
}
