import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../domain/theme';
import { ExportSheet } from './ExportSheet';

describe('theme export sheet', () => {
  afterEach(() => {
    delete window.themeStudio;
  });

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
    window.themeStudio = {
      platform: 'darwin',
      openProject: vi.fn(),
      saveProject: vi.fn(),
      importTheme: vi.fn(),
      exportIos: vi.fn().mockRejectedValue(new Error('iOS 템플릿을 읽지 못했습니다.')),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    render(<ExportSheet project={createDefaultTheme()} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /iPhone 테마/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('iOS 템플릿을 읽지 못했습니다.');
    expect(screen.queryByText('저장 위치를 선택해 주세요.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iPhone 테마/ })).toBeEnabled();
  });

  it('treats a canceled dialog as cancellation, never as a completed export', async () => {
    window.themeStudio = {
      platform: 'win32',
      openProject: vi.fn(),
      saveProject: vi.fn(),
      importTheme: vi.fn(),
      exportIos: vi.fn().mockResolvedValue(null),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    render(<ExportSheet project={createDefaultTheme()} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /iPhone 테마/ }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('저장을 취소했습니다.'));
    expect(screen.queryByText(/ktheme 파일을 만들었습니다/)).not.toBeInTheDocument();
  });

  it('shows an Android builder error as an error rather than a successful APK export', async () => {
    window.themeStudio = {
      platform: 'darwin',
      openProject: vi.fn(),
      saveProject: vi.fn(),
      importTheme: vi.fn(),
      exportIos: vi.fn(),
      exportAndroid: vi.fn().mockResolvedValue({ error: 'APK 서명에 실패했습니다.' }),
      saveScreenshots: vi.fn(),
    };

    render(<ExportSheet project={createDefaultTheme()} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Android 테마/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('APK 서명에 실패했습니다.');
    expect(screen.queryByText('Android용 APK 파일을 만들었습니다.')).not.toBeInTheDocument();
  });
});
