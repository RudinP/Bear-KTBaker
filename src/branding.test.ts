import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

const projectFile = (...segments: string[]) => path.join(process.cwd(), ...segments);

describe('desktop application branding', () => {
  it('packages and titles the application as Bear KTBaker', () => {
    const builder = readFileSync(projectFile('electron-builder.yml'), 'utf8');
    const main = readFileSync(projectFile('electron', 'main.ts'), 'utf8');
    const createWindow = readFileSync(
      projectFile('electron', 'createWindow.ts'),
      'utf8',
    );

    expect(builder).toContain('productName: Bear KTBaker');
    expect(builder).toContain('appId: com.rudin.bear.ktbaker');
    expect(builder).toContain('buildResources: resources');
    expect(builder).toContain('icon: AppIcon.icon');
    expect(builder).toContain('identity: "-"');
    expect(createWindow).toContain("title: 'Bear KTBaker'");
    expect(main).toContain("app.setName('Bear KTBaker')");
  });

  it('keeps the supplied artwork and crops its transparent margin for the package icon', () => {
    const source = readFileSync(projectFile('resources', 'icon-source.png'));
    expect(createHash('sha256').update(source).digest('hex')).toBe(
      '42928528e199def4328215cbd85eb8918fdeab749192d6961dce0f969b69f517',
    );

    const icon = PNG.sync.read(readFileSync(projectFile('resources', 'icon.png')));
    let minX = icon.width;
    let minY = icon.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < icon.height; y += 1) for (let x = 0; x < icon.width; x += 1) {
      if (icon.data[(y * icon.width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    expect([icon.width, icon.height]).toEqual([1024, 1024]);
    expect(minX).toBeLessThanOrEqual(4);
    expect(minY).toBeLessThanOrEqual(1);
    expect(maxX).toBeGreaterThanOrEqual(1019);
    expect(maxY).toBeGreaterThanOrEqual(1022);
    const cornerAlphas = [
      icon.data[3],
      icon.data[(icon.width - 1) * 4 + 3],
      icon.data[((icon.height - 1) * icon.width) * 4 + 3],
      icon.data[(icon.width * icon.height - 1) * 4 + 3],
    ];
    expect(cornerAlphas).toEqual([255, 255, 255, 255]);
  });

  it('ships a native macOS 26 Icon Composer document instead of a legacy inset icon', () => {
    const composer = JSON.parse(readFileSync(projectFile('resources', 'AppIcon.icon', 'icon.json'), 'utf8'));
    expect(composer['supported-platforms']).toEqual({ circles: ['watchOS'], squares: 'shared' });
    expect(composer.groups[0].layers[0]['image-name']).toBe('BearKTBaker.png');
  });
});
