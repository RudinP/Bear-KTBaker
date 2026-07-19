import { ERROR_CATALOG } from './errorCatalog';

const SUPPORT_CODE_FIRST_LINE = /^\[(KTB-[A-Z0-9]+(?:-[A-Z0-9]+)+)\](?:\n|$)/;

export function rendererOperationErrorText(error: unknown, fallback: string, unknownDetail: string) {
  const message = typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
    ? error.message
    : undefined;
  const supportCode = message?.match(SUPPORT_CODE_FIRST_LINE)?.[1];
  return supportCode && Object.hasOwn(ERROR_CATALOG, supportCode)
    ? message
    : `${fallback} ${message ?? unknownDetail}`;
}
