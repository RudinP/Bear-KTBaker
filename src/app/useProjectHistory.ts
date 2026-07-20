import { useCallback, useEffect, useState } from 'react';
import type { ThemeProject } from '../domain/theme/model';
import type { ThemeStudioClient } from './themeStudioClient';
import {
  applyProjectChange,
  type ProjectChangeHandler,
} from './projectChange';

type ProjectHistory = {
  past: ThemeProject[];
  present: ThemeProject;
  future: ThemeProject[];
  mergeKey?: string;
};

export interface UseProjectHistoryOptions {
  initialProject(): ThemeProject;
  limit?: number;
  commands?: Pick<ThemeStudioClient, 'subscribeHistoryCommands'>;
}

export interface ProjectHistoryController {
  project: ThemeProject;
  setProject: ProjectChangeHandler;
  replaceProject(next: ThemeProject): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useProjectHistory({
  initialProject,
  limit = 100,
  commands,
}: UseProjectHistoryOptions): ProjectHistoryController {
  const [history, setHistory] = useState<ProjectHistory>(() => ({
    past: [],
    present: initialProject(),
    future: [],
  }));

  const setProject: ProjectChangeHandler = useCallback((change, options) => {
    setHistory((current) => {
      const next = applyProjectChange(current.present, change);
      if (next === current.present) return current;
      const mergesWithCurrent = options?.mergeKey !== undefined
        && options.mergeKey === current.mergeKey;
      return {
        past: mergesWithCurrent
          ? current.past
          : [...current.past, current.present].slice(-limit),
        present: next,
        future: [],
        mergeKey: options?.mergeKey,
      };
    });
  }, [limit]);
  const replaceProject = useCallback((next: ThemeProject) => {
    setHistory({ past: [], present: next, future: [], mergeKey: undefined });
  }, []);
  const undo = useCallback(() => {
    setHistory((current) => current.past.length ? {
      past: current.past.slice(0, -1),
      present: current.past[current.past.length - 1],
      future: [current.present, ...current.future],
      mergeKey: undefined,
    } : current);
  }, []);
  const redo = useCallback(() => {
    setHistory((current) => current.future.length ? {
      past: [...current.past, current.present],
      present: current.future[0],
      future: current.future.slice(1),
      mergeKey: undefined,
    } : current);
  }, []);

  useEffect(() => {
    const applyHistoryCommand = (command: 'undo' | 'redo') => {
      if (command === 'undo') undo();
      else redo();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || (!event.metaKey && !event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      const command = key === 'z'
        ? (event.shiftKey ? 'redo' : 'undo')
        : key === 'y' && event.ctrlKey && !event.shiftKey
          ? 'redo'
          : null;
      if (!command) return;
      event.preventDefault();
      applyHistoryCommand(command);
    };
    window.addEventListener('keydown', handleKeyDown);
    const unsubscribe = commands?.subscribeHistoryCommands(applyHistoryCommand);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe?.();
    };
  }, [commands, redo, undo]);

  return {
    project: history.present,
    setProject,
    replaceProject,
    undo,
    redo,
    canUndo: Boolean(history.past.length),
    canRedo: Boolean(history.future.length),
  };
}
