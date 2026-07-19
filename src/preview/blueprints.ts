import type { EditableElementId, Platform, ScreenId } from '../domain/theme';
import { getHostLayout } from './layout';

export const KAKAO_PREVIEW_VERSION = '26.5.0';

interface PreviewRect {
  top: number;
  height: number;
}

type PreviewLayoutKind = 'main-list' | 'chatroom' | 'more' | 'passcode' | 'splash';

export interface ScreenBlueprint {
  kind: PreviewLayoutKind;
  viewport: readonly [number, number];
  source: string;
  regions: Partial<Record<
    'header' | 'chips' | 'banner' | 'content' | 'tabBar' | 'composer' | 'keypad',
    PreviewRect
  >>;
}

function fromHost(platform: Platform, screen: ScreenId): ScreenBlueprint {
  const host = getHostLayout(platform, screen);
  const kind: PreviewLayoutKind = screen === 'chatroom' || screen === 'notification' ? 'chatroom'
    : screen === 'more' ? 'more' : screen === 'passcode' ? 'passcode'
      : screen === 'splash' ? 'splash' : 'main-list';
  const regions: ScreenBlueprint['regions'] = {
    header: { top: host.header.y, height: host.header.height },
    content: { top: host.content.y, height: host.content.height },
  };
  if (host.tabBar) regions.tabBar = { top: host.tabBar.frame.y, height: host.tabBar.frame.height };
  if (host.chat) regions.composer = { top: host.chat.composer.y, height: host.chat.composer.height };
  if (host.passcode) regions.keypad = { top: host.passcode.keypad.y, height: host.passcode.keypad.height };
  return {
    kind,
    viewport: [host.viewport.width, host.viewport.height],
    source: `KakaoTalk 26.5 ${platform === 'ios' ? 'iOS' : 'Android'} host layout, system chrome excluded`,
    regions,
  };
}

export function getScreenBlueprint(platform: Platform, screen: ScreenId): ScreenBlueprint {
  return fromHost(platform, screen);
}

const editTargets: Record<ScreenId, EditableElementId[]> = {
  friends: ['screen-background', 'header', 'profile', 'content', 'tabbar'],
  chats: ['screen-background', 'header', 'content', 'tabbar', 'profile'],
  chatroom: ['screen-background', 'header', 'bubble-me', 'bubble-you', 'inputbar', 'inputbar-field', 'inputbar-menu', 'inputbar-send', 'profile'],
  notification: ['screen-background', 'header', 'notification', 'bubble-me', 'bubble-you', 'inputbar', 'inputbar-field', 'inputbar-menu', 'inputbar-send', 'profile'],
  now: ['screen-background', 'header', 'content', 'tabbar', 'profile'],
  more: ['screen-background', 'header', 'content', 'tabbar'],
  passcode: ['screen-background', 'passcode-keypad'],
  splash: ['screen-background', 'splash-image'],
};

export function getEditableIdsForScreen(screen: ScreenId): readonly EditableElementId[] {
  return editTargets[screen];
}
