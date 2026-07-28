import path from 'node:path';
import type { Aapt2FailureReason, AndroidStandaloneBuildStage } from './types';

export class AndroidStandaloneBuildError extends Error {
  readonly stage: AndroidStandaloneBuildStage;
  readonly exitCode?: number;
  readonly signal?: string;
  /** Raw aapt2 stdout/stderr, kept for main-process logs only — never forwarded to the renderer. */
  readonly diagnostics?: string;
  readonly toolReason?: Aapt2FailureReason;

  constructor(options: {
    stage: AndroidStandaloneBuildStage;
    message: string;
    exitCode?: number;
    signal?: string;
    diagnostics?: string;
    toolReason?: Aapt2FailureReason;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'AndroidStandaloneBuildError';
    this.stage = options.stage;
    this.exitCode = options.exitCode;
    this.signal = options.signal;
    this.diagnostics = options.diagnostics;
    this.toolReason = options.toolReason;
  }
}

const NON_ASCII_PATTERN = /[^\x00-\x7f]/;
const AAPT2_PATH_TOO_LONG_LIMIT = 240;
const AAPT2_OPEN_FAILURE_PATTERN = /failed to open|no such file|cannot open|not found/i;
const AAPT2_PERMISSION_DENIED_PATTERN = /permission denied|access is denied/i;

export function classifyAapt2Failure(options: {
  diagnostics?: string;
  cwd: string;
  args: readonly string[];
}): Aapt2FailureReason {
  const text = options.diagnostics ?? '';
  if (AAPT2_PERMISSION_DENIED_PATTERN.test(text)) return 'permission-denied';
  const opened = AAPT2_OPEN_FAILURE_PATTERN.test(text);
  const hasNonAscii = NON_ASCII_PATTERN.test(options.cwd)
    || options.args.some((arg) => NON_ASCII_PATTERN.test(arg));
  if (hasNonAscii && opened) return 'non-ascii-path';
  const resolvedTooLong = options.args.some(
    (arg) => path.resolve(options.cwd, arg).length > AAPT2_PATH_TOO_LONG_LIMIT,
  );
  if (resolvedTooLong) return 'path-too-long';
  if (opened) return 'missing-file';
  return 'unknown';
}

export function extractProcessDiagnostics(cause: unknown): string | undefined {
  if (!cause || typeof cause !== 'object') return undefined;
  const parts = [
    (cause as { stderr?: unknown }).stderr,
    (cause as { stdout?: unknown }).stdout,
  ]
    .map((value) => {
      if (typeof value === 'string') return value;
      if (Buffer.isBuffer(value)) return value.toString('utf8');
      return '';
    })
    .filter((value) => value.trim().length > 0);
  return parts.length > 0 ? parts.join('\n---\n').slice(0, 4000) : undefined;
}
