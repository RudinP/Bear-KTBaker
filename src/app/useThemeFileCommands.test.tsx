// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../domain/theme/defaults';
import type { ThemeProject } from '../domain/theme/model';
import {
  THEME_STUDIO_UNAVAILABLE_MESSAGE,
  type ThemeFileCommand,
  type ThemeStudioClient,
} from './themeStudioClient';
import { type FileNotice, useThemeFileCommands } from './useThemeFileCommands';

type FileClient = Pick<
  ThemeStudioClient,
  'isAvailable' | 'importTheme' | 'saveProject' | 'subscribeFileCommands'
>;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createFakeClient() {
  let listener: ((command: ThemeFileCommand) => void) | undefined;
  const unsubscribe = vi.fn();
  const client: FileClient = {
    isAvailable: vi.fn(() => true),
    importTheme: vi.fn().mockResolvedValue(null),
    saveProject: vi.fn().mockResolvedValue(null),
    subscribeFileCommands: vi.fn((next) => {
      listener = next;
      return unsubscribe;
    }),
  };

  return {
    client,
    emit(command: ThemeFileCommand) {
      listener?.(command);
    },
    unsubscribe,
  };
}

function renderFileCommands({
  project = createDefaultTheme('계속 편집'),
  client = createFakeClient().client,
  replaceProject = vi.fn(),
}: {
  project?: ThemeProject;
  client?: FileClient;
  replaceProject?: (next: ThemeProject) => void;
} = {}) {
  return renderHook(() => useThemeFileCommands({
    project,
    replaceProject,
    client,
  }));
}

