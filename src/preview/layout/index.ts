import type { Platform, ScreenId } from '../../domain/theme';
import { ANDROID_HOST_LAYOUTS } from './android';
import { IOS_HOST_LAYOUTS } from './ios';

export type { HostChatLayout, HostPasscodeLayout, HostScreenLayout, HostTabBarLayout, Rect, Size } from './types';

export function getHostLayout(platform: Platform, screen: ScreenId) {
  return platform === 'ios' ? IOS_HOST_LAYOUTS[screen] : ANDROID_HOST_LAYOUTS[screen];
}
