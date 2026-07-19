import type { Platform, ScreenId } from '../../domain/theme';

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

interface HostChatLayout {
  showsDateChip: boolean;
  messageInset: { top: number; left: number; right: number };
  bubbleContentInset: { top: number; right: number; bottom: number; left: number };
  avatarSize: number;
  avatarRadius: number;
  avatarGap: number;
  senderGap: number;
  messageGap: number;
  groupGap: number;
  sentGap: number;
  maxBubbleWidth: number;
  composer: Rect;
  composerControl: Rect;
  composerButtonSize: number;
  composerEmojiButtonSize: number;
  composerSendButtonSize: number;
  composerFieldOffset: number;
  composerMenuInset: number;
  composerInputInset: number;
  composerSendInset: number;
  composerEmojiGap: number;
  composerIconSize: { menu: number; emoji: number; hash: number; send: number };
}

interface HostTabBarLayout {
  frame: Rect;
  backgroundLogicalSize: Size;
  iconSize: number;
  ninePatch: boolean;
  bottomBanner: { frame: Rect; adPill: Rect };
}

interface HostPasscodeLayout {
  imageSurface: Rect;
  titleTop: number;
  bulletTop: number;
  keypad: Rect;
}

export interface HostScreenLayout {
  platform: Platform;
  screen: ScreenId;
  available: boolean;
  viewport: Size;
  bezel: number;
  frameRadius: number;
  radius: number;
  safeTop: number;
  themeSurface: Rect;
  header: Rect;
  content: Rect;
  chat?: HostChatLayout;
  tabBar?: HostTabBarLayout;
  passcode?: HostPasscodeLayout;
}

export type HostLayoutSet = Record<ScreenId, HostScreenLayout>;
