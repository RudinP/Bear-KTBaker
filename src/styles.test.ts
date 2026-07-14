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

  it('reserves real gutters for iOS inset badges outside the artwork', () => {
    expect(css).toMatch(/\.patch-stage\[data-editor-mode=["']ios-inset["']\]\s*\{[^}]*padding:\s*108px\s+36px\s+52px\s+150px/i);
    expect(css).toMatch(/\.guide\.vertical\[data-label-lane=["']3["']\]:before\s*\{[^}]*top:\s*-91px/i);
    expect(css).toMatch(/\.guide\.horizontal\[data-label-side=["']left["']\]:before\s*\{[^}]*right:\s*calc\(100%\s*\+\s*12px\)/i);
    for (const [lane, offset] of [['0', '-36px'], ['1', '-12px'], ['2', '12px'], ['3', '36px']] as const) {
      expect(css).toMatch(new RegExp(`\\.guide\\.horizontal\\[data-label-lane=["']${lane}["']\\]:before\\s*\\{[^}]*translateY\\(calc\\(-50% \\+ ${offset.replace('-', '\\-')}\\)\\)`, 'i'));
    }
  });

  it('keeps single-line iOS labels at their authored inset origin without shrinking the bubble around them', () => {
    expect(css).toMatch(/\[data-platform-bubble=["']ios["']\]\[data-content-mode=["']single-line["']\]\s*\{[^}]*display:\s*(?:inline-)?grid[^}]*width:\s*max-content[^}]*place-items:\s*start/i);
    expect(css).toMatch(/\[data-platform-bubble=["']ios["']\]\[data-content-mode=["']single-line["']\]\s*>\s*\[data-content-mode=["']single-line["']\]\s*\{[^}]*white-space:\s*nowrap/i);
    expect(css).not.toMatch(/--bubble-center-[xy]/i);
  });

  it('removes the unused inspector track from settings screens at every desktop breakpoint', () => {
    expect(css).toMatch(/\.editor-layout\.is-settings-layout\s*\{[^}]*grid-template-columns:\s*182px\s+minmax\(0,\s*1fr\)/i);
    expect(css).toMatch(/@media\s*\(max-width:\s*1210px\)[\s\S]*?\.editor-layout\.is-settings-layout\s*\{[^}]*grid-template-columns:\s*160px\s+minmax\(0,\s*1fr\)/i);
    expect(css).toMatch(/@media\s*\(max-width:\s*980px\)[\s\S]*?\.editor-layout\.is-settings-layout\s*\{[^}]*grid-template-columns:\s*132px\s+minmax\(0,\s*1fr\)/i);
  });

  it('collapses settings cards and form labels before zoom can create horizontal overflow', () => {
    expect(css).toMatch(/\.theme-settings-workspace\s*\{[^}]*container-type:\s*inline-size/i);
    expect(css).toMatch(/@container\s*\(max-width:\s*620px\)[\s\S]*?\.settings-card\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/i);
    expect(css).toMatch(/@container\s*\(max-width:\s*400px\)[\s\S]*?\.settings-form\s+label\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/i);
    expect(css).toMatch(/\.adaptive-icon-settings\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*grid-template-columns:\s*minmax\(220px,\s*1fr\)\s+auto/i);
  });

  it('gives the actual inset-editor close button a 44px minimum hit target', () => {
    expect(css).toMatch(/\.close-button\s*\{[^}]*min-height:\s*44px/i);
    expect(css).not.toMatch(/\.close-button\s*\{[^}]*height:\s*34px/i);
  });
});
