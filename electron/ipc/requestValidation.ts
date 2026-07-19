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

const MAX_JSON_DEPTH = 64;
const INVALID_JSON_VALUE = Symbol('invalid JSON value');

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
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (
    prototype === Object.prototype
    || prototype === null
  ) && !hasEnumerableInheritedProperty(value);
}

function hasEnumerableInheritedProperty(value: object) {
  let prototype = Object.getPrototypeOf(value);
  while (prototype !== null) {
    if (Reflect.ownKeys(prototype).some(
      (key) =>
        Object.getOwnPropertyDescriptor(prototype, key)?.enumerable,
    )) {
      return true;
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  return false;
}

function exactRecordValues(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length
    || keys.some(
      (key) =>
        typeof key !== 'string'
        || !expectedKeys.includes(key),
    )
  ) {
    return undefined;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !descriptor.enumerable
      || !Object.hasOwn(descriptor, 'value')
    ) {
      return undefined;
    }
    result[key] = descriptor.value;
  }
  return result;
}

function exactArrayValues(value: unknown): unknown[] | undefined {
  if (
    !Array.isArray(value)
    || Object.getPrototypeOf(value) !== Array.prototype
    || hasEnumerableInheritedProperty(value)
  ) {
    return undefined;
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== value.length + 1
    || keys.some(
      (key) =>
        typeof key !== 'string'
        || (
          key !== 'length'
          && !isArrayIndex(key, value.length)
        ),
    )
  ) {
    return undefined;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      !descriptor
      || !descriptor.enumerable
      || !Object.hasOwn(descriptor, 'value')
    ) {
      return undefined;
    }
    result.push(descriptor.value);
  }
  return result;
}

function isArrayIndex(key: string, length: number) {
  if (!/^(?:0|[1-9]\d*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index)
    && index >= 0
    && index < length
    && String(index) === key;
}

function copyInertJson(
  value: unknown,
  ancestors: WeakSet<object>,
  depth: number,
): unknown {
  if (depth > MAX_JSON_DEPTH) throw INVALID_JSON_VALUE;
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw INVALID_JSON_VALUE;
    return value;
  }
  if (typeof value !== 'object') throw INVALID_JSON_VALUE;
  if (ancestors.has(value)) throw INVALID_JSON_VALUE;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const values = exactArrayValues(value);
      if (!values) throw INVALID_JSON_VALUE;
      const copy: unknown[] = [];
      Object.setPrototypeOf(copy, null);
      for (let index = 0; index < values.length; index += 1) {
        copy[index] = copyInertJson(
          values[index],
          ancestors,
          depth + 1,
        );
      }
      return copy;
    }
    if (!isRecord(value)) throw INVALID_JSON_VALUE;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') throw INVALID_JSON_VALUE;
      const descriptor = descriptors[key];
      if (
        !descriptor
        || !descriptor.enumerable
        || !Object.hasOwn(descriptor, 'value')
      ) {
        throw INVALID_JSON_VALUE;
      }
      copy[key] = copyInertJson(
        descriptor.value,
        ancestors,
        depth + 1,
      );
    }
    return copy;
  } finally {
    ancestors.delete(value);
  }
}

export function parseProjectSaveRequest(
  value: unknown,
): ProjectSaveRequest {
  const request = exactRecordValues(value, [
    'content',
    'suggestedName',
  ]);
  if (
    !request
    || typeof request.content !== 'string'
    || typeof request.suggestedName !== 'string'
    || request.suggestedName.trim().length === 0
  ) {
    throw invalidRequest();
  }
  return {
    content: request.content,
    suggestedName: request.suggestedName,
  };
}

export function parseThemeProjectRequest(
  value: unknown,
): ThemeProject {
  try {
    if (!isRecord(value)) throw INVALID_JSON_VALUE;
    const copy = copyInertJson(value, new WeakSet(), 1);
    return parseThemeProject(JSON.stringify(copy));
  } catch (cause) {
    throw invalidRequest(cause);
  }
}

export function parseScreenshotSaveRequests(
  value: unknown,
): ScreenshotSaveRequest[] {
  const candidates = exactArrayValues(value);
  if (!candidates) throw invalidRequest();
  return candidates.map((candidate) => {
    const screenshot = exactRecordValues(candidate, [
      'name',
      'dataUrl',
    ]);
    if (
      !screenshot
      || typeof screenshot.name !== 'string'
      || screenshot.name.length === 0
      || screenshot.name.includes('/')
      || screenshot.name.includes('\\')
      || typeof screenshot.dataUrl !== 'string'
      || !screenshot.dataUrl.startsWith('data:image/')
    ) {
      throw invalidRequest();
    }
    return {
      name: screenshot.name,
      dataUrl: screenshot.dataUrl,
    };
  });
}
