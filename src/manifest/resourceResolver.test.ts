import { describe, expect, it } from 'vitest';
import { createDefaultTheme } from '../domain/theme';
import { resolveResourceUrl } from './resourceResolver';

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
});
