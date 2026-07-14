import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../domain/theme';
import { ThemeSettings } from './ThemeSettings';

describe('guide-faithful theme icon settings', () => {
  it('separates the Android legacy icon from adaptive foreground and background layers', async () => {
    const project = createDefaultTheme();
    const onProject = vi.fn();
    render(<ThemeSettings project={project} platform="android" onProject={onProject} />);

    expect(screen.getByLabelText('Android 기본 앱 아이콘 이미지')).toBeInTheDocument();
    expect(screen.queryByText(/Android 기본 앱 아이콘 \(구형 기기\)/)).not.toBeInTheDocument();
    const adaptive = screen.getByRole('group', { name: 'Android 8 이상 적응형 앱 아이콘' });
    expect(adaptive).toHaveClass('adaptive-icon-settings');
    expect(adaptive.parentElement).toHaveClass('settings-card');
    expect(adaptive.parentElement).not.toHaveClass('settings-icon-column');
    expect(within(adaptive).getByText('전경과 배경 두 레이어가 함께 표시됩니다.')).toBeInTheDocument();
    expect(within(adaptive).getByLabelText('Android 적응형 전경 이미지')).toBeInTheDocument();
    expect(within(adaptive).getByLabelText('Android 적응형 배경 이미지')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Android .* 이미지/)).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Android 적응형 배경 이미지'), {
      target: { files: [new File(['background'], 'background.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(onProject).toHaveBeenCalled());
    expect(onProject.mock.calls.at(-1)?.[0].platformResources.android['common.app-icon.background'].fileName)
      .toBe('background.png');
    expect(onProject.mock.calls.at(-1)?.[0].platformResources.android['common.app-icon.background'].userSelected)
      .toBe(true);
  });

  it('uses the official commonIcoTheme slot for iPhone', () => {
    render(<ThemeSettings project={createDefaultTheme()} platform="ios" onProject={vi.fn()} />);
    expect(screen.getByLabelText('iPhone 테마 목록 아이콘 이미지')).toBeInTheDocument();
    expect(screen.queryByLabelText('Android 적응형 배경 이미지')).not.toBeInTheDocument();
  });

  it('does not duplicate export format selection inside theme information', () => {
    render(<ThemeSettings project={createDefaultTheme()} platform="ios" onProject={vi.fn()} />);

    expect(screen.queryByText('내보낼 플랫폼')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /iPhone \(\.ktheme\)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Android \(\.apk\)/ })).not.toBeInTheDocument();
  });

  it('exposes one common dark-mode switch backed by project appearance', () => {
    const project = createDefaultTheme();
    const onProject = vi.fn();
    const { rerender } = render(<ThemeSettings project={project} platform="ios" onProject={onProject} />);
    const toggle = screen.getByRole('checkbox', { name: '다크 모드 테마로 인식' });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(onProject.mock.calls.at(-1)?.[0].meta.appearance).toBe('dark');

    const dark = { ...project, meta: { ...project.meta, appearance: 'dark' as const } };
    rerender(<ThemeSettings project={dark} platform="android" onProject={onProject} />);
    expect(screen.getByRole('checkbox', { name: '다크 모드 테마로 인식' })).toBeChecked();
  });
});