describe('useThemeFileCommands', () => {
  afterEach(() => vi.useRealTimers());

  it('routes native commands, preserving cancellation without a notice', async () => {
    const fake = createFakeClient();
    const replaceProject = vi.fn();
    const { result } = renderFileCommands({ client: fake.client, replaceProject });

    await act(async () => fake.emit('import-theme'));
    expect(replaceProject).not.toHaveBeenCalled();
    expect(result.current.fileNotice).toBeNull();

    act(() => fake.emit('finish-theme'));
    expect(result.current.showExport).toBe(true);
  });

  it('replaces the project and announces a successful import', async () => {
    const fake = createFakeClient();
    const imported = createDefaultTheme('불러온 테마');
    vi.mocked(fake.client.importTheme).mockResolvedValue({ kind: 'project', project: imported });
    const replaceProject = vi.fn();
    const { result } = renderFileCommands({ client: fake.client, replaceProject });

    await act(async () => result.current.openTheme());

    expect(replaceProject).toHaveBeenCalledWith(imported);
    const notice: FileNotice = {
      kind: 'status', text: '테마와 프로젝트 내용을 불러왔습니다.',
    };
    expect(result.current.fileNotice).toEqual(notice);
  });

  it('serializes the current project and announces a successful save', async () => {
    const fake = createFakeClient();
    const project = createDefaultTheme('복숭아 테마');
    vi.mocked(fake.client.saveProject).mockResolvedValue('/tmp/복숭아.ktstudio');
    const { result } = renderFileCommands({ client: fake.client, project });

    await act(async () => result.current.saveProject());

    expect(fake.client.saveProject).toHaveBeenCalledWith(
      expect.stringContaining('복숭아 테마'),
      '복숭아 테마',
    );
    expect(result.current.fileNotice).toEqual({ kind: 'status', text: '프로젝트를 저장했습니다.' });
  });

  it('preserves save cancellation without a notice', async () => {
    const fake = createFakeClient();
    const { result } = renderFileCommands({ client: fake.client });

    await act(async () => result.current.saveProject());

    expect(result.current.fileNotice).toBeNull();
  });

  it('keeps structured bridge diagnostics unchanged', async () => {
    const fake = createFakeClient();
    const diagnostic = new Error('[KTB-PROJECT-INVALID-FORMAT]\n단계: 프로젝트 파일 검증');
    vi.mocked(fake.client.importTheme).mockRejectedValue(diagnostic);
    const { result } = renderFileCommands({ client: fake.client });

    await act(async () => result.current.openTheme());

    expect(result.current.fileNotice).toEqual({ kind: 'error', text: diagnostic.message });
  });

  it('adds plain-language context to ordinary save failures', async () => {
    const fake = createFakeClient();
    vi.mocked(fake.client.saveProject).mockRejectedValue(new Error('저장 폴더를 열 수 없습니다.'));
    const { result } = renderFileCommands({ client: fake.client });

    await act(async () => result.current.saveProject());

    expect(result.current.fileNotice).toEqual({
      kind: 'error', text: '저장하지 못했습니다. 저장 폴더를 열 수 없습니다.',
    });
  });

  it('reports an unavailable renderer bridge without calling native operations', async () => {
    const fake = createFakeClient();
    vi.mocked(fake.client.isAvailable).mockReturnValue(false);
    const { result } = renderFileCommands({ client: fake.client });

    await act(async () => result.current.openTheme());

    expect(fake.client.importTheme).not.toHaveBeenCalled();
    expect(result.current.fileNotice).toEqual({
      kind: 'error', text: THEME_STUDIO_UNAVAILABLE_MESSAGE,
    });
  });

  it('replaces a notice timer and clears both timer and subscription on unmount', async () => {
    vi.useFakeTimers();
    const fake = createFakeClient();
    vi.mocked(fake.client.saveProject).mockResolvedValue('/tmp/project.ktstudio');
    const view = renderFileCommands({ client: fake.client });

    await act(async () => view.result.current.saveProject());
    act(() => vi.advanceTimersByTime(2_000));
    await act(async () => view.result.current.saveProject());
    act(() => vi.advanceTimersByTime(1_001));

    expect(view.result.current.fileNotice).toEqual({ kind: 'status', text: '프로젝트를 저장했습니다.' });
    expect(vi.getTimerCount()).toBe(1);

    view.unmount();
    expect(fake.unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let an older import overwrite a newer import', async () => {
    const fake = createFakeClient();
    const older = createDeferred<Awaited<ReturnType<FileClient['importTheme']>>>();
    const newer = createDeferred<Awaited<ReturnType<FileClient['importTheme']>>>();
    vi.mocked(fake.client.importTheme)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const replaceProject = vi.fn();
    const { result } = renderFileCommands({ client: fake.client, replaceProject });
    const oldProject = createDefaultTheme('오래된 불러오기');
    const newProject = createDefaultTheme('새 불러오기');

    const first = result.current.openTheme();
    const second = result.current.openTheme();
    await act(async () => {
      newer.resolve({ kind: 'project', project: newProject });
      await newer.promise;
    });
    await act(async () => {
      older.resolve({ kind: 'project', project: oldProject });
      await older.promise;
    });
    await Promise.all([first, second]);

    expect(replaceProject).toHaveBeenCalledTimes(1);
    expect(replaceProject).toHaveBeenCalledWith(newProject);
    expect(result.current.fileNotice).toEqual({
      kind: 'status', text: '테마와 프로젝트 내용을 불러왔습니다.',
    });
  });

  it('keeps a newer cancellation notice-free when an older import later resolves', async () => {
    const fake = createFakeClient();
    const older = createDeferred<Awaited<ReturnType<FileClient['importTheme']>>>();
    const newer = createDeferred<Awaited<ReturnType<FileClient['importTheme']>>>();
    vi.mocked(fake.client.importTheme)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const replaceProject = vi.fn();
    const { result } = renderFileCommands({ client: fake.client, replaceProject });

    const first = result.current.openTheme();
    const second = result.current.openTheme();
    await act(async () => {
      newer.resolve(null);
      await newer.promise;
    });
    await act(async () => {
      older.resolve({ kind: 'project', project: createDefaultTheme('오래된 결과') });
      await older.promise;
    });
    await Promise.all([first, second]);

    expect(replaceProject).not.toHaveBeenCalled();
    expect(result.current.fileNotice).toBeNull();
  });

  it('keeps a newer cancellation notice-free when an older import later fails', async () => {
    const fake = createFakeClient();
    const older = createDeferred<Awaited<ReturnType<FileClient['importTheme']>>>();
    const newer = createDeferred<Awaited<ReturnType<FileClient['importTheme']>>>();
    vi.mocked(fake.client.importTheme)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const { result } = renderFileCommands({ client: fake.client });

    const first = result.current.openTheme();
    const second = result.current.openTheme();
    await act(async () => {
      newer.resolve(null);
      await newer.promise;
    });
    await act(async () => {
      older.reject(new Error('오래된 오류'));
      await older.promise.catch(() => undefined);
    });
    await Promise.all([first, second]);

    expect(result.current.fileNotice).toBeNull();
  });

  it('ignores a pending import after unmount without creating state or timer effects', async () => {
    vi.useFakeTimers();
    const fake = createFakeClient();
    const pending = createDeferred<Awaited<ReturnType<FileClient['importTheme']>>>();
    vi.mocked(fake.client.importTheme).mockReturnValue(pending.promise);
    const replaceProject = vi.fn();
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const view = renderFileCommands({ client: fake.client, replaceProject });

    const operation = view.result.current.openTheme();
    view.unmount();
    await act(async () => {
      pending.resolve({ kind: 'project', project: createDefaultTheme('늦은 결과') });
      await pending.promise;
    });
    await operation;

    expect(replaceProject).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps one native subscription while using the latest project for native saves', async () => {
    const fake = createFakeClient();
    const firstProject = createDefaultTheme('이전 프로젝트');
    const latestProject = createDefaultTheme('최신 프로젝트');
    const view = renderHook(
      ({ project }) => useThemeFileCommands({
        project,
        replaceProject: vi.fn(),
        client: fake.client,
      }),
      { initialProps: { project: firstProject } },
    );

    view.rerender({ project: latestProject });
    expect(fake.client.subscribeFileCommands).toHaveBeenCalledOnce();
    expect(fake.unsubscribe).not.toHaveBeenCalled();

    await act(async () => {
      fake.emit('save-project');
      await Promise.resolve();
    });
    expect(fake.client.saveProject).toHaveBeenCalledWith(
      expect.stringContaining('최신 프로젝트'),
      '최신 프로젝트',
    );

    view.unmount();
    expect(fake.unsubscribe).toHaveBeenCalledOnce();
  });
});
