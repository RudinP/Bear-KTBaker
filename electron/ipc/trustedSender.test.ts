import { describe, expect, it } from 'vitest';
import { assertTrustedSender } from './trustedSender';

function event(url?: string) {
  return {
    senderFrame: url === undefined ? null : { url },
  } as unknown as Electron.IpcMainInvokeEvent;
}

describe('assertTrustedSender', () => {
  const policy = {
    developmentServerUrl: 'http://localhost:5173/',
    packagedRendererUrl:
      'file:///Applications/Bear%20KTBaker/dist/index.html',
  };

  it('allows only the exact packaged renderer URL', () => {
    expect(() => assertTrustedSender(event(
      'file:///Applications/Bear%20KTBaker/dist/index.html',
    ), policy)).not.toThrow();
    expect(() => assertTrustedSender(event(
      'file:///Applications/Bear%20KTBaker/dist/other.html',
    ), policy)).toThrow(expect.objectContaining({
      code: 'KTB-IPC-UNTRUSTED-SENDER',
    }));
  });

  it('allows the development origin and rejects prefix lookalikes', () => {
    expect(() => assertTrustedSender(
      event('http://localhost:5173/settings?tab=theme'),
      policy,
    )).not.toThrow();
    expect(() => assertTrustedSender(
      event('http://localhost:5173.evil.test/'),
      policy,
    )).toThrow(expect.objectContaining({
      code: 'KTB-IPC-UNTRUSTED-SENDER',
    }));
  });

  it.each([undefined, 'not a URL'])(
    'rejects missing or malformed sender URL %s',
    (url) => {
      expect(() => assertTrustedSender(event(url), policy)).toThrow(
        expect.objectContaining({
          code: 'KTB-IPC-UNTRUSTED-SENDER',
        }),
      );
    },
  );
});
