import type { ThemeStudioApi } from './shared/themeStudioContract';

export type { ThemeStudioApi } from './shared/themeStudioContract';

declare global {
  interface Window { themeStudio?: ThemeStudioApi }
}

export {};
