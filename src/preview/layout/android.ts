import type { HostLayoutSet, HostScreenLayout, Rect, Size } from './types';

const viewport: Size = { width: 360, height: 760 };
const header: Rect = { x: 0, y: 0, width: 360, height: 67 };
const tabFrame: Rect = { x: 0, y: 707, width: 360, height: 53 };

function base(screen: HostScreenLayout['screen']): HostScreenLayout {
  return {
    platform: 'android',
    screen,
    available: true,
    viewport,
    bezel: 0,
    frameRadius: 18,
    radius: 18,
    safeTop: 0,
    themeSurface: { x: 0, y: 0, width: 360, height: 760 },
    header,
    content: { x: 0, y: 67, width: 360, height: 640 },
  };
}

const mainTab = {
  frame: tabFrame,
  backgroundLogicalSize: { width: 360, height: 53 },
  iconSize: 38,
  ninePatch: true,
  bottomBanner: {
    frame: { x: 0, y: 669, width: 360, height: 38 },
    adPill: { x: 77, y: 595, width: 185, height: 32 },
  },
} as const;

export const ANDROID_HOST_LAYOUTS: HostLayoutSet = {
  friends: { ...base('friends'), tabBar: mainTab },
  chats: { ...base('chats'), tabBar: mainTab },
  now: { ...base('now'), tabBar: mainTab },
  more: { ...base('more'), tabBar: mainTab },
  chatroom: {
    ...base('chatroom'),
    safeTop: 16,
    header: { x: 0, y: 16, width: 360, height: 56 },
    content: { x: 0, y: 72, width: 360, height: 631 },
    chat: {
      showsDateChip: false,
      messageInset: { top: 12, left: 10, right: 10 },
      bubbleContentInset: { top: 0, right: 4, bottom: 0, left: 4 },
      avatarSize: 36,
      avatarRadius: 15,
      avatarGap: 2,
      senderGap: 6,
      messageGap: 4,
      groupGap: 10,
      sentGap: 15,
      maxBubbleWidth: 238,
      composer: { x: 0, y: 703, width: 360, height: 57 },
      composerControl: { x: 8, y: 3, width: 344, height: 48 },
      composerButtonSize: 32,
      composerEmojiButtonSize: 24,
      composerSendButtonSize: 32,
      composerFieldOffset: 40,
      composerMenuInset: 8,
      composerInputInset: 8,
      composerSendInset: 12,
      composerEmojiGap: 12,
      composerIconSize: { menu: 13, emoji: 12, hash: 14, send: 17 },
    },
  },
  notification: {
    ...base('notification'),
    safeTop: 16,
    header: { x: 0, y: 16, width: 360, height: 56 },
    content: { x: 0, y: 72, width: 360, height: 631 },
    chat: {
      showsDateChip: false,
      messageInset: { top: 12, left: 10, right: 10 },
      bubbleContentInset: { top: 0, right: 4, bottom: 0, left: 4 },
      avatarSize: 36,
      avatarRadius: 15,
      avatarGap: 2,
      senderGap: 6,
      messageGap: 4,
      groupGap: 10,
      sentGap: 15,
      maxBubbleWidth: 238,
      composer: { x: 0, y: 703, width: 360, height: 57 },
      composerControl: { x: 8, y: 3, width: 344, height: 48 },
      composerButtonSize: 32,
      composerEmojiButtonSize: 24,
      composerSendButtonSize: 32,
      composerFieldOffset: 40,
      composerMenuInset: 8,
      composerInputInset: 8,
      composerSendInset: 12,
      composerEmojiGap: 12,
      composerIconSize: { menu: 13, emoji: 12, hash: 14, send: 17 },
    },
  },
  passcode: {
    ...base('passcode'),
    header: { x: 0, y: 0, width: 360, height: 0 },
    content: { x: 0, y: 0, width: 360, height: 760 },
    passcode: {
      imageSurface: { x: 0, y: 0, width: 360, height: 360 },
      titleTop: 104,
      bulletTop: 196,
      keypad: { x: 0, y: 360, width: 360, height: 400 },
    },
  },
  splash: {
    ...base('splash'),
    header: { x: 0, y: 0, width: 360, height: 0 },
    content: { x: 0, y: 0, width: 360, height: 760 },
  },
};
