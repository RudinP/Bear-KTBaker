import type { NinePatchGuides } from '../ninePatch';

export type Platform = 'ios' | 'android';
export type ScreenId = 'friends' | 'chats' | 'chatroom' | 'notification' | 'now' | 'more' | 'passcode' | 'splash';
export type EditableElementId =
  | 'screen-background'
  | 'header'
  | 'tabbar'
  | 'bubble-me'
  | 'bubble-you'
  | 'inputbar'
  | 'inputbar-field'
  | 'inputbar-menu'
  | 'inputbar-send'
  | 'notification'
  | 'profile'
  | 'passcode-keypad'
  | 'splash-image'
  | 'content'
  | `color:${string}`;

export interface ImageAsset {
  fileName: string;
  dataUrl: string;
  width?: number;
  height?: number;
  sourceScale?: number;
  rawNinePatch?: boolean;
  userSelected?: true;
  mirroredFromPlatform?: Platform;
}

type VisualFill =
  | { kind: 'color'; color: string }
  | { kind: 'image'; color: string; image: ImageAsset };

export interface FontAsset {
  family: string;
  fileName: string;
  dataUrl: string;
}

export interface BubbleAppearance {
  color: string;
  textColor: string;
  stretch: NinePatchGuides;
  stretchByPlatform?: Partial<Record<Platform, NinePatchGuides>>;
  guideEditedByPlatform?: Partial<Record<Platform, true>>;
}

interface BubbleSet {
  normal: BubbleAppearance;
  pressed: BubbleAppearance;
  grouped: BubbleAppearance;
  groupedPressed: BubbleAppearance;
}

export interface ThemeProject {
  schema: 'kakao-theme-studio';
  schemaVersion: 1;
  baseSample?: 'apeach';
  meta: {
    name: string;
    author: string;
    version: string;
    themeId: string;
    appearance: 'light' | 'dark';
  };
  targets: Record<Platform, boolean>;
  resources: Record<string, ImageAsset>;
  platformResources: Record<Platform, Record<string, ImageAsset>>;
  colorValues: Record<Platform, Record<string, string>>;
  font?: FontAsset;
  colors: {
    header: string;
    primaryText: string;
    secondaryText: string;
    accent: string;
    inputBar: string;
    notificationBackground: string;
    notificationTitle: string;
    notificationMessage: string;
  };
  screens: Record<ScreenId, { background: VisualFill }>;
  chat: {
    bubbles: { me: BubbleSet; you: BubbleSet };
    unreadColor: string;
  };
}
