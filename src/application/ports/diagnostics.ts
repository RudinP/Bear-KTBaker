import type { ThemeStudioError } from '../errors/ThemeStudioError';

export interface DiagnosticReporter {
  report(error: ThemeStudioError): void;
}
