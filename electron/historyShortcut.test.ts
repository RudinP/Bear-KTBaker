import { describe, expect, it } from 'vitest';
import { historyCommandForInput } from './historyShortcut';

describe('Electron history shortcuts', () => {
  it('maps macOS Command shortcuts to project history commands', () => {
    expect(historyCommandForInput({ key: 'z', meta: true }, 'darwin')).toBe('undo');
    expect(historyCommandForInput({ key: 'Z', meta: true, shift: true }, 'darwin')).toBe('redo');
    expect(historyCommandForInput({ key: 'z', control: true }, 'darwin')).toBeNull();
  });

  it('maps Windows/Linux Control shortcuts including Ctrl+Y', () => {
    expect(historyCommandForInput({ key: 'z', control: true }, 'win32')).toBe('undo');
    expect(historyCommandForInput({ key: 'z', control: true, shift: true }, 'win32')).toBe('redo');
    expect(historyCommandForInput({ key: 'y', control: true }, 'win32')).toBe('redo');
    expect(historyCommandForInput({ key: 'y', control: true }, 'linux')).toBe('redo');
  });

  it('does not hijack unrelated or Alt-modified shortcuts', () => {
    expect(historyCommandForInput({ key: 'z' }, 'win32')).toBeNull();
    expect(historyCommandForInput({ key: 'z', control: true, alt: true }, 'win32')).toBeNull();
    expect(historyCommandForInput({ key: 'x', meta: true }, 'darwin')).toBeNull();
  });
});
