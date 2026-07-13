import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

describe('desktop workspace responsiveness', () => {
  it('does not force a 1060px document width that clips toolbar actions at 130% app zoom', () => {
    expect(css).not.toMatch(/html, body, #root\s*\{[^}]*min-width:\s*1060px/i);
    expect(css).not.toMatch(/\.window-shell\s*\{[^}]*min-height:\s*710px/i);
  });

  it('provides a compact layout for the effective viewport created by app zoom', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*980px\)/i);
    expect(css).toMatch(/grid-template-columns:\s*132px\s+minmax\(360px,\s*1fr\)\s+236px/i);
  });

  it('keeps the promotion action visible when 130% zoom reduces the effective height', () => {
    expect(css).toMatch(/@media\s*\(max-height:\s*620px\)/i);
    expect(css).toMatch(/\.screen-item\s*\{[^}]*height:\s*30px/i);
  });

  it('reserves native titlebar space on macOS only', () => {
    expect(css).toMatch(/\.document-title\s*\{[^}]*margin-left:\s*0/i);
    expect(css).toMatch(/\.app-toolbar\.is-mac\s+\.document-title\s*\{[^}]*margin-left:\s*66px/i);
    expect(css).not.toMatch(/\.traffic-lights\s*\{/i);
  });

  it('visually distinguishes a failed export from progress and success', () => {
    expect(css).toMatch(/\.export-status\[data-kind=["']error["']\]\s*\{[^}]*color:/i);
    expect(css).toMatch(/\.export-status\[data-kind=["']error["']\]\s+i\s*\{[^}]*background:/i);
  });

  it('uses one solid promotional poster background instead of a split gradient', () => {
    expect(css).toMatch(/\.promotion-canvas\s*\{[^}]*background:\s*#[0-9a-f]{6}/i);
    expect(css).not.toMatch(/\.promotion-canvas::before\s*\{/i);
  });

  it('keeps promotional bubble artwork above the export root instead of using a negative stacking layer', () => {
    expect(css).toMatch(/\.poster-bubble-showcase\s+\.kt-ninepatch-layer\s*,\s*\.poster-bubble-showcase\s+\.kt-nine-slice\s*\{[^}]*z-index:\s*0/i);
  });

  it('makes the complete promotional toolbar buttons interactive outside the native drag region', () => {
    expect(css).toMatch(/\.screenshot-backdrop\s*\{[^}]*-webkit-app-region:\s*no-drag/i);
    expect(css).toMatch(/\.screenshot-toolbar\s+\.screenshot-action\s*\{[^}]*min-height:\s*36px[^}]*pointer-events:\s*auto[^}]*-webkit-app-region:\s*no-drag/i);
  });
});
