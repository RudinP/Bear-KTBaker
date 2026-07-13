import { describe, expect, it } from 'vitest';
import { createDefaultTheme, parseThemeProject, serializeThemeProject } from './theme';

describe('theme project', () => {
  it('creates a project that targets iOS and Android together', () => {
    const project = createDefaultTheme('복숭아 우체국');

    expect(project.meta.name).toBe('복숭아 우체국');
    expect(project.targets).toEqual({ ios: true, android: true });
    expect(project.chat.bubbles.me.normal.color).toMatch(/^#/);
    expect(project.screens.chatroom.background.kind).toBe('color');
    expect(project.resources).toEqual({});
    expect(project.chat.bubbles.me.groupedPressed).toBeDefined();
  });

  it('round-trips both platform resources, colors, guides, font, and metadata without loss', () => {
    const project = createDefaultTheme('테스트');
    project.meta = {
      name: '복숭아 테마', author: '제작자', version: '2.4.1',
      themeId: 'com.example.peach', appearance: 'dark',
    };
    project.targets = { ios: true, android: false };
    project.chat.bubbles.me.normal.stretch.stretch.x = [0.31, 0.68];
    project.chat.bubbles.me.normal.stretchByPlatform = {
      ios: {
        stretch: { x: [0.11, 0.22], y: [0.33, 0.44] },
        content: { left: 0.1, top: 0.2, right: 0.8, bottom: 0.9 },
      },
      android: {
        stretch: { x: [0.55, 0.66], y: [0.67, 0.78] },
        content: { left: 0.2, top: 0.3, right: 0.7, bottom: 0.8 },
      },
    };
    project.font = {
      family: '내 글씨',
      fileName: 'my-font.otf',
      dataUrl: 'data:font/otf;base64,Zm9udA==',
    };
    project.platformResources.ios['main.background'] = {
      fileName: 'ios-background@3x.png', dataUrl: 'data:image/png;base64,aW9z',
      width: 1125, height: 2250, sourceScale: 3,
    };
    project.platformResources.android['main.background'] = {
      fileName: 'android-background.png', dataUrl: 'data:image/png;base64,YW5kcm9pZA==',
      width: 1440, height: 2880, sourceScale: 4,
    };
    project.colorValues.ios['HeaderStyle-Main|-ios-text-color'] = '#123456';
    project.colorValues.android.theme_header_color = '#654321';

    const restored = parseThemeProject(serializeThemeProject(project));

    expect(restored.chat.bubbles.me.normal.stretch.stretch.x).toEqual([0.31, 0.68]);
    expect(restored.chat.bubbles.me.normal.stretchByPlatform).toEqual(project.chat.bubbles.me.normal.stretchByPlatform);
    expect(restored.font?.fileName).toBe('my-font.otf');
    expect(restored.platformResources).toEqual(project.platformResources);
    expect(restored.colorValues.ios['HeaderStyle-Main|-ios-text-color']).toBe('#123456');
    expect(restored.colorValues.android.theme_header_color).toBe('#654321');
    expect(restored.meta).toEqual(project.meta);
    expect(restored.targets).toEqual({ ios: true, android: false });
  });

  it('rejects files that are not theme studio projects', () => {
    expect(() => parseThemeProject('{"hello":"world"}')).toThrow(
      '테마 스튜디오 프로젝트 파일이 아닙니다.',
    );
  });

  it('fills schema-v1 fields added after an older project was saved without replacing user data', () => {
    const project = createDefaultTheme('예전 프로젝트');
    project.meta.author = '나';
    project.screens.chatroom.background = { kind: 'color', color: '#123456' };
    const legacy = JSON.parse(serializeThemeProject(project));
    delete legacy.meta.appearance;
    delete legacy.targets.android;
    delete legacy.screens.notification;
    delete legacy.screens.splash;

    const restored = parseThemeProject(JSON.stringify(legacy));

    expect(restored.meta.author).toBe('나');
    expect(restored.meta.appearance).toBe('light');
    expect(restored.targets).toEqual({ ios: true, android: true });
    expect(restored.screens.notification.background).toEqual({ kind: 'color', color: '#123456' });
    expect(restored.screens.splash).toBeDefined();
  });

  it('repairs a partial schema-v1 project instead of crashing while it is opened', () => {
    const restored = parseThemeProject(JSON.stringify({
      schema: 'kakao-theme-studio',
      schemaVersion: 1,
      meta: { name: '부분 프로젝트' },
    }));

    expect(restored.meta.name).toBe('부분 프로젝트');
    expect(restored.meta.author).toBe('');
    expect(restored.meta.version).toBe('1.0.0');
    expect(restored.targets).toEqual({ ios: true, android: true });
    expect(restored.chat.bubbles.me.normal).toBeDefined();
    expect(restored.chat.bubbles.you.groupedPressed).toBeDefined();
    expect(restored.screens.chatroom.background).toBeDefined();
  });
});
