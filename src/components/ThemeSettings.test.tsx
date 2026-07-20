// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseThemeProject } from '../domain/theme/codec';
import { createDefaultTheme } from '../domain/theme/defaults';
import type { ThemeProject } from '../domain/theme/model';
import { flatResourcesV1Fixture } from '../test/fixtures/legacyThemeProjects';
import { ThemeSettings } from './ThemeSettings';

const browserAssets = vi.hoisted(() => ({
  readImageAsset: vi.fn(),
}));

vi.mock('../app/browserAssets', () => browserAssets);

function changedProject(onProject: ReturnType<typeof vi.fn>, project: ThemeProject) {
  const change = onProject.mock.calls.at(-1)?.[0];
  expect(change).toBeTypeOf('function');
  return change(project);
}

describe('guide-faithful theme icon settings', () => {
  beforeEach(() => {
    browserAssets.readImageAsset.mockReset();
    browserAssets.readImageAsset.mockImplementation(async (file: File) => ({
      fileName: file.name,
      dataUrl: 'data:image/png;base64,aWNvbg==',
      width: 20,
      height: 20,
      sourceScale: 3,
      userSelected: true,
    }));
  });
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
    expect(changedProject(onProject, project)
      .platformResources.android['common.app-icon.background'].fileName)
      .toBe('background.png');
    expect(changedProject(onProject, project)
      .platformResources.android['common.app-icon.background'].userSelected)
      .toBe(true);
  });

  it('uses the official commonIcoTheme slot for iPhone', () => {
    render(<ThemeSettings project={createDefaultTheme()} platform="ios" onProject={vi.fn()} />);
    expect(screen.getByLabelText('iPhone 테마 목록 아이콘 이미지')).toBeInTheDocument();
    expect(screen.queryByLabelText('Android 적응형 배경 이미지')).not.toBeInTheDocument();
  });

  it('renders the migrated legacy theme icon instead of the sample icon', () => {
    const raw = flatResourcesV1Fixture();
    Object.assign(raw, { baseSample: 'apeach' });
    const project = parseThemeProject(JSON.stringify(raw));
    const { container } = render(
      <ThemeSettings project={project} platform="android" onProject={vi.fn()} />,
    );

    expect(container.querySelector('.app-icon-preview')).toHaveStyle({
      backgroundImage: `url(${project.platformResources.android['common.theme-icon'].dataUrl})`,
    });
  });

  it('renders a raw project without platformResources without crashing', () => {
    const project = createDefaultTheme();
    delete (project as Partial<ThemeProject>).platformResources;

    expect(() => render(
      <ThemeSettings project={project} platform="android" onProject={vi.fn()} />,
    )).not.toThrow();
  });

  it('initializes a missing platform bucket while preserving the other platform', async () => {
    const project = createDefaultTheme();
    const iosIcon = {
      fileName: 'ios.png',
      dataUrl: 'data:image/png;base64,aW9z',
      userSelected: true as const,
    };
    project.platformResources = {
      ios: { 'common.theme-icon': iosIcon },
    } as unknown as typeof project.platformResources;
    const onProject = vi.fn();
    render(<ThemeSettings project={project} platform="android" onProject={onProject} />);

    fireEvent.change(screen.getByLabelText('Android 기본 앱 아이콘 이미지'), {
      target: { files: [new File(['android'], 'android.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(onProject).toHaveBeenCalled());
    const updated = changedProject(onProject, project);
    expect(updated.platformResources.ios['common.theme-icon']).toEqual(iosIcon);
    expect(updated.platformResources.android['common.theme-icon']).toMatchObject({
      fileName: 'android.png', userSelected: true,
    });
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
    expect(changedProject(onProject, project).meta.appearance).toBe('dark');
    expect(onProject.mock.calls.at(-1)?.[1]).toEqual({
      mergeKey: 'meta:appearance',
    });

    const dark = { ...project, meta: { ...project.meta, appearance: 'dark' as const } };
    rerender(<ThemeSettings project={dark} platform="android" onProject={onProject} />);
    expect(screen.getByRole('checkbox', { name: '다크 모드 테마로 인식' })).toBeChecked();
  });

  it('applies a completed icon read to the latest project once', async () => {
    const project = createDefaultTheme();
    const onProject = vi.fn();
    render(<ThemeSettings project={project} platform="android" onProject={onProject} />);

    fireEvent.change(screen.getByLabelText('Android 기본 앱 아이콘 이미지'), {
      target: { files: [new File(['icon'], 'latest.png', { type: 'image/png' })] },
    });

    await waitFor(() => expect(onProject).toHaveBeenCalledOnce());
    expect(browserAssets.readImageAsset).toHaveBeenCalledOnce();
    const newer = { ...project, meta: { ...project.meta, author: 'later' } };
    const updated = changedProject(onProject, newer);
    expect(updated.meta.author).toBe('later');
    expect(updated.platformResources.android['common.theme-icon'].fileName)
      .toBe('latest.png');
  });

  it('merges consecutive edits to the same metadata field', () => {
    const project = createDefaultTheme();
    const onProject = vi.fn();
    render(<ThemeSettings project={project} platform="ios" onProject={onProject} />);

    fireEvent.change(screen.getByDisplayValue(project.meta.name), {
      target: { value: '다음 이름' },
    });

    expect(onProject.mock.calls.at(-1)?.[1]).toEqual({
      mergeKey: 'meta:name',
    });
  });
});
