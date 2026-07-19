import type { ImageAsset, Platform } from '../../domain/theme/model';

export function legacyAsset(name: string, overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    fileName: `${name}.png`,
    dataUrl: `data:image/png;base64,${Buffer.from(name).toString('base64')}`,
    width: 30,
    height: 30,
    ...overrides,
  };
}

function baseLegacyProject(name: string) {
  return {
    schema: 'kakao-theme-studio',
    schemaVersion: 1,
    meta: { name },
  };
}

export function flatResourcesV1Fixture(
  platformResources?: Partial<Record<Platform, Record<string, unknown>>>,
) {
  return {
    ...baseLegacyProject('flat-v1'),
    resources: {
      'common.theme-icon': legacyAsset('shared-theme-icon'),
      'main.background': legacyAsset('shared-main-background'),
    },
    ...(platformResources === undefined ? {} : { platformResources }),
  };
}

export function nestedAssetsV1Fixture() {
  const icons = Object.fromEntries(
    ['friends', 'chats', 'now', 'shopping', 'more', 'call'].map((tab) => [tab, {
      normal: legacyAsset(`${tab}-normal`),
      selected: legacyAsset(`${tab}-selected`),
    }]),
  );
  return {
    ...baseLegacyProject('nested-v1'),
    assets: {
      themeIcon: legacyAsset('theme-icon'),
      tabBar: { background: legacyAsset('tab-background'), icons },
      profile: legacyAsset('profile'),
      profileFull: legacyAsset('profile-full'),
      addFriendButton: legacyAsset('add-friend'),
      splash: legacyAsset('nested-splash'),
      passcode: {
        bullets: {
          normal: Array.from({ length: 4 }, (_, index) => legacyAsset(`bullet-${index + 1}-normal`)),
          selected: Array.from({ length: 4 }, (_, index) => legacyAsset(`bullet-${index + 1}-selected`)),
        },
        keypadPressed: legacyAsset('keypad-pressed'),
      },
    },
  };
}

export function inlineImagesV1Fixture(options: {
  equalMainBackgrounds?: boolean;
  conflictSplash?: boolean;
} = {}) {
  const sharedMain = legacyAsset('shared-inline-main');
  const screenImage = (screen: string) => options.equalMainBackgrounds
    ? { ...sharedMain, fileName: `inline-${screen}.png` }
    : legacyAsset(`inline-${screen}`);
  const bubble = (side: 'me' | 'you', variant: string) => ({
    color: '#FFFFFF',
    textColor: '#000000',
    image: legacyAsset(`${side}-${variant}`),
  });
  return {
    ...baseLegacyProject('inline-v1'),
    ...(options.conflictSplash ? { assets: { splash: legacyAsset('nested-splash') } } : {}),
    screens: {
      friends: { background: { kind: 'image', color: '#FFFFFF', image: screenImage('friends') } },
      chats: { background: { kind: 'image', color: '#FFFFFF', image: screenImage('chats') } },
      now: { background: { kind: 'image', color: '#FFFFFF', image: screenImage('now') } },
      more: { background: { kind: 'image', color: '#FFFFFF', image: screenImage('more') } },
      chatroom: { background: { kind: 'image', color: '#FFFFFF', image: legacyAsset('inline-chat') } },
      passcode: { background: { kind: 'image', color: '#FFFFFF', image: legacyAsset('inline-passcode') } },
      splash: { background: { kind: 'image', color: '#FFFFFF', image: legacyAsset('inline-splash') } },
    },
    chat: {
      bubbles: Object.fromEntries(['me', 'you'].map((side) => [side, Object.fromEntries(
        ['normal', 'pressed', 'grouped', 'groupedPressed']
          .map((variant) => [variant, bubble(side as 'me' | 'you', variant)]),
      )])),
      unreadColor: '#FF0000',
    },
  };
}
