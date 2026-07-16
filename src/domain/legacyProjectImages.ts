import type { ImageAsset, Platform } from './theme';

export type LegacyImageMap = Record<string, ImageAsset>;

export interface LegacyProjectImageCandidates {
  currentPlatformResources: Record<Platform, LegacyImageMap>;
  sharedResources: LegacyImageMap;
  nestedAssets: LegacyImageMap;
  inlineAssets: LegacyImageMap;
}

type UnknownRecord = Record<string, unknown>;
type CandidateEntry = readonly [id: string, value: unknown];

const platforms = ['ios', 'android'] as const;
const legacyTabs = ['friends', 'chats', 'now', 'shopping', 'more'] as const;
const bubbleVariants = {
  normal: 'first.normal',
  pressed: 'first.pressed',
  grouped: 'grouped.normal',
  groupedPressed: 'grouped.pressed',
} as const;

function record(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

function child(value: unknown, key: string) {
  return record(value)?.[key];
}

export function isUsableImageAsset(value: unknown): value is ImageAsset {
  const candidate = record(value);
  return typeof candidate?.fileName === 'string'
    && candidate.fileName.trim().length > 0
    && typeof candidate.dataUrl === 'string'
    && candidate.dataUrl.trim().length > 0;
}

function validAssetMap(value: unknown): LegacyImageMap {
  return Object.fromEntries(Object.entries(record(value) ?? {})
    .filter((entry): entry is [string, ImageAsset] => isUsableImageAsset(entry[1]))
    .map(([id, asset]) => [id, { ...asset }]));
}

function setCandidate(target: LegacyImageMap, id: string, value: unknown) {
  if (target[id] === undefined && isUsableImageAsset(value)) target[id] = { ...value };
}

function setCandidates(target: LegacyImageMap, entries: readonly CandidateEntry[]) {
  for (const [id, value] of entries) setCandidate(target, id, value);
}

function screenImage(source: unknown, screen: string) {
  return child(child(child(child(source, 'screens'), screen), 'background'), 'image');
}

function sameCandidateImageData(left: ImageAsset, right: ImageAsset) {
  return left.dataUrl === right.dataUrl;
}

export function collectLegacyProjectImageCandidates(
  source: unknown,
): LegacyProjectImageCandidates {
  const nestedAssets: LegacyImageMap = {};
  const inlineAssets: LegacyImageMap = {};
  const assets = child(source, 'assets');
  const nestedCandidates: CandidateEntry[] = [
    ['common.theme-icon', child(assets, 'themeIcon')],
    ['main.tab.background', child(child(assets, 'tabBar'), 'background')],
    ['main.profile.01', child(assets, 'profile')],
    ['main.profile.01.full', child(assets, 'profileFull')],
    ['main.add-friend.normal', child(assets, 'addFriendButton')],
    ['splash.image', child(assets, 'splash')],
  ];

  for (const tab of legacyTabs) {
    for (const state of ['normal', 'selected'] as const) {
      nestedCandidates.push([
        `main.tab.${tab}.${state}`,
        child(child(child(child(assets, 'tabBar'), 'icons'), tab), state),
      ]);
    }
  }

  for (const state of ['normal', 'selected'] as const) {
    const bullets = child(child(child(assets, 'passcode'), 'bullets'), state);
    if (!Array.isArray(bullets)) continue;
    for (let index = 0; index < 4; index += 1) {
      nestedCandidates.push([
        `passcode.bullet.${index + 1}.${state}`,
        bullets[index],
      ]);
    }
  }

  nestedCandidates.push([
    'passcode.keypad.pressed',
    child(child(assets, 'passcode'), 'keypadPressed'),
  ]);
  setCandidates(nestedAssets, nestedCandidates);

  setCandidate(inlineAssets, 'chat.background', screenImage(source, 'chatroom'));
  setCandidate(inlineAssets, 'passcode.background', screenImage(source, 'passcode'));
  if (!nestedAssets['splash.image']) {
    setCandidate(inlineAssets, 'splash.image', screenImage(source, 'splash'));
  }

  const mainImages = ['friends', 'chats', 'now', 'more']
    .map((screen) => screenImage(source, screen))
    .filter(isUsableImageAsset);
  if (mainImages.length === 4
    && mainImages.slice(1).every((image) => sameCandidateImageData(mainImages[0], image))) {
    setCandidate(inlineAssets, 'main.background', mainImages[0]);
  }

  for (const side of ['me', 'you'] as const) {
    for (const [legacyVariant, currentVariant] of Object.entries(bubbleVariants)) {
      const appearance = child(
        child(child(child(source, 'chat'), 'bubbles'), side),
        legacyVariant,
      );
      setCandidate(
        inlineAssets,
        `chat.bubble.${side}.${currentVariant}`,
        child(appearance, 'image'),
      );
    }
  }

  const platformResources = child(source, 'platformResources');
  const currentPlatformResources = Object.fromEntries(platforms.map((platform) => [
    platform,
    validAssetMap(child(platformResources, platform)),
  ])) as Record<Platform, LegacyImageMap>;

  return {
    currentPlatformResources,
    sharedResources: validAssetMap(child(source, 'resources')),
    nestedAssets,
    inlineAssets,
  };
}
