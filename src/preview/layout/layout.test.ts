import { describe, expect, it } from 'vitest';
import { getHostLayout } from './index';

describe('official KakaoTalk host layouts', () => {
  it('keeps platform-specific chat chrome instead of sharing one absolute layout', () => {
    const ios = getHostLayout('ios', 'chatroom');
    const android = getHostLayout('android', 'chatroom');

    expect(ios.viewport).toEqual({ width: 375, height: 750 });
    expect(android.viewport).toEqual({ width: 360, height: 760 });
    expect(ios.themeSurface).toEqual({ x: -9, y: -51, width: 393, height: 852 });
    expect(android.themeSurface).toEqual({ x: 0, y: 0, width: 360, height: 760 });
    expect(ios.bezel).toBe(0);
    expect(ios.frameRadius).toBe(26);
    expect(ios.radius).toBe(26);
    expect(android.bezel).toBe(0);
    expect(android.frameRadius).toBe(18);
    expect(android.radius).toBe(18);
    // Android 26.5 guide p.16 removes the status glyphs from the mockup,
    // but retains the blank app-safe area above the chat toolbar.
    expect(android.safeTop).toBe(16);
    expect(android.header).toEqual({ x: 0, y: 16, width: 360, height: 56 });
    expect(android.content).toEqual({ x: 0, y: 72, width: 360, height: 631 });
    expect(ios.chat?.showsDateChip).toBe(true);
    expect(android.chat?.showsDateChip).toBe(false);
    expect(ios.chat?.sentGap).toBe(15);
    expect(android.chat?.sentGap).toBe(15);
    expect(ios.chat?.groupGap).toBe(4);
    expect(android.chat?.groupGap).toBe(10);
    expect(ios.chat?.messageInset).toEqual({ top: 27, left: 10, right: 7 });
    expect(android.chat?.messageInset).toEqual({ top: 12, left: 10, right: 10 });
    expect(android.chat?.avatarGap).toBe(2);
    expect(android.chat).toMatchObject({ senderGap: 6 });
    expect(android.chat?.bubbleContentInset).toEqual({ top: 0, right: 4, bottom: 0, left: 4 });
    expect(ios.chat?.bubbleContentInset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(ios.chat?.avatarSize).toBe(34);
    expect(ios.chat?.composerControl).toEqual({ x: 4, y: 16, width: 361, height: 48 });
    expect(android.chat?.composer).toEqual({ x: 0, y: 703, width: 360, height: 57 });
    expect(android.chat?.composerControl).toEqual({ x: 8, y: 3, width: 344, height: 48 });
    expect(ios.chat?.composerButtonSize).toBe(30);
    expect(android.chat?.composerButtonSize).toBe(32);
    expect(ios.chat?.composerEmojiButtonSize).toBe(24);
    expect(android.chat?.composerEmojiButtonSize).toBe(24);
    expect(ios.chat?.composerSendButtonSize).toBe(32);
    expect(android.chat?.composerSendButtonSize).toBe(32);
    expect(ios.chat?.composerFieldOffset).toBe(40);
    expect(android.chat?.composerFieldOffset).toBe(40);
    expect(ios.chat?.composerMenuInset).toBe(8);
    expect(android.chat?.composerMenuInset).toBe(8);
    expect(ios.chat?.composerInputInset).toBe(8);
    expect(android.chat?.composerInputInset).toBe(8);
    expect(ios.chat?.composerIconSize).toEqual({ menu: 12, emoji: 12, hash: 14, send: 30 });
    expect(android.chat?.composerIconSize).toEqual({ menu: 13, emoji: 12, hash: 14, send: 17 });
    expect(android.chat).toMatchObject({ composerSendInset: 12, composerEmojiGap: 12 });
  });

  it('uses the Android guide four-times tab background geometry', () => {
    const ios = getHostLayout('ios', 'chats');
    const android = getHostLayout('android', 'chats');

    expect(ios.tabBar?.backgroundLogicalSize).toEqual({ width: 470, height: 49 });
    expect(android.tabBar?.backgroundLogicalSize).toEqual({ width: 360, height: 53 });
    expect(android.tabBar?.ninePatch).toBe(true);
  });

  it('anchors each official bottom banner and AD pill directly above the tab bar', () => {
    const ios = getHostLayout('ios', 'chats');
    const android = getHostLayout('android', 'now');

    expect(ios.tabBar?.bottomBanner).toEqual({
      frame: { x: 0, y: 657, width: 375, height: 40 },
      adPill: { x: 82, y: 604, width: 209, height: 38 },
    });
    expect(android.tabBar?.bottomBanner).toEqual({
      frame: { x: 0, y: 669, width: 360, height: 38 },
      adPill: { x: 77, y: 595, width: 185, height: 32 },
    });
  });

  it('does not expose an iOS splash screen', () => {
    expect(getHostLayout('ios', 'splash').available).toBe(false);
    expect(getHostLayout('android', 'splash').available).toBe(true);
  });
});
