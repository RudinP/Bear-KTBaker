import type { ThemeProject } from '../domain/theme/model';

export type ProjectChange =
  | ThemeProject
  | ((current: ThemeProject) => ThemeProject);

interface ProjectChangeOptions {
  mergeKey?: string;
}

export type ProjectChangeHandler = (
  change: ProjectChange,
  options?: ProjectChangeOptions,
) => void;

export function applyProjectChange(
  current: ThemeProject,
  change: ProjectChange,
): ThemeProject {
  return typeof change === 'function' ? change(current) : change;
}
