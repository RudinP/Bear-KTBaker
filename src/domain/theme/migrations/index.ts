import { cloneGuides, createDefaultTheme } from '../defaults';
import type {
  BubbleAppearance,
  ScreenId,
  ThemeProject,
} from '../model';
import {
  collectLegacyProjectImageCandidates,
  normalizeLegacyProjectImages,
} from './legacyProjectImages';
import { migrateLegacyNowTabAssets } from './legacyNowTabAssets';

export interface SchemaV1ProjectEnvelope {
  schema: 'kakao-theme-studio';
  schemaVersion: 1;
  [key: string]: unknown;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function migrateSchemaV1Project(
  source: SchemaV1ProjectEnvelope,
): ThemeProject {
  const candidates = collectLegacyProjectImageCandidates(source);
  const project = source as unknown as ThemeProject;
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
