export type HistoryCommand = 'undo' | 'redo';

type ShortcutInput = {
  key: string;
  alt?: boolean;
  control?: boolean;
  meta?: boolean;
  shift?: boolean;
};

export function historyCommandForInput(input: ShortcutInput, platform: NodeJS.Platform): HistoryCommand | null {
  if (input.alt) return null;
  const primaryModifier = platform === 'darwin' ? input.meta : input.control;
  if (!primaryModifier) return null;
  const key = input.key.toLowerCase();
  if (key === 'z') return input.shift ? 'redo' : 'undo';
  if (platform !== 'darwin' && key === 'y' && !input.shift) return 'redo';
  return null;
}
