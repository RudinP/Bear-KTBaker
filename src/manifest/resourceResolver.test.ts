import { describe, expect, it } from 'vitest';
import { parseThemeProject, serializeThemeProject } from '../domain/theme/codec';
import { createDefaultTheme } from '../domain/theme/defaults';
import { resolveResourceAsset, resolveResourceUrl } from './resourceResolver';

describe('theme resource resolver', () => {
  it('uses the exact bundled sample path when the user has not replaced a slot', () => {
    const project = createDefaultTheme();
    expect(resolveResourceUrl(project, 'ios', 'main.background')).toBe('./sample/ios/Images/mainBgImage@3x.png');
    expect(resolveResourceUrl(project, 'android', 'chat.bubble.me.first.normal')).toBe('./sample/android/src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png');
  });

  it('does not leak a legacy shared image into either platform renderer', () => {
    const project = createDefaultTheme();
    project.resources['main.tab.friends.selected'] = { fileName: 'mine.png', dataUrl: 'data:image/png;base64,bWluZQ==' };
    expect(resolveResourceUrl(project, 'ios', 'main.tab.friends.selected')).toBe('./sample/ios/Images/maintabIcoFriendsSelected@3x.png');
    expect(resolveResourceUrl(project, 'android', 'main.tab.friends.selected')).toBe('./sample/android/src/main/theme/drawable-xxhdpi/theme_maintab_ico_friends_focused_image.png');
  });

  it('keeps iPhone and Android replacements independent', () => {
    const project = createDefaultTheme();
    project.platformResources.ios['main.background'] = { fileName: 'ios.png', dataUrl: 'data:image/png;base64,aW9z' };
    project.platformResources.android['main.background'] = { fileName: 'android.png', dataUrl: 'data:image/png;base64,YW5kcm9pZA==' };
    expect(resolveResourceUrl(project, 'ios', 'main.background')).toContain('aW9z');
    expect(resolveResourceUrl(project, 'android', 'main.background')).toContain('YW5kcm9pZA');
  });

  it('keeps a legacy iOS import intact but hides its old automatic Android bubble copy', () => {
    const project = createDefaultTheme('예전 iOS import', false);
    const id = 'chat.bubble.me.first.normal';
    const asset = { fileName: 'chatroomBubbleSend01@3x.png', dataUrl: 'data:image/png;base64,aW9z', width: 120, height: 105, sourceScale: 3 };
    const guides = {
      stretch: { x: [51 / 120, 54 / 120] as [number, number], y: [51 / 105, 54 / 105] as [number, number] },
      content: { left: 33 / 120, top: 30 / 105, right: 69 / 120, bottom: 84 / 105 },
    };
    project.resources[id] = { ...asset };
    project.platformResources.ios[id] = { ...asset };
    project.platformResources.android[id] = { ...asset };
    project.chat.bubbles.me.normal.stretch = structuredClone(guides);
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: structuredClone(guides), android: structuredClone(guides) };
    const restored = parseThemeProject(serializeThemeProject(project));

    expect(resolveResourceAsset(restored, 'ios', id)).toEqual(asset);
    expect(resolveResourceAsset(restored, 'android', id)).toBeUndefined();
    expect(resolveResourceUrl(restored, 'android', id)).toBeUndefined();
    expect(restored.platformResources.android[id]).toEqual(asset);

    const selected = { ...asset, userSelected: true as const };
    restored.platformResources.android[id] = selected;
    expect(resolveResourceAsset(restored, 'android', id)).toEqual(selected);
  });
});
