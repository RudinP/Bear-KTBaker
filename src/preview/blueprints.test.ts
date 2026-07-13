import { describe, expect, it } from 'vitest';
import { KAKAO_PREVIEW_VERSION, getEditableIdsForScreen, getScreenBlueprint } from './blueprints';

describe('official KakaoTalk preview blueprints', () => {
  it('tracks the KakaoTalk guide version used for screen geometry', () => {
    expect(KAKAO_PREVIEW_VERSION).toBe('26.5.0');
  });

  it('uses app-content viewports from the iOS and Android 26.5 guides', () => {
    const ios = getScreenBlueprint('ios', 'chatroom');
    const android = getScreenBlueprint('android', 'chatroom');

    expect(ios.viewport).toEqual([375, 750]);
    expect(android.viewport).toEqual([360, 760]);
    expect('statusBar' in ios.regions).toBe(false);
    expect('statusBar' in android.regions).toBe(false);
    expect('systemNavigation' in android.regions).toBe(false);
    expect(ios.regions.composer).toEqual({ top: 680, height: 70 });
    expect(android.regions.composer).toEqual({ top: 703, height: 57 });
  });

  it('keeps main-list, chatroom, more, and passcode layouts separate', () => {
    expect(getScreenBlueprint('ios', 'friends').kind).toBe('main-list');
    expect(getScreenBlueprint('ios', 'chatroom').kind).toBe('chatroom');
    expect(getScreenBlueprint('ios', 'more').kind).toBe('more');
    expect(getScreenBlueprint('ios', 'passcode').kind).toBe('passcode');
    expect(getScreenBlueprint('ios', 'friends').regions.tabBar).toEqual({ top: 697, height: 53 });
    expect(getScreenBlueprint('android', 'friends').regions.tabBar).toEqual({ top: 707, height: 53 });
  });

  it('exposes only theme-guide supported edit targets for each screen', () => {
    expect(getEditableIdsForScreen('chatroom')).toEqual([
      'screen-background', 'header', 'bubble-me', 'bubble-you', 'inputbar',
      'inputbar-field', 'inputbar-menu', 'inputbar-send', 'profile',
    ]);
    expect(getEditableIdsForScreen('chats')).toEqual([
      'screen-background', 'header', 'content', 'tabbar', 'profile',
    ]);
    expect(getEditableIdsForScreen('notification')).toEqual([
      'screen-background', 'header', 'notification', 'bubble-me', 'bubble-you', 'inputbar',
      'inputbar-field', 'inputbar-menu', 'inputbar-send', 'profile',
    ]);
    expect(getEditableIdsForScreen('passcode')).toEqual(['screen-background', 'passcode-keypad']);
  });

  it('exposes profile editing on exactly the screens that render shared profiles', () => {
    const screens = [
      'friends', 'chats', 'chatroom', 'notification', 'now', 'more', 'passcode', 'splash',
    ] as const;

    expect(screens.filter((screen) => getEditableIdsForScreen(screen).includes('profile')))
      .toEqual(['friends', 'chats', 'chatroom', 'notification', 'now']);
  });
});
