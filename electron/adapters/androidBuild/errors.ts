import type { AndroidStandaloneBuildStage } from './types';

export class AndroidStandaloneBuildError extends Error {
  readonly stage: AndroidStandaloneBuildStage;
  readonly exitCode?: number;
  readonly signal?: string;

  constructor(options: {
    stage: AndroidStandaloneBuildStage;
    message: string;
    exitCode?: number;
    signal?: string;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'AndroidStandaloneBuildError';
    this.stage = options.stage;
    this.exitCode = options.exitCode;
    this.signal = options.signal;
  }
}
