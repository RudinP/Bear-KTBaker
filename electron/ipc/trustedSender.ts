import { ThemeStudioError } from '../../src/application/errors/ThemeStudioError';

export interface TrustedSenderPolicy {
  developmentServerUrl?: string;
  packagedRendererUrl: string;
}

export function assertTrustedSender(
  event: Pick<Electron.IpcMainInvokeEvent, 'senderFrame'>,
  policy: TrustedSenderPolicy,
): void {
  const rawUrl = event.senderFrame?.url;
  try {
    if (!rawUrl) throw new Error('missing sender URL');
    const actual = new URL(rawUrl);
    const packaged = new URL(policy.packagedRendererUrl);
    if (actual.href === packaged.href) return;
    if (policy.developmentServerUrl) {
      const development = new URL(policy.developmentServerUrl);
      if (actual.origin === development.origin) return;
    }
  } catch (cause) {
    throw new ThemeStudioError({
      code: 'KTB-IPC-UNTRUSTED-SENDER',
      operation: 'ipc:validate',
      stage: '요청 화면 검증',
      message: '허용되지 않은 화면 요청입니다.',
      cause,
    });
  }
  throw new ThemeStudioError({
    code: 'KTB-IPC-UNTRUSTED-SENDER',
    operation: 'ipc:validate',
    stage: '요청 화면 검증',
    message: '허용되지 않은 화면 요청입니다.',
  });
}
