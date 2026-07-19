import { describe, expect, it } from 'vitest';
import { decodeAndroidCompiledTheme, decodeAndroidSourceDocuments } from './androidXmlDecoder';

describe('decodeAndroidSourceDocuments', () => {
  it('uses Gradle metadata before manifest metadata and decodes XML entities', () => {
    const decoded = decodeAndroidSourceDocuments({
      manifest: `<manifest package="com.example.manifest" android:versionName="1.2.3" />`,
      gradle: `applicationId = "com.example.gradle"\nversionName = "2.3.4"\nnamespace = "com.example.namespace"`,
      strings: `<string name="theme_title">복숭아 &amp; 봄</string>`,
    });

    expect(decoded.metadata).toMatchObject({
      name: '복숭아 & 봄',
      version: '2.3.4',
      themeId: 'com.example.gradle',
      appearance: 'light',
    });
  });

  it('decodes known Android colors into canonical semantic fields', () => {
    const decoded = decodeAndroidSourceDocuments({
      colors: `<resources>
        <color name="theme_background_color">#123456</color>
        <color name="theme_title_color">#654321</color>
      </resources>`,
    });

    expect(decoded.colorValues).toMatchObject({
      theme_background_color: '#123456',
      theme_title_color: '#654321',
    });
    expect(decoded.importedColorBindings).toEqual(new Set([
      'theme_background_color', 'theme_title_color',
    ]));
    expect(decoded.themeColors.primaryText).toBe('#654321');
    expect(decoded.screenColors.friends).toBe('#123456');
  });
});

describe('decodeAndroidCompiledTheme', () => {
  it('preserves compiled metadata and decodes its colors', () => {
    const decoded = decodeAndroidCompiledTheme({
      name: '컴파일 테마',
      version: '3.0.0',
      themeId: 'com.example.compiled',
      appearance: 'dark',
      colors: { theme_header_color: '#234567' },
    });

    expect(decoded.metadata).toMatchObject({
      name: '컴파일 테마',
      version: '3.0.0',
      themeId: 'com.example.compiled',
      appearance: 'dark',
    });
    expect(decoded.themeColors.header).toBe('#234567');
  });
});
