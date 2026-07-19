import type { DiagnosticReporter } from '../../src/application/ports/diagnostics';

export function createConsoleDiagnosticReporter(
  log: typeof console.error = console.error,
): DiagnosticReporter {
  return {
    report(error) {
      log(`[${error.code}] ${error.message}`, {
        operation: error.operation,
        stage: error.stage,
        safeContext: error.safeContext,
        cause: error.cause,
      });
    },
  };
}
