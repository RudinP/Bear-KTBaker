import { ANDROID_SAMPLE_COLORS, IOS_DEFAULT_COLORS, IOS_SAMPLE_ALPHAS } from '../../manifest/kakaoColors';
import { DEFAULT_NINE_PATCH, type NinePatchGuides } from '../ninePatch';
import type { BubbleAppearance, ThemeProject } from './model';

export function cloneGuides(): NinePatchGuides {
  return JSON.parse(JSON.stringify(DEFAULT_NINE_PATCH)) as NinePatchGuides;
}

function bubble(color: string, textColor: string): BubbleAppearance {
  return { color, textColor, stretch: cloneGuides() };
}

function bubbleSet(color: string, textColor: string) {
  return {
    normal: bubble(color, textColor),
    pressed: bubble(color, textColor),
    grouped: bubble(color, textColor),
    groupedPressed: bubble(color, textColor),
  };
}

export function createDefaultTheme(name = '새 카카오톡 테마', baseSample = true): ThemeProject {
  const background = { kind: 'color' as const, color: '#FFDEDE' };
  const idSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    schema: 'kakao-theme-studio',
    schemaVersion: 1,
    baseSample: baseSample ? 'apeach' : undefined,
    meta: {
      name,
      author: '',
      version: '1.0.0',
      themeId: `studio.theme.${idSeed}`,
      appearance: 'light',
    },
    targets: { ios: true, android: true },
    resources: {},
    platformResources: { ios: {}, android: {} },
    colorValues: {
      ios: { ...IOS_DEFAULT_COLORS, ...IOS_SAMPLE_ALPHAS },
      android: { ...ANDROID_SAMPLE_COLORS },
    },
    colors: {
      header: '#664242',
      primaryText: '#664242',
      secondaryText: '#805959',
      accent: '#FF7F7F',
      inputBar: '#FFFFFF',
      notificationBackground: '#FCC5C5',
      notificationTitle: '#604242',
      notificationMessage: '#805959',
    },
    screens: {
      friends: { background: { ...background } },
      chats: { background: { ...background } },
      chatroom: { background: { kind: 'color', color: '#FFDEDE' } },
      notification: { background: { kind: 'color', color: '#FFDEDE' } },
      now: { background: { ...background } },
      more: { background: { ...background } },
      passcode: { background: { kind: 'color', color: '#FCC5C5' } },
      splash: { background: { kind: 'color', color: '#FFDEDE' } },
    },
    chat: {
      bubbles: {
        me: bubbleSet('#FF7F7F', '#FFFFFF'),
        you: bubbleSet('#FFFFFF', '#4D4D4D'),
      },
      unreadColor: '#FF7F7F',
    },
  };
}
