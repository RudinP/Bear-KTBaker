import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { ThemeImportFailure } from './importFailure';
import {
  importAndroidSourceZip,
  importAndroidThemeArchive,
} from './importAndroidTheme';

function solidPng(
  red: number,
  green: number,
  blue: number,
  width = 1,
  height = 1,
) {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data.set([red, green, blue, 255], offset);
  }
  return PNG.sync.write(png);
}

describe('Android theme import coordinator', () => {
  it('applies source XML metadata and allows a color-only source ZIP', async () => {
    const source = new JSZip();
    source.file(
      'src/main/AndroidManifest.xml',
      '<manifest package="com.example.fallback"><application /></manifest>',
    );
    source.file(
      'src/main/theme/values/strings.xml',
      '<resources><string name="theme_title">복숭아 &amp; 우체국</string></resources>',
    );
    source.file(
      'src/main/theme/values/colors.xml',
      '<resources><color name="theme_header_color">#102030</color><color name="theme_background_color">#203040</color></resources>',
    );
    source.file(
      'build.gradle.kts',
      'android { defaultConfig { applicationId = "com.example.peach" versionName = "3.7.12" } }',
    );

    const project = await importAndroidSourceZip(
      await source.generateAsync({ type: 'uint8array' }),
      'colors-only.zip',
    );

    expect(project.meta).toMatchObject({
      name: '복숭아 & 우체국',
      version: '3.7.12',
      themeId: 'com.example.peach',
    });
    expect(project.colors.header).toBe('#102030');
    expect(project.screens.friends.background).toEqual({
      kind: 'color',
      color: '#203040',
    });
    expect(project.colorValues.ios['HeaderStyle-Main|-ios-text-color']).toBe(
      '#102030',
    );
  });

  it('applies compiled metadata and recovers and mirrors APK images', async () => {
    const image = solidPng(12, 34, 56, 4, 8);
    const apk = new JSZip();
    apk.file('res/drawable-xxhdpi-v31/theme_background_image.png', image);

    const project = await importAndroidThemeArchive(
      await apk.generateAsync({ type: 'uint8array' }),
      'compiled.apk',
      {
        name: '컴파일 테마',
        version: '7.8.9',
        themeId: 'com.example.compiled',
        appearance: 'dark',
        colors: {
          theme_header_color: '#123456',
          theme_background_color: '#A1B2C3',
        },
        resourceFiles: {
          'drawable/theme_background_image': [
            'res/drawable/theme_background_image.xml',
            'res/drawable-xxhdpi-v31/theme_background_image.png',
          ],
        },
      },
    );

    expect(project.meta).toMatchObject({
      name: '컴파일 테마',
      version: '7.8.9',
      themeId: 'com.example.compiled',
      appearance: 'dark',
    });
    expect(project.platformResources.android['main.background']?.dataUrl).toBe(
      `data:image/png;base64,${image.toString('base64')}`,
    );
    expect(project.platformResources.ios['main.background']?.dataUrl).toBe(
      project.platformResources.android['main.background']?.dataUrl,
    );
    expect(project.colorValues.ios['HeaderStyle-Main|-ios-text-color']).toBe(
      '#123456',
    );
  });

  it('rejects a color-only APK as an image-recovery failure', async () => {
    const apk = await new JSZip().generateAsync({ type: 'uint8array' });
    const failure = await importAndroidThemeArchive(apk, 'colors-only.apk', {
      colors: { theme_background_color: '#123456' },
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ThemeImportFailure);
    expect(failure).toMatchObject({
      kind: 'android-image-recovery',
      message:
        'Android APK에서 테마 색상은 읽었지만 이미지 리소스를 복원하지 못했습니다. 원본 APK를 확인해 주세요.',
      safeContext: { archiveKind: 'apk' },
    });
  });

  it('reports the detailed resource key after every APK candidate fails', async () => {
    const apk = new JSZip();
    apk.file(
      'res/drawable-xxhdpi-v31/theme_background_image.png',
      Buffer.from('broken'),
    );
    const failure = await importAndroidThemeArchive(
      await apk.generateAsync({ type: 'uint8array' }),
      'broken.apk',
      {
        resourceFiles: {
          'drawable/theme_background_image': [
            'res/drawable-xxhdpi-v31/theme_background_image.png',
          ],
        },
      },
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ThemeImportFailure);
    expect(failure).toMatchObject({
      kind: 'android-image-recovery',
      safeContext: {
        archiveKind: 'apk',
        resourceKey: 'drawable/theme_background_image',
      },
    });
    if (!(failure instanceof ThemeImportFailure)) {
      throw new Error('Expected ThemeImportFailure');
    }
    expect(failure.message).toContain('drawable/theme_background_image');
    expect(failure.message).toContain(
      'res/drawable-xxhdpi-v31/theme_background_image.png',
    );
  });

  it('uses compiled legacy Piccoma tab icons as Now fallbacks', async () => {
    const normal = solidPng(12, 34, 56);
    const selected = solidPng(65, 43, 21);
    const apk = new JSZip();
    apk.file(
      'res/drawable-xxhdpi-v4/theme_maintab_ico_piccoma_image.png',
      normal,
    );
    apk.file(
      'res/drawable-xxhdpi-v4/theme_maintab_ico_piccoma_focused_image.png',
      selected,
    );

    const project = await importAndroidThemeArchive(
      await apk.generateAsync({ type: 'uint8array' }),
      'legacy.apk',
      {
        resourceFiles: {
          'drawable/theme_maintab_ico_piccoma_image': [
            'res/drawable-xxhdpi-v4/theme_maintab_ico_piccoma_image.png',
          ],
          'drawable/theme_maintab_ico_piccoma_focused_image': [
            'res/drawable-xxhdpi-v4/theme_maintab_ico_piccoma_focused_image.png',
          ],
        },
      },
    );

    expect(
      project.platformResources.android['main.tab.now.normal']?.fileName,
    ).toBe('theme_maintab_ico_piccoma_image.png');
    expect(
      project.platformResources.android['main.tab.now.selected']?.fileName,
    ).toBe('theme_maintab_ico_piccoma_focused_image.png');
  });

  it('classifies an invalid ZIP as an Android archive failure', async () => {
    await expect(
      importAndroidSourceZip(new Uint8Array([1, 2, 3]), 'broken.zip'),
    ).rejects.toMatchObject({
      name: 'ThemeImportFailure',
      kind: 'android-archive',
      safeContext: { archiveKind: 'source' },
    });
  });
});
