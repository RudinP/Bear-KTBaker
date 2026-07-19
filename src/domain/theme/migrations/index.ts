import { createDefaultTheme } from '../defaults';
import type {
  ScreenId,
  ThemeProject,
} from '../model';
import {
  mergeUnknownRecords,
  objectRecord,
  platforms,
  repairBubbleAppearance,
  repairFontAsset,
  repairImageAssetMap,
  repairPreservedFields,
  repairStringMap,
  repairVisualFill,
} from '../runtimeValidation';
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

export function migrateSchemaV1Project(
  source: SchemaV1ProjectEnvelope,
): ThemeProject {
  const candidates = collectLegacyProjectImageCandidates(source);
  const project = source as unknown as ThemeProject;
  const preserved = repairPreservedFields(project.__preservedUnknownFields)
    ?? {};
  const defaults = createDefaultTheme(
    typeof project.meta?.name === 'string' ? project.meta.name : '새 카카오톡 테마',
  );

  if (project.baseSample !== 'apeach') delete project.baseSample;
  const rawMeta = objectRecord(project.meta) ?? {};
  project.meta = {
    ...rawMeta,
    name: typeof rawMeta.name === 'string'
      ? rawMeta.name
      : defaults.meta.name,
    author: typeof rawMeta.author === 'string'
      ? rawMeta.author
      : defaults.meta.author,
    version: typeof rawMeta.version === 'string'
      ? rawMeta.version
      : defaults.meta.version,
    themeId: typeof rawMeta.themeId === 'string'
      ? rawMeta.themeId
      : defaults.meta.themeId,
    appearance: rawMeta.appearance === 'light'
      || rawMeta.appearance === 'dark'
      ? rawMeta.appearance
      : defaults.meta.appearance,
  } as ThemeProject['meta'];
  const rawTargets = objectRecord(project.targets) ?? {};
  project.targets = {
    ...rawTargets,
    ios: typeof rawTargets.ios === 'boolean'
      ? rawTargets.ios
      : defaults.targets.ios,
    android: typeof rawTargets.android === 'boolean'
      ? rawTargets.android
      : defaults.targets.android,
  } as ThemeProject['targets'];
  const resources = repairImageAssetMap(project.resources);
  project.resources = resources.valid;
  const preservedResources = mergeUnknownRecords(
    preserved.resources,
    resources.unknown,
  );
  if (preservedResources) preserved.resources = preservedResources;
  else delete preserved.resources;
  const rawPlatformResources = objectRecord(project.platformResources) ?? {};
  const platformRootUnknown = Object.fromEntries(
    Object.entries(rawPlatformResources)
      .filter(([key]) => !platforms.includes(key as 'ios' | 'android')),
  );
  const rawIos = repairImageAssetMap(rawPlatformResources.ios);
  const rawAndroid = repairImageAssetMap(rawPlatformResources.android);
  project.platformResources = {
    ios: { ...candidates.currentPlatformResources.ios },
    android: { ...candidates.currentPlatformResources.android },
  };
  const preservedPlatformRoot = mergeUnknownRecords(
    preserved.platformResources?.root,
    platformRootUnknown,
  );
  const preservedIos = mergeUnknownRecords(
    preserved.platformResources?.ios,
    rawIos.unknown,
  );
  const preservedAndroid = mergeUnknownRecords(
    preserved.platformResources?.android,
    rawAndroid.unknown,
  );
  preserved.platformResources = {
    ...(preservedPlatformRoot ? { root: preservedPlatformRoot } : {}),
    ...(preservedIos ? { ios: preservedIos } : {}),
    ...(preservedAndroid ? { android: preservedAndroid } : {}),
  };
  if (Object.keys(preserved.platformResources).length === 0) {
    delete preserved.platformResources;
  }

  const rawColorValues = objectRecord(project.colorValues);
  const iosColors = repairStringMap(
    rawColorValues?.ios,
    defaults.colorValues.ios,
  );
  const androidColors = repairStringMap(
    rawColorValues?.android,
    defaults.colorValues.android,
  );
  project.colorValues = {
    ...(rawColorValues ?? {}),
    ios: iosColors.valid,
    android: androidColors.valid,
  } as ThemeProject['colorValues'];
  const preservedIosColors = mergeUnknownRecords(
    preserved.colorValues?.ios,
    iosColors.unknown,
  );
  const preservedAndroidColors = mergeUnknownRecords(
    preserved.colorValues?.android,
    androidColors.unknown,
  );
  preserved.colorValues = {
    ...(preservedIosColors ? { ios: preservedIosColors } : {}),
    ...(preservedAndroidColors ? { android: preservedAndroidColors } : {}),
  };
  if (Object.keys(preserved.colorValues).length === 0) {
    delete preserved.colorValues;
  }
  const rawColors = objectRecord(project.colors) ?? {};
  project.colors = {
    ...rawColors,
    header: typeof rawColors.header === 'string'
      ? rawColors.header
      : defaults.colors.header,
    primaryText: typeof rawColors.primaryText === 'string'
      ? rawColors.primaryText
      : defaults.colors.primaryText,
    secondaryText: typeof rawColors.secondaryText === 'string'
      ? rawColors.secondaryText
      : defaults.colors.secondaryText,
    accent: typeof rawColors.accent === 'string'
      ? rawColors.accent
      : defaults.colors.accent,
    inputBar: typeof rawColors.inputBar === 'string'
      ? rawColors.inputBar
      : defaults.colors.inputBar,
    notificationBackground:
      typeof rawColors.notificationBackground === 'string'
        ? rawColors.notificationBackground
        : defaults.colors.notificationBackground,
    notificationTitle: typeof rawColors.notificationTitle === 'string'
      ? rawColors.notificationTitle
      : defaults.colors.notificationTitle,
    notificationMessage: typeof rawColors.notificationMessage === 'string'
      ? rawColors.notificationMessage
      : defaults.colors.notificationMessage,
  } as ThemeProject['colors'];

  const rawScreens = objectRecord(project.screens) ?? {};
  project.screens = rawScreens as ThemeProject['screens'];
  for (const screen of Object.keys(defaults.screens) as ScreenId[]) {
    const existing = objectRecord(rawScreens[screen]);
    const repairedBackground = repairVisualFill(existing?.background);
    if (repairedBackground) {
      project.screens[screen] = {
        ...(existing ?? {}),
        background: repairedBackground,
      };
      continue;
    }
    const chatroom = objectRecord(rawScreens.chatroom);
    const chatroomBackground = repairVisualFill(chatroom?.background);
    const background = screen === 'notification' && chatroomBackground
      ? structuredClone(chatroomBackground)
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
      repairedSet[variant] = repairBubbleAppearance(
        rawSet[variant],
        fallback,
      );
    }
    project.chat.bubbles[side] = repairedSet;
  }

  const font = repairFontAsset(project.font);
  if (font) project.font = font;
  else delete project.font;
  const hasPreservedFields = preserved.resources
    || preserved.platformResources?.root
    || preserved.platformResources?.ios
    || preserved.platformResources?.android
    || preserved.colorValues?.ios
    || preserved.colorValues?.android;
  if (hasPreservedFields) project.__preservedUnknownFields = preserved;
  else delete project.__preservedUnknownFields;
  normalizeLegacyProjectImages(project, candidates);
  migrateLegacyNowTabAssets(project);
  return project;
}
