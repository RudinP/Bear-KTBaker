export type ThemeImportFailureKind =
  | 'unsupported-format'
  | 'ios-archive'
  | 'ios-css'
  | 'android-archive'
  | 'android-image-recovery';

export class ThemeImportFailure extends Error {
  readonly kind: ThemeImportFailureKind;
  readonly safeContext?: Record<string, string>;

  constructor(options: {
    kind: ThemeImportFailureKind;
    message: string;
    safeContext?: Partial<Record<
      'archiveKind' | 'resourceId' | 'resourceKey',
      string
    >>;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'ThemeImportFailure';
    this.kind = options.kind;
    const safe = Object.fromEntries(
      Object.entries(options.safeContext ?? {}).filter(
        ([key, value]) =>
          ['archiveKind', 'resourceId', 'resourceKey'].includes(key)
          && typeof value === 'string',
      ),
    ) as Record<string, string>;
    this.safeContext = Object.keys(safe).length > 0 ? safe : undefined;
  }
}
