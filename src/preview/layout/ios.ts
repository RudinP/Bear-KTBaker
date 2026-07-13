import type { HostLayoutSet, HostScreenLayout, Rect, Size } from './types';

const viewport: Size = { width: 375, height: 750 };
const header: Rect = { x: 0, y: 0, width: 375, height: 64 };
const tabFrame: Rect = { x: 0, y: 697, width: 375, height: 53 };

function base(screen: HostScreenLayout['screen']): HostScreenLayout {
  return {
    platform: 'ios',
    screen,
    available: screen !== 'splash',
    viewport,
    bezel: 0,
    frameRadius: 26,
    radius: 26,
    safeTop: 0,
    themeSurface: { x: -9, y: -51, width: 393, height: 852 },
    header,
    content: { x: 0, y: 64, width: 375, height: 633 },
  };
}

const mainTab = {
  frame: tabFrame,
  backgroundLogicalSize: { width: 470, height: 49 },
  iconSize: 38,
  ninePatch: false,
  bottomBanner: {
    frame: { x: 0, y: 657, width: 375, height: 40 },
    adPill: { x: 82, y: 604, width: 209, height: 38 },
  },
} as const;

export const IOS_HOST_LAYOUTS: HostLayoutSet = {
  friends: { ...base('friends'), tabBar: mainTab },
  chats: { ...base('chats'), tabBar: mainTab },
  now: { ...base('now'), tabBar: mainTab },
  more: { ...base('more'), tabBar: mainTab },
  chatroom: {
    ...base('chatroom'),
    header: { x: 0, y: 0, width: 375, height: 55 },
    content: { x: 0, y: 55, width: 375, height: 625 },
    chat: {
      showsDateChip: true,
      messageInset: { top: 27, left: 10, right: 7 },
      bubbleContentInset: { top: 0, right: 0, bottom: 0, left: 0 },
      avatarSize: 34,
      avatarRadius: 14,
      avatarGap: 8,
      senderGap: 5,
      messageGap: 4,
      groupGap: 4,
      sentGap: 15,
      maxBubbleWidth: 248,
      composer: { x: 0, y: 680, width: 375, height: 70 },
      composerControl: { x: 4, y: 16, width: 361, height: 48 },
      composerButtonSize: 30,
      composerEmojiButtonSize: 24,
      composerSendButtonSize: 32,
      composerFieldOffset: 40,
      composerMenuInset: 8,
      composerInputInset: 8,
      composerSendInset: 4,
      composerEmojiGap: 8,
      composerIconSize: { menu: 12, emoji: 12, hash: 14, send: 30 },
    },
  },
  notification: {
    ...base('notification'),
    header: { x: 0, y: 0, width: 375, height: 55 },
    content: { x: 0, y: 55, width: 375, height: 625 },
    chat: {
      showsDateChip: false,
      messageInset: { top: 27, left: 10, right: 7 },
      bubbleContentInset: { top: 0, right: 0, bottom: 0, left: 0 },
      avatarSize: 34,
      avatarRadius: 14,
      avatarGap: 8,
      senderGap: 5,
      messageGap: 4,
      groupGap: 4,
      sentGap: 15,
      maxBubbleWidth: 248,
      composer: { x: 0, y: 680, width: 375, height: 70 },
      composerControl: { x: 4, y: 16, width: 361, height: 48 },
      composerButtonSize: 30,
      composerEmojiButtonSize: 24,
      composerSendButtonSize: 32,
      composerFieldOffset: 40,
      composerMenuInset: 8,
      composerInputInset: 8,
      composerSendInset: 4,
      composerEmojiGap: 8,
      composerIconSize: { menu: 12, emoji: 12, hash: 14, send: 30 },
    },
  },
  passcode: {
    ...base('passcode'),
    header: { x: 0, y: 0, width: 375, height: 0 },
    content: { x: 0, y: 0, width: 375, height: 750 },
    passcode: {
      imageSurface: { x: 0, y: 0, width: 375, height: 375 },
      titleTop: 136,
      bulletTop: 225,
      keypad: { x: 0, y: 375, width: 375, height: 375 },
    },
  },
  splash: {
    ...base('splash'),
    available: false,
    header: { x: 0, y: 0, width: 375, height: 0 },
    content: { x: 0, y: 0, width: 375, height: 750 },
  },
};
