import { describe, expect, it, vi } from 'vitest';
import { ThemeStudioError } from '../../src/application/errors/ThemeStudioError';
import { withIpcErrorBoundary } from './errorBoundary';
import { assertTrustedSender } from './trustedSender';

const fallback = {
  code: 'KTB-UNKNOWN-UNEXPECTED' as const,
  operation: 'ipc:validate' as const,
  stage: '알 수 없는 작업',
  message: '예상하지 못한 오류가 발생했습니다.',
};

function event(url?: string): Electron.IpcMainInvokeEvent {
  return {
    senderFrame: url === undefined ? null : { url },
  } as unknown as Electron.IpcMainInvokeEvent;
}

describe('IPC error boundary', () => {
  it('wraps successful and cancelled values without reporting', async () => {
    const report = vi.fn();
    const wrapped = withIpcErrorBoundary(
      fallback,
      vi.fn().mockResolvedValue(null),
      report,
    );

    await expect(wrapped(event('file:///app/dist/index.html')))
      .resolves.toEqual({ ok: true, value: null });
    expect(report).not.toHaveBeenCalled();
  });

  it('preserves a ThemeStudioError and reports it exactly once', async () => {
    const typed = new ThemeStudioError({
      code: 'KTB-IPC-INVALID-REQUEST',
      operation: 'ipc:validate',
      stage: '요청 데이터 검증',
      message: '앱 요청 데이터가 올바르지 않습니다.',
    });
    const report = vi.fn();
    const wrapped = withIpcErrorBoundary(
      fallback,
      () => {
        throw typed;
      },
      report,
    );

    await expect(wrapped(event())).resolves.toEqual({
      ok: false,
      error: {
        name: 'ThemeStudioError',
        code: 'KTB-IPC-INVALID-REQUEST',
        operation: 'ipc:validate',
        stage: '요청 데이터 검증',
        message: '앱 요청 데이터가 올바르지 않습니다.',
      },
    });
    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(typed);
  });

  it('normalizes an unknown throw and retains it as the in-process cause', async () => {
    const cause = new Error('private native failure');
    const report = vi.fn();
    const wrapped = withIpcErrorBoundary(
      fallback,
      () => {
        throw cause;
      },
      report,
    );

    await expect(wrapped(event())).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'KTB-UNKNOWN-UNEXPECTED',
        operation: 'ipc:validate',
      },
    });
    const normalized = report.mock.calls[0]?.[0];
    expect(normalized).toBeInstanceOf(ThemeStudioError);
    expect(normalized?.cause).toBe(cause);
    expect(report).toHaveBeenCalledOnce();
  });
});

describe('trusted IPC sender', () => {
  const policy = {
    developmentServerUrl: 'http://localhost:5173/',
    packagedRendererUrl: 'file:///Applications/Bear%20KTBaker/dist/index.html',
  };

  it('accepts only the exact packaged renderer URL', () => {
    expect(() => assertTrustedSender(event(
      'file:///Applications/Bear%20KTBaker/dist/index.html',
    ), policy)).not.toThrow();

    for (const url of [
      'file:///Applications/Bear%20KTBaker/dist/other.html',
      'file:///Applications/Bear%20KTBaker/dist/index.html/extra',
    ]) {
      expect(() => assertTrustedSender(event(url), policy)).toThrow(
        expect.objectContaining({ code: 'KTB-IPC-UNTRUSTED-SENDER' }),
      );
    }
  });

  it('accepts the exact development origin and rejects prefix lookalikes', () => {
    expect(() => assertTrustedSender(
      event('http://localhost:5173/settings?tab=theme'),
      policy,
    )).not.toThrow();

    for (const url of [
      'http://localhost:5173.evil.test/',
      'http://localhost:5174/',
      'https://localhost:5173/',
    ]) {
      expect(() => assertTrustedSender(event(url), policy)).toThrow(
        expect.objectContaining({ code: 'KTB-IPC-UNTRUSTED-SENDER' }),
      );
    }
  });

  it('rejects missing and malformed sender URLs with the public IPC code', async () => {
    const wrapped = withIpcErrorBoundary(fallback, (ipcEvent) => {
      assertTrustedSender(ipcEvent, policy);
      return null;
    });

    for (const untrusted of [event(), event('not a URL')]) {
      const failed = await wrapped(untrusted);
      expect(failed.ok).toBe(false);
      if (!failed.ok) {
        expect(failed.error.code).toBe('KTB-IPC-UNTRUSTED-SENDER');
      }
    }
  });
});
