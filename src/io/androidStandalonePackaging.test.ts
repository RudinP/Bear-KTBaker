import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('standalone Android runtime packaging', () => {
  it('copies templates outside app.asar so AAPT2 can execute', async () => {
    const builder = await readFile('electron-builder.yml', 'utf8');

    expect(builder).toMatch(/extraResources:\s*[\s\S]*from:\s*resources\/templates[\s\S]*to:\s*templates/);
  });

  it('builds universal macOS and x64 Windows installers after runtime verification', async () => {
    const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { scripts: Record<string, string> };

    expect(pkg.scripts['verify:android-runtime']).toContain('verify-standalone-android-export.ts');
    expect(pkg.scripts['package:mac']).toMatch(/verify:android-runtime[\s\S]*--universal/);
    expect(pkg.scripts['package:win']).toMatch(/verify:android-runtime[\s\S]*--x64/);
  });
});
