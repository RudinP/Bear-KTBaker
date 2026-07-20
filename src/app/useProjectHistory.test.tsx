// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../domain/theme/defaults';
import {
  useProjectHistory,
  type UseProjectHistoryOptions,
} from './useProjectHistory';

type HistoryCommandListener = (command: 'undo' | 'redo') => void;

function createFakeCommands() {
  let listener: HistoryCommandListener | undefined;
  const unsubscribe = vi.fn();
  const commands = {
    subscribeHistoryCommands: vi.fn((next: HistoryCommandListener) => {
      listener = next;
      return unsubscribe;
    }),
  };

  return {
    commands,
    dispatch(command: 'undo' | 'redo') {
      listener?.(command);
    },
    unsubscribe,
  };
}

function renderProjectHistory(
  options: Partial<UseProjectHistoryOptions> = {},
) {
  return renderHook(() => useProjectHistory({
    initialProject: () => createDefaultTheme('0'),
    ...options,
  }));
}

describe('useProjectHistory', () => {
  it('applies functional changes to the latest project', () => {
    const { result } = renderProjectHistory();

    act(() => {
      result.current.setProject((current) => ({
        ...current,
        meta: { ...current.meta, author: 'latest author' },
      }));
      result.current.setProject((current) => ({
        ...current,
        meta: { ...current.meta, name: 'latest name' },
      }));
    });

    expect(result.current.project.meta).toMatchObject({
      author: 'latest author',
      name: 'latest name',
    });
  });

  it('merges consecutive changes with the same key into one undo step', () => {
    const { result } = renderProjectHistory();

    act(() => {
      result.current.setProject(
        (current) => ({
          ...current,
          meta: { ...current.meta, name: 'first' },
        }),
        { mergeKey: 'meta:name' },
      );
      result.current.setProject(
        (current) => ({
          ...current,
          meta: { ...current.meta, name: 'second' },
        }),
        { mergeKey: 'meta:name' },
      );
    });

    expect(result.current.project.meta.name).toBe('second');
    act(() => result.current.undo());
    expect(result.current.project.meta.name).toBe('0');
    act(() => result.current.redo());
    expect(result.current.project.meta.name).toBe('second');
  });

  it('limits history to the newest 100 projects and clears redo after a fresh change', () => {
    const { result } = renderProjectHistory({ limit: 100 });

    act(() => {
      for (let index = 1; index <= 101; index += 1) {
        result.current.setProject(createDefaultTheme(String(index)));
      }
    });
    act(() => {
      for (let index = 0; index < 100; index += 1) result.current.undo();
    });
    expect(result.current.project.meta.name).toBe('1');

    act(() => result.current.redo());
    act(() => result.current.setProject(createDefaultTheme('fresh')));
    expect(result.current.canRedo).toBe(false);
  });

  it('replaces a project without retaining undo or redo history', () => {
    const { result } = renderProjectHistory();
    const changed = createDefaultTheme('changed');
    const imported = createDefaultTheme('imported');

    act(() => result.current.setProject(changed));
    act(() => result.current.replaceProject(imported));

    expect(result.current.project).toBe(imported);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('preserves project object references through undo and redo', () => {
    const { result } = renderProjectHistory();
    const initial = result.current.project;
    const changed = createDefaultTheme('changed');

    act(() => result.current.setProject(changed));
    expect(result.current.project).toBe(changed);

    act(() => result.current.undo());
    expect(result.current.project).toBe(initial);

    act(() => result.current.redo());
    expect(result.current.project).toBe(changed);
  });

  it.each([
    ['Command+Z', { key: 'z', metaKey: true }, 'undo'],
    ['Command+Shift+Z', { key: 'Z', metaKey: true, shiftKey: true }, 'redo'],
    ['Control+Z', { key: 'z', ctrlKey: true }, 'undo'],
    ['Control+Shift+Z', { key: 'z', ctrlKey: true, shiftKey: true }, 'redo'],
    ['Control+Y', { key: 'y', ctrlKey: true }, 'redo'],
  ] as const)('handles %s as %s', (_label, init, command) => {
    const { result } = renderProjectHistory();
    const initial = result.current.project;
    const changed = createDefaultTheme('changed');

    act(() => result.current.setProject(changed));
    if (command === 'redo') act(() => result.current.undo());

    const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(result.current.project).toBe(command === 'undo' ? initial : changed);
  });

  it('rejects history shortcuts modified with Alt', () => {
    const { result } = renderProjectHistory();
    const changed = createDefaultTheme('changed');
    act(() => result.current.setProject(changed));

    const event = new KeyboardEvent('keydown', {
      key: 'z', ctrlKey: true, altKey: true, bubbles: true, cancelable: true,
    });
    act(() => window.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(result.current.project).toBe(changed);
  });

  it('uses renderer history commands and cleans up their subscription when replaced', () => {
    const first = createFakeCommands();
    const second = createFakeCommands();
    const { result, rerender, unmount } = renderHook(
      ({ commands }) => useProjectHistory({
        initialProject: () => createDefaultTheme('0'),
        commands,
      }),
      { initialProps: { commands: first.commands } },
    );
    const changed = createDefaultTheme('changed');
    act(() => result.current.setProject(changed));

    act(() => first.dispatch('undo'));
    expect(result.current.project.meta.name).toBe('0');

    rerender({ commands: second.commands });
    expect(first.unsubscribe).toHaveBeenCalledOnce();

    unmount();
    expect(second.unsubscribe).toHaveBeenCalledOnce();
  });
});
