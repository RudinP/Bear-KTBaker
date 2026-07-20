// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../domain/theme/defaults';
import { THEME_STUDIO_UNAVAILABLE_MESSAGE, type ThemeStudioClient } from '../app/themeStudioClient';
import { ExportSheet } from './ExportSheet';

function client(overrides: Partial<Pick<ThemeStudioClient, 'exportIos' | 'exportAndroid'>> = {}) {
  return {
    isAvailable: () => true,
    exportIos: vi.fn(),
    exportAndroid: vi.fn(),
    ...overrides,
  };
}

describe('theme export sheet', () => {
  it('uses explicit file formats instead of invented platform glyphs', () => {
    const { container } = render(<ExportSheet project={createDefaultTheme()} onClose={() => undefined} />);

    expect([...container.querySelectorAll('.export-format')].map((element) => element.textContent)).toEqual([
      '.ktheme', '.apk',
    ]);
    expect(screen.queryByRole('button', { name: /편집 프로젝트/ })).not.toBeInTheDocument();
    expect(screen.queryByText('◆')).not.toBeInTheDocument();
    expect(screen.queryByText('⌘')).not.toBeInTheDocument();
  });

  it('reports a real export failure instead of leaving the save prompt visible', async () => {
    render(<ExportSheet project={createDefaultTheme()} onClose={() => undefined} client={client({
      exportIos: vi.fn().mockRejectedValue(new Error('iOS 템플릿을 읽지 못했습니다.')),
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /iPhone 테마/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('iOS 템플릿을 읽지 못했습니다.');
    expect(screen.queryByText('저장 위치를 선택해 주세요.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iPhone 테마/ })).toBeEnabled();
  });

  it('preserves an end-of-string support code from a structurally bridged export error', async () => {
    render(<ExportSheet project={createDefaultTheme()} onClose={() => undefined} client={client({
      exportIos: vi.fn().mockRejectedValue({ message: '[KTB-IOS-EXPORT-TEMPLATE]' }),
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /iPhone 테마/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('[KTB-IOS-EXPORT-TEMPLATE]');
    expect(alert.textContent?.startsWith('[KTB-IOS-EXPORT-TEMPLATE]')).toBe(true);
  });

  it('treats a canceled dialog as cancellation, never as a completed export', async () => {
    render(<ExportSheet project={createDefaultTheme()} onClose={() => undefined} client={client({
      exportIos: vi.fn().mockResolvedValue(null),
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /iPhone 테마/ }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('저장을 취소했습니다.'));
    expect(screen.queryByText(/ktheme 파일을 만들었습니다/)).not.toBeInTheDocument();
  });

  it('shows an Android builder error as an error rather than a successful APK export', async () => {
    const diagnostic = [
      '[KTB-ANDROID-AAPT2-COMPILE]',
      'Android 리소스 컴파일에 실패했습니다.',
      '단계: APK 리소스 컴파일',
      '원인: aapt2 종료 코드 1',
    ].join('\n');
    render(<ExportSheet project={createDefaultTheme()} onClose={() => undefined} client={client({
      exportAndroid: vi.fn().mockResolvedValue({ error: diagnostic }),
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /Android 테마/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('[KTB-ANDROID-AAPT2-COMPILE]');
    expect(screen.getByRole('alert')).toHaveTextContent('단계: APK 리소스 컴파일');
    expect(screen.getByRole('alert').textContent?.startsWith('[KTB-ANDROID-AAPT2-COMPILE]')).toBe(true);
    expect(screen.queryByText('Android용 APK 파일을 만들었습니다.')).not.toBeInTheDocument();
  });

  it('shows the stable bridge support message when the Electron API is unavailable', async () => {
    render(<ExportSheet project={createDefaultTheme()} onClose={() => undefined} client={{
      isAvailable: () => false,
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
    }} />);

    fireEvent.click(screen.getByRole('button', { name: /iPhone 테마/ }));

    const alert = await screen.findByRole('alert');
    for (const line of THEME_STUDIO_UNAVAILABLE_MESSAGE.split('\n')) {
      expect(alert).toHaveTextContent(line);
    }
  });
});
