import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createDefaultTheme } from './domain/theme';
import { resolveResourceUrl } from './manifest/resourceResolver';
import { ANDROID_SAMPLE_COLORS, IOS_DEFAULT_COLORS, IOS_SAMPLE_ALPHAS } from './manifest/kakaoColors';

describe('theme editor', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete window.themeStudio;
  });

  it('always starts a new project from the complete official Apeach sample', () => {
    const project = createDefaultTheme();
    expect(project.baseSample).toBe('apeach');
    expect(project.colorValues.ios).toEqual({ ...IOS_DEFAULT_COLORS, ...IOS_SAMPLE_ALPHAS });
    expect(project.colorValues.android).toEqual(ANDROID_SAMPLE_COLORS);
    expect(resolveResourceUrl(project, 'ios', 'main.background')).toContain('/sample/ios/Images/mainBgImage@3x.png');
    expect(resolveResourceUrl(project, 'android', 'main.background')).toContain('/sample/android/src/main/theme/drawable-xxhdpi/theme_background_image.png');
  });
  it('opens with a phone preview and beginner-friendly screen navigation', () => {
    render(<App />);

    expect(screen.getByRole('textbox', { name: '상단 테마 이름' })).toHaveValue('새 카카오톡 테마');
    expect(screen.getByLabelText('카카오톡 미리보기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '채팅방' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('모든 변경사항 저장됨')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '화면에 맞춤' })).not.toBeInTheDocument();
  });

  it('uses the native window controls instead of drawing fake traffic lights on Windows', () => {
    window.themeStudio = {
      platform: 'win32',
      importTheme: vi.fn(),
      openProject: vi.fn(),
      saveProject: vi.fn(),
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    const { container } = render(<App />);

    expect(container.querySelector('.traffic-lights')).not.toBeInTheDocument();
    expect(container.querySelector('.app-toolbar')).not.toHaveClass('is-mac');
  });

  it('edits the theme name in the toolbar and keeps package metadata in a General-style tab', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '상단 테마 이름' }), { target: { value: '복숭아 테마' } });
    expect(screen.getByRole('textbox', { name: '상단 테마 이름' })).toHaveValue('복숭아 테마');

    fireEvent.click(screen.getByRole('button', { name: '테마 정보' }));
    expect(screen.getByRole('heading', { name: '테마 정보' })).toBeInTheDocument();
    expect(document.querySelector('.editor-layout')).toHaveClass('is-settings-layout');
    expect(screen.getByLabelText('버전')).toHaveValue('1.0.0');
    expect((screen.getByLabelText('테마 식별자') as HTMLInputElement).value).toContain('studio.theme.');
    expect(screen.getByLabelText('iPhone 테마 목록 아이콘 이미지')).toBeInTheDocument();
    expect(screen.queryByLabelText('카카오톡 미리보기')).not.toBeInTheDocument();
  });

  it('selects a bubble directly in the preview and edits its guide-mapped text color', () => {
    render(<App />);

    fireEvent.click(screen.getAllByTestId('bubble-me')[0]);
    const color = screen.getByLabelText('보낸 말풍선 글자 색상');
    fireEvent.change(color, { target: { value: '#ff3355' } });

    expect(screen.getByRole('heading', { name: '내가 보낸 말풍선' })).toBeInTheDocument();
    expect(screen.getAllByTestId('bubble-me')[0]).toHaveStyle({ color: '#ff3355' });
  });

  it('undoes and redoes real project changes', () => {
    render(<App />);
    fireEvent.click(screen.getAllByTestId('bubble-me')[0]);
    fireEvent.change(screen.getByLabelText('보낸 말풍선 글자 색상'), { target: { value: '#ff3355' } });

    expect(screen.getByRole('button', { name: '실행 취소' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(screen.getAllByTestId('bubble-me')[0]).not.toHaveStyle({ color: '#ff3355' });

    expect(screen.getByRole('button', { name: '다시 실행' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
    expect(screen.getAllByTestId('bubble-me')[0]).toHaveStyle({ color: '#ff3355' });
  });

  it('undoes an entire nine-patch drag as one history step after drop', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Android' }));
    fireEvent.click(screen.getAllByTestId('bubble-me')[0]);
    fireEvent.click(screen.getByRole('button', { name: '보낸 첫 말풍선 영역 조정' }));
    const coordinate = screen.getByLabelText('가로 늘림 끝 (px)');
    const start = Number((coordinate as HTMLInputElement).value);
    const canvas = document.querySelector<HTMLElement>('.patch-canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}),
    });
    const guide = screen.getByRole('button', { name: '상단 늘림 끝 마커' });
    guide.setPointerCapture = vi.fn();

    fireEvent.pointerDown(guide, { pointerId: 1, clientX: start });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: start + 1 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: start + 2 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: start + 4 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: start + 4 });
    expect(screen.getByLabelText('가로 늘림 끝 (px)')).toHaveValue(start + 4);

    fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(screen.getByLabelText('가로 늘림 끝 (px)')).toHaveValue(start);

    fireEvent.click(screen.getByRole('button', { name: '다시 실행' }));
    expect(screen.getByLabelText('가로 늘림 끝 (px)')).toHaveValue(start + 4);
  });

  it('connects macOS undo and redo shortcuts to project history', () => {
    render(<App />);
    fireEvent.click(screen.getAllByTestId('bubble-me')[0]);
    fireEvent.change(screen.getByLabelText('보낸 말풍선 글자 색상'), { target: { value: '#ff3355' } });

    expect(fireEvent.keyDown(window, { key: 'z', metaKey: true })).toBe(false);
    expect(screen.getAllByTestId('bubble-me')[0]).not.toHaveStyle({ color: '#ff3355' });

    expect(fireEvent.keyDown(window, { key: 'Z', metaKey: true, shiftKey: true })).toBe(false);
    expect(screen.getAllByTestId('bubble-me')[0]).toHaveStyle({ color: '#ff3355' });
  });

  it('connects Windows undo and both redo shortcuts to project history', () => {
    render(<App />);
    fireEvent.click(screen.getAllByTestId('bubble-me')[0]);
    fireEvent.change(screen.getByLabelText('보낸 말풍선 글자 색상'), { target: { value: '#ff3355' } });

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getAllByTestId('bubble-me')[0]).not.toHaveStyle({ color: '#ff3355' });

    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(screen.getAllByTestId('bubble-me')[0]).toHaveStyle({ color: '#ff3355' });

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(screen.getAllByTestId('bubble-me')[0]).toHaveStyle({ color: '#ff3355' });
  });

  it('applies Electron history commands through the same project history', () => {
    let historyCommand: ((command: 'undo' | 'redo') => void) | undefined;
    window.themeStudio = {
      platform: 'darwin',
      importTheme: vi.fn(),
      openProject: vi.fn(),
      saveProject: vi.fn(),
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
      onHistoryCommand: vi.fn((listener) => {
        historyCommand = listener;
        return () => undefined;
      }),
    };
    render(<App />);
    fireEvent.click(screen.getAllByTestId('bubble-me')[0]);
    fireEvent.change(screen.getByLabelText('보낸 말풍선 글자 색상'), { target: { value: '#ff3355' } });

    act(() => historyCommand?.('undo'));
    expect(screen.getAllByTestId('bubble-me')[0]).not.toHaveStyle({ color: '#ff3355' });

    act(() => historyCommand?.('redo'));
    expect(screen.getAllByTestId('bubble-me')[0]).toHaveStyle({ color: '#ff3355' });
  });

  it('routes native File menu commands through the same toolbar actions', async () => {
    let fileCommand: ((command: 'import-theme' | 'save-project' | 'finish-theme') => void) | undefined;
    const importTheme = vi.fn().mockResolvedValue(null);
    const saveProject = vi.fn().mockResolvedValue(null);
    window.themeStudio = {
      platform: 'darwin',
      importTheme,
      openProject: vi.fn(),
      saveProject,
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
      onFileCommand: vi.fn((listener) => {
        fileCommand = listener;
        return () => undefined;
      }),
    };
    render(<App />);

    await act(async () => fileCommand?.('import-theme'));
    expect(importTheme).toHaveBeenCalledTimes(1);

    await act(async () => fileCommand?.('save-project'));
    expect(saveProject).toHaveBeenCalledTimes(1);

    act(() => fileCommand?.('finish-theme'));
    expect(screen.getByRole('dialog', { name: '테마 완성하기' })).toBeInTheDocument();
  });

  it('shows all required message states while a bubble is selected', () => {
    render(<App />);
    fireEvent.click(screen.getAllByTestId('bubble-me')[0]);

    expect(screen.getByText('짧은 글')).toBeInTheDocument();
    expect(screen.getByText('긴 글')).toBeInTheDocument();
    expect(screen.getByText('답장')).toBeInTheDocument();
    expect(screen.getByText('연속 메시지')).toBeInTheDocument();
    expect(screen.getByText('꾹 눌렀을 때')).toBeInTheDocument();
    expect(screen.queryByText('실시간')).not.toBeInTheDocument();
    expect(screen.getByText('두 번째 말풍선').closest('.state-cell')).toHaveAttribute('data-resource-id', 'chat.bubble.me.grouped.normal');
    expect(screen.getByText('선택된 모습').closest('.state-cell')).toHaveAttribute('data-resource-id', 'chat.bubble.me.first.pressed');
    const miniBubbles = [...document.querySelectorAll('.mini-bubble')];
    expect(miniBubbles).toHaveLength(5);
    expect(miniBubbles.every((bubble) => bubble.querySelector('[data-renderer="ios-inset-nine-slice"]'))).toBe(true);
    expect(miniBubbles.every((bubble) => !bubble.querySelector('[data-renderer="android-nine-patch"]'))).toBe(true);
  });

  it('keeps the preview font in a separate global settings tab instead of the selected-element inspector', () => {
    render(<App />);

    expect(screen.queryByLabelText('미리보기 폰트 파일')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '글씨체' }));
    expect(screen.getByRole('heading', { name: '미리보기 글씨체' })).toBeInTheDocument();
    expect(screen.getByLabelText('미리보기 폰트 파일')).toBeInTheDocument();
    expect(screen.queryByLabelText('카카오톡 미리보기')).not.toBeInTheDocument();
  });

  it('zooms the preview from fixed bottom-right controls without adding a fit button', () => {
    render(<App />);

    const surface = screen.getByTestId('preview-zoom-surface');
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(surface).toHaveAttribute('data-zoom', '1');
    expect(screen.queryByRole('button', { name: '화면에 맞춤' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '미리보기 확대' }));
    expect(screen.getByText('105%')).toBeInTheDocument();
    expect(surface).toHaveAttribute('data-zoom', '1.05');

    for (let index = 0; index < 19; index += 1) fireEvent.click(screen.getByRole('button', { name: '미리보기 확대' }));
    expect(screen.getByText('200%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미리보기 확대' })).toBeDisabled();
  });

  it('zooms the preview with the mouse wheel and respects the minimum', () => {
    render(<App />);
    const stage = screen.getByTestId('preview-stage');

    fireEvent.wheel(stage, { deltaY: -100 });
    expect(screen.getByText('105%')).toBeInTheDocument();

    for (let index = 0; index < 11; index += 1) fireEvent.wheel(stage, { deltaY: 100 });
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미리보기 축소' })).toBeDisabled();
  });

  it('registers wheel zoom as a non-passive native listener so Electron can cancel scrolling', () => {
    const addEventListener = vi.spyOn(HTMLElement.prototype, 'addEventListener');

    render(<App />);

    expect(addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
    addEventListener.mockRestore();
  });

  it('leaves shift-wheel and horizontal trackpad gestures available for workspace scrolling', () => {
    render(<App />);
    const stage = screen.getByTestId('preview-stage');

    fireEvent.wheel(stage, { deltaY: 100, shiftKey: true });
    fireEvent.wheel(stage, { deltaX: 100, deltaY: 10 });

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('pans the preview with Space-drag and stops on pointer release or Space release without changing history', () => {
    render(<App />);
    const stage = screen.getByTestId('preview-stage');
    Object.defineProperties(stage, {
      scrollLeft: { value: 120, writable: true },
      scrollTop: { value: 80, writable: true },
    });
    stage.setPointerCapture = vi.fn();
    stage.releasePointerCapture = vi.fn();

    expect(fireEvent.keyDown(window, { key: ' ' })).toBe(false);
    expect(stage).toHaveClass('is-space-pan-ready');
    fireEvent.pointerDown(stage, { pointerId: 7, clientX: 300, clientY: 200 });
    expect(stage).toHaveClass('is-panning');
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 260, clientY: 150 });

    expect(stage.scrollLeft).toBe(160);
    expect(stage.scrollTop).toBe(130);
    expect(screen.getByRole('button', { name: '실행 취소' })).toBeDisabled();

    fireEvent.pointerUp(window, { pointerId: 7 });
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 200, clientY: 100 });
    expect(stage.scrollLeft).toBe(160);
    expect(stage.scrollTop).toBe(130);
    expect(stage).not.toHaveClass('is-panning');
    expect(stage).toHaveClass('is-space-pan-ready');

    expect(fireEvent.keyUp(window, { key: ' ' })).toBe(false);
    expect(stage).not.toHaveClass('is-space-pan-ready');
  });

  it('stops a Space-drag when capture is lost or the window blurs', () => {
    render(<App />);
    const stage = screen.getByTestId('preview-stage');
    Object.defineProperties(stage, {
      scrollLeft: { value: 10, writable: true },
      scrollTop: { value: 20, writable: true },
    });
    stage.setPointerCapture = vi.fn();
    stage.releasePointerCapture = vi.fn();

    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.pointerDown(stage, { pointerId: 3, clientX: 100, clientY: 100 });
    fireEvent.lostPointerCapture(stage, { pointerId: 3 });
    fireEvent.pointerMove(window, { pointerId: 3, clientX: 50, clientY: 50 });
    expect([stage.scrollLeft, stage.scrollTop]).toEqual([10, 20]);

    fireEvent.pointerDown(stage, { pointerId: 4, clientX: 100, clientY: 100 });
    fireEvent.blur(window);
    fireEvent.pointerMove(window, { pointerId: 4, clientX: 50, clientY: 50 });
    expect([stage.scrollLeft, stage.scrollTop]).toEqual([10, 20]);
    expect(stage).not.toHaveClass('is-space-pan-ready');
    expect(stage).not.toHaveClass('is-panning');
  });

  it('keeps Space available to editable controls and preview buttons', () => {
    render(<App />);
    const stage = screen.getByTestId('preview-stage');
    const themeName = screen.getByRole('textbox', { name: '상단 테마 이름' });
    const bubble = screen.getAllByTestId('bubble-me')[0];

    expect(fireEvent.keyDown(themeName, { key: ' ' })).toBe(true);
    expect(stage).not.toHaveClass('is-space-pan-ready');
    expect(fireEvent.keyDown(bubble, { key: ' ' })).toBe(true);
    expect(stage).not.toHaveClass('is-space-pan-ready');
  });

  it('keeps Space-drag panning attached after leaving and reopening the work canvas', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '테마 정보' }));
    expect(document.querySelector('.editor-layout')).toHaveClass('is-settings-layout');
    fireEvent.click(screen.getByRole('button', { name: '채팅방' }));
    expect(document.querySelector('.editor-layout')).not.toHaveClass('is-settings-layout');
    const stage = screen.getByTestId('preview-stage');
    Object.defineProperties(stage, {
      scrollLeft: { value: 0, writable: true },
      scrollTop: { value: 0, writable: true },
    });
    stage.setPointerCapture = vi.fn();
    stage.releasePointerCapture = vi.fn();

    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.pointerDown(stage, { pointerId: 8, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 8, clientX: 75, clientY: 70 });

    expect(stage.scrollLeft).toBe(25);
    expect(stage.scrollTop).toBe(30);
  });

  it('loads a saved project through the same beginner-friendly import button', async () => {
    const imported = createDefaultTheme('다시 연 프로젝트');
    imported.meta.author = '제작자';
    const importTheme = vi.fn().mockResolvedValue({ kind: 'project', project: imported });
    window.themeStudio = {
      platform: 'darwin',
      importTheme,
      openProject: vi.fn(),
      saveProject: vi.fn(),
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '불러오기' }));

    await waitFor(() => expect(screen.getByRole('textbox', { name: '상단 테마 이름' })).toHaveValue('다시 연 프로젝트'));
    expect(importTheme).toHaveBeenCalledTimes(1);
  });

  it('saves the complete editable project from the toolbar instead of a preview snapshot', async () => {
    const saveProject = vi.fn().mockResolvedValue('/tmp/복숭아.ktstudio');
    window.themeStudio = {
      platform: 'darwin',
      importTheme: vi.fn(),
      openProject: vi.fn(),
      saveProject,
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: '상단 테마 이름' }), { target: { value: '복숭아 테마' } });
    fireEvent.click(screen.getByRole('button', { name: '프로젝트 저장' }));

    await waitFor(() => expect(saveProject).toHaveBeenCalledTimes(1));
    const [content, suggestedName] = saveProject.mock.calls[0] as [string, string];
    expect(JSON.parse(content).meta.name).toBe('복숭아 테마');
    expect(JSON.parse(content).platformResources).toEqual({ ios: {}, android: {} });
    expect(suggestedName).toBe('복숭아 테마');
    expect(screen.getByRole('status', { name: '파일 작업 결과' })).toHaveTextContent('프로젝트를 저장했습니다.');
  });

  it('shows a plain-language error only after a real import failure', async () => {
    window.themeStudio = {
      platform: 'win32',
      importTheme: vi.fn().mockRejectedValue(new Error('손상된 테마 파일입니다.')),
      openProject: vi.fn(),
      saveProject: vi.fn(),
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    render(<App />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: '파일 작업 결과' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '불러오기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다. 손상된 테마 파일입니다.');
  });

  it('shows a bridge diagnostic import error without adding generic copy before its support code', async () => {
    const diagnostic = new Error([
      '[KTB-PROJECT-INVALID-FORMAT]',
      '테마 스튜디오 프로젝트 파일을 읽지 못했습니다.',
      '단계: 프로젝트 파일 검증',
    ].join('\n'));
    window.themeStudio = {
      platform: 'win32',
      importTheme: vi.fn().mockRejectedValue(diagnostic),
      openProject: vi.fn(),
      saveProject: vi.fn(),
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '불러오기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('[KTB-PROJECT-INVALID-FORMAT]');
    expect(screen.getByRole('alert')).toHaveTextContent('단계: 프로젝트 파일 검증');
    expect(screen.getByRole('alert').textContent?.startsWith('[KTB-PROJECT-INVALID-FORMAT]')).toBe(true);
  });

  it('keeps the current project and shows no success message when import is canceled', async () => {
    const importTheme = vi.fn().mockResolvedValue(null);
    window.themeStudio = {
      platform: 'darwin',
      importTheme,
      openProject: vi.fn(),
      saveProject: vi.fn(),
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: '상단 테마 이름' }), { target: { value: '계속 편집할 테마' } });
    fireEvent.click(screen.getByRole('button', { name: '불러오기' }));

    await waitFor(() => expect(importTheme).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('textbox', { name: '상단 테마 이름' })).toHaveValue('계속 편집할 테마');
    expect(screen.queryByRole('status', { name: '파일 작업 결과' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not claim a toolbar project save succeeded when its dialog is canceled', async () => {
    const saveProject = vi.fn().mockResolvedValue(null);
    window.themeStudio = {
      platform: 'win32',
      importTheme: vi.fn(),
      openProject: vi.fn(),
      saveProject,
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '프로젝트 저장' }));

    await waitFor(() => expect(saveProject).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('프로젝트를 저장했습니다.')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: '파일 작업 결과' })).not.toBeInTheDocument();
  });

  it('shows a toolbar project-save error only after the save IPC actually fails', async () => {
    window.themeStudio = {
      platform: 'darwin',
      importTheme: vi.fn(),
      openProject: vi.fn(),
      saveProject: vi.fn().mockRejectedValue(new Error('저장 폴더를 열 수 없습니다.')),
      exportIos: vi.fn(),
      exportAndroid: vi.fn(),
      saveScreenshots: vi.fn(),
    };

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '프로젝트 저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다. 저장 폴더를 열 수 없습니다.');
    expect(screen.queryByText('프로젝트를 저장했습니다.')).not.toBeInTheDocument();
  });

  it('auto-dismisses success and error file notices', async () => {
    vi.useFakeTimers();
    const imported = createDefaultTheme('다시 연 프로젝트');
    const importTheme = vi.fn()
      .mockResolvedValueOnce({ kind: 'project', project: imported })
      .mockRejectedValueOnce(new Error('손상된 테마 파일입니다.'));
    window.themeStudio = {
      platform: 'darwin', importTheme, openProject: vi.fn(), saveProject: vi.fn(),
      exportIos: vi.fn(), exportAndroid: vi.fn(), saveScreenshots: vi.fn(),
    };
    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '불러오기' }));
      await Promise.resolve();
    });
    expect(screen.getByRole('status', { name: '파일 작업 결과' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_000));
    expect(screen.queryByRole('status', { name: '파일 작업 결과' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '불러오기' }));
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('손상된 테마 파일입니다.');
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('restarts the transient notice timer when a notice is replaced and cleans it up on unmount', async () => {
    vi.useFakeTimers();
    const saveProject = vi.fn().mockResolvedValue('/tmp/project.ktstudio');
    window.themeStudio = {
      platform: 'darwin', importTheme: vi.fn(), openProject: vi.fn(), saveProject,
      exportIos: vi.fn(), exportAndroid: vi.fn(), saveScreenshots: vi.fn(),
    };
    const view = render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '프로젝트 저장' }));
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(2_000));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '프로젝트 저장' }));
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(1_001));
    expect(screen.getByRole('status', { name: '파일 작업 결과' })).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);

    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps project saving in the toolbar and completion limited to installable themes', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '테마 완성하기' }));

    expect(screen.getByRole('dialog', { name: '테마 완성하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iPhone 테마/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Android 테마/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /편집 프로젝트/ })).not.toBeInTheDocument();
  });
});
