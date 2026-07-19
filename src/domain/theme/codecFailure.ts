export type ThemeProjectCodecFailureKind =
  | 'invalid-format'
  | 'migration';

export class ThemeProjectCodecFailure extends Error {
  readonly kind: ThemeProjectCodecFailureKind;

  constructor(options: {
    kind: ThemeProjectCodecFailureKind;
    message: string;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'ThemeProjectCodecFailure';
    this.kind = options.kind;
  }
}
