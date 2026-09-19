import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { importIosKtheme } from './importIosTheme';
import { importAndroidThemeArchive } from './importAndroidTheme';

function png(red: number) {
  const image = new PNG({ width: 2, height: 2 });
  for (let i = 0; i < image.data.length; i += 4) image.data.set([red, 50, 100, 255], i);
  return PNG.sync.write(image);
}

const openChat = png(220);
const piccoma = png(20);
const current = png(130);
const url = (buffer: Buffer) => `data:image/png;base64,${buffer.toString('base64')}`;

describe('250204 open-chat import contract', () => {
  it.each(['view', 'openchats'])(
    'reads the iOS %s declaration and keeps the Japanese tab separate',
    async (key) => {
      const zip = new JSZip();
      const reference = await readFile(path.resolve('tests/fixtures/openchat-250204/TabBarStyle-Main.css'), 'utf8');
      // Custom names ensure the CSS property is read, not merely the filename fallback.
      zip.file('KakaoTalkTheme.css', reference
        .replaceAll('-ios-view-', `-ios-${key}-`)
        .replaceAll('maintabIcoView', 'customOpenChat'));
      for (const suffix of ['', 'Selected']) {
        zip.file(`Images/customOpenChat${suffix}@3x.png`, openChat);
        zip.file(`Images/maintabIcoPiccoma${suffix}@3x.png`, piccoma);
      }
      const project = await importIosKtheme(await zip.generateAsync({ type: 'nodebuffer' }), 'legacy.ktheme');
      for (const state of ['normal', 'selected']) {
        expect(project.platformResources.ios[`main.tab.now.${state}`]?.dataUrl).toBe(url(openChat));
        expect(project.platformResources.ios[`main.tab.piccoma.${state}`]?.dataUrl).toBe(url(piccoma));
      }
    },
  );

  it.each([false, true])('prefers current Android icons when present: %s', async (hasCurrent) => {
    const zip = new JSZip();
    for (const suffix of ['', '_focused']) {
      zip.file(`res/drawable-xxhdpi-v4/theme_maintab_ico_openchat${suffix}_image.png`, openChat);
      zip.file(`res/drawable-xxhdpi-v4/theme_maintab_ico_piccoma${suffix}_image.png`, piccoma);
      if (hasCurrent) zip.file(`res/drawable-xxhdpi-v4/theme_maintab_ico_now${suffix}_image.png`, current);
    }
    const project = await importAndroidThemeArchive(await zip.generateAsync({ type: 'nodebuffer' }), 'legacy.apk');
    for (const state of ['normal', 'selected']) {
      expect(project.platformResources.android[`main.tab.now.${state}`]?.dataUrl).toBe(url(hasCurrent ? current : openChat));
      expect(project.platformResources.android[`main.tab.piccoma.${state}`]?.dataUrl).toBe(url(piccoma));
    }
  });

  it.each(['ios', 'android'] as const)('does not treat a Piccoma-only %s archive as Open Chat', async (platform) => {
    const zip = new JSZip();
    zip.file('KakaoTalkTheme.css', 'ManifestStyle {}');
    zip.file('Images/maintabIcoPiccoma@3x.png', piccoma);
    zip.file('res/drawable-xxhdpi-v4/theme_maintab_ico_piccoma_image.png', piccoma);
    const bytes = await zip.generateAsync({ type: 'nodebuffer' });
    const project = platform === 'ios'
      ? await importIosKtheme(bytes, 'japanese.ktheme')
      : await importAndroidThemeArchive(bytes, 'japanese.apk');
    expect(project.platformResources[platform]['main.tab.piccoma.normal']?.dataUrl).toBe(url(piccoma));
    expect(project.platformResources[platform]['main.tab.now.normal']).toBeUndefined();
  });
});
