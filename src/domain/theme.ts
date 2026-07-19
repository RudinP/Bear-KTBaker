import { DEFAULT_NINE_PATCH, type NinePatchGuides } from './ninePatch';
import { ANDROID_SAMPLE_COLORS, IOS_DEFAULT_COLORS, IOS_SAMPLE_ALPHAS } from '../manifest/kakaoColors';
import {
  collectLegacyProjectImageCandidates,
  isUsableImageAsset,
  normalizeLegacyProjectImages,
} from './legacyProjectImages';

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

function cloneGuides(): NinePatchGuides {
  return JSON.parse(JSON.stringify(DEFAULT_NINE_PATCH)) as NinePatchGuides;
}

function bubble(color: string, textColor: string): BubbleAppearance {
  return { color, textColor, stretch: cloneGuides() };
}

function bubbleSet(color: string, textColor: string): BubbleSet {
  return {
    normal: bubble(color, textColor),
    pressed: bubble(color, textColor),
    grouped: bubble(color, textColor),
    groupedPressed: bubble(color, textColor),
  };
}

export function createDefaultTheme(name = '새 카카오톡 테마', baseSample = true): ThemeProject {
  const background: VisualFill = { kind: 'color', color: '#FFDEDE' };
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

export function serializeThemeProject(project: ThemeProject): string {
  return JSON.stringify(project, null, 2);
}

export function migrateLegacyNowTabAssets(project: ThemeProject): ThemeProject {
  for (const state of ['normal', 'selected'] as const) {
    const currentId = `main.tab.now.${state}`;
    const legacyId = `main.tab.piccoma.${state}`;
    const sharedCurrent = isUsableImageAsset(project.resources[currentId])
      ? project.resources[currentId]
      : undefined;
    let firstFallback: ImageAsset | undefined;
    for (const platform of ['ios', 'android'] as const) {
      const current = project.platformResources[platform][currentId];
      if (isUsableImageAsset(current) || sharedCurrent) continue;
      const platformLegacy = project.platformResources[platform][legacyId];
      const sharedLegacy = project.resources[legacyId];
      const legacy = isUsableImageAsset(platformLegacy)
        ? platformLegacy
        : isUsableImageAsset(sharedLegacy) ? sharedLegacy : undefined;
      if (!legacy) continue;
      project.platformResources[platform][currentId] = { ...legacy };
      firstFallback ??= legacy;
    }
    if (!sharedCurrent && firstFallback) {
      project.resources[currentId] = { ...firstFallback };
    }
  }
  return project;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function parseThemeProject(source: string): ThemeProject {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('테마 스튜디오 프로젝트 파일이 아닙니다.');
  }
  if (
    !value ||
    typeof value !== 'object' ||
    (value as Partial<ThemeProject>).schema !== 'kakao-theme-studio' ||
    (value as Partial<ThemeProject>).schemaVersion !== 1
  ) {
    throw new Error('테마 스튜디오 프로젝트 파일이 아닙니다.');
  }
  const candidates = collectLegacyProjectImageCandidates(value);
  const project = value as ThemeProject;
  const defaults = createDefaultTheme(
    typeof project.meta?.name === 'string' ? project.meta.name : '새 카카오톡 테마',
  );
  project.meta = {
    ...defaults.meta,
    ...(objectRecord(project.meta) ?? {}),
  } as ThemeProject['meta'];
  project.targets = {
    ...defaults.targets,
    ...(objectRecord(project.targets) ?? {}),
  } as ThemeProject['targets'];
  project.resources = (objectRecord(project.resources) ?? {}) as ThemeProject['resources'];
  project.platformResources = {
    ios: { ...candidates.currentPlatformResources.ios },
    android: { ...candidates.currentPlatformResources.android },
  };

  const rawColorValues = objectRecord(project.colorValues);
  project.colorValues = {
    ...(rawColorValues ?? {}),
    ios: {
      ...defaults.colorValues.ios,
      ...(objectRecord(rawColorValues?.ios) ?? {}),
    },
    android: {
      ...defaults.colorValues.android,
      ...(objectRecord(rawColorValues?.android) ?? {}),
    },
  } as ThemeProject['colorValues'];
  project.colors = {
    ...defaults.colors,
    ...(objectRecord(project.colors) ?? {}),
  } as ThemeProject['colors'];

  const rawScreens = objectRecord(project.screens) ?? {};
  project.screens = rawScreens as ThemeProject['screens'];
  for (const screen of Object.keys(defaults.screens) as ScreenId[]) {
    const existing = objectRecord(rawScreens[screen]);
    if (objectRecord(existing?.background)) continue;
    const chatroom = objectRecord(rawScreens.chatroom);
    const chatroomBackground = objectRecord(chatroom?.background);
    const background = screen === 'notification' && chatroomBackground
      ? structuredClone(chatroomBackground) as VisualFill
      : structuredClone(defaults.screens[screen].background);
    project.screens[screen] = {
      ...(existing ?? {}),
      background,
    } as ThemeProject['screens'][ScreenId];
  }

  const rawChat = objectRecord(project.chat) ?? {};
  const rawBubbles = objectRecord(rawChat.bubbles) ?? {};
  project.chat = {
    ...rawChat,
    bubbles: { ...rawBubbles } as ThemeProject['chat']['bubbles'],
    unreadColor: typeof rawChat.unreadColor === 'string'
      ? rawChat.unreadColor
      : defaults.chat.unreadColor,
  } as ThemeProject['chat'];
  for (const side of ['me', 'you'] as const) {
    const rawSet = objectRecord(rawBubbles[side]) ?? {};
    const repairedSet = { ...rawSet } as unknown as BubbleSet;
    for (const variant of ['normal', 'pressed', 'grouped', 'groupedPressed'] as const) {
      const fallback = defaults.chat.bubbles[side][variant];
      const appearance = {
        ...structuredClone(fallback),
        ...(objectRecord(rawSet[variant]) ?? {}),
      } as BubbleAppearance;
      if (typeof appearance.color !== 'string') appearance.color = fallback.color;
      if (typeof appearance.textColor !== 'string') appearance.textColor = fallback.textColor;
      if (!objectRecord(appearance.stretch)) appearance.stretch = cloneGuides();
      repairedSet[variant] = appearance;
    }
    project.chat.bubbles[side] = repairedSet;
  }

  normalizeLegacyProjectImages(project, candidates);
  migrateLegacyNowTabAssets(project);
  return project;
}
