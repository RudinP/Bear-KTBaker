import {
  collectLegacyProjectImageCandidates,
  isUsableImageAsset,
  normalizeLegacyProjectImages,
} from './legacyProjectImages';
import { cloneGuides, createDefaultTheme } from './theme/defaults';
import type { BubbleAppearance, ImageAsset, ScreenId, ThemeProject } from './theme/model';

export * from './theme/model';
export { createDefaultTheme } from './theme/defaults';

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
      ? structuredClone(chatroomBackground) as ThemeProject['screens'][ScreenId]['background']
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
    const repairedSet = { ...rawSet } as unknown as ThemeProject['chat']['bubbles']['me'];
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
