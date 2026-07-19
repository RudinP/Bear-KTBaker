import { describe, expect, it } from 'vitest';
import {
  parseThemeProject,
  serializeThemeProject,
} from './theme/codec';
import { createDefaultTheme } from './theme/defaults';
import { shouldIgnoreLegacyMirroredBubbleAssetTarget } from '../manifest/bubblePlatformIsolation';
import { resolveResourceAsset } from '../manifest/resourceResolver';
import { getMappedResourceWrites } from '../io/resourceWrites';
import {
  collectLegacyProjectImageCandidates,
  isUsableImageAsset,
} from './theme/migrations/legacyProjectImages';
import {
  flatResourcesV1Fixture,
  inlineImagesV1Fixture,
  legacyAsset,
  nestedAssetsV1Fixture,
} from '../test/fixtures/legacyThemeProjects';

describe('theme project', () => {
  it('creates a project that targets iOS and Android together', () => {
    const project = createDefaultTheme('복숭아 우체국');

    expect(project.meta.name).toBe('복숭아 우체국');
    expect(project.targets).toEqual({ ios: true, android: true });
    expect(project.chat.bubbles.me.normal.color).toMatch(/^#/);
    expect(project.screens.chatroom.background.kind).toBe('color');
    expect(project.resources).toEqual({});
    expect(project.chat.bubbles.me.groupedPressed).toBeDefined();
  });

  it('round-trips both platform resources, colors, guides, font, and metadata without loss', () => {
    const project = createDefaultTheme('테스트');
    project.meta = {
      name: '복숭아 테마', author: '제작자', version: '2.4.1',
      themeId: 'com.example.peach', appearance: 'dark',
    };
    project.targets = { ios: true, android: false };
    project.chat.bubbles.me.normal.stretch.stretch.x = [0.31, 0.68];
    project.chat.bubbles.me.normal.stretchByPlatform = {
      ios: {
        stretch: { x: [0.11, 0.22], y: [0.33, 0.44] },
        content: { left: 0.1, top: 0.2, right: 0.8, bottom: 0.9 },
      },
      android: {
        stretch: { x: [0.55, 0.66], y: [0.67, 0.78] },
        content: { left: 0.2, top: 0.3, right: 0.7, bottom: 0.8 },
      },
    };
    project.chat.bubbles.me.normal.guideEditedByPlatform = { ios: true, android: true };
    project.font = {
      family: '내 글씨',
      fileName: 'my-font.otf',
      dataUrl: 'data:font/otf;base64,Zm9udA==',
    };
    project.platformResources.ios['main.background'] = {
      fileName: 'ios-background@3x.png', dataUrl: 'data:image/png;base64,aW9z',
      width: 1125, height: 2250, sourceScale: 3, userSelected: true,
    };
    project.platformResources.android['main.background'] = {
      fileName: 'android-background.png', dataUrl: 'data:image/png;base64,YW5kcm9pZA==',
      width: 1440, height: 2880, sourceScale: 4,
    };
    project.colorValues.ios['HeaderStyle-Main|-ios-text-color'] = '#123456';
    project.colorValues.android.theme_header_color = '#654321';

    const restored = parseThemeProject(serializeThemeProject(project));

    expect(restored.chat.bubbles.me.normal.stretch.stretch.x).toEqual([0.31, 0.68]);
    expect(restored.chat.bubbles.me.normal.stretchByPlatform).toEqual(project.chat.bubbles.me.normal.stretchByPlatform);
    expect(restored.chat.bubbles.me.normal.guideEditedByPlatform).toEqual({ ios: true, android: true });
    expect(restored.font?.fileName).toBe('my-font.otf');
    expect(restored.platformResources).toEqual(project.platformResources);
    expect(restored.colorValues.ios['HeaderStyle-Main|-ios-text-color']).toBe('#123456');
    expect(restored.colorValues.android.theme_header_color).toBe('#654321');
    expect(restored.meta).toEqual(project.meta);
    expect(restored.targets).toEqual({ ios: true, android: false });
  });

  it('rejects files that are not theme studio projects', () => {
    expect(() => parseThemeProject('{"hello":"world"}')).toThrow(
      '테마 스튜디오 프로젝트 파일이 아닙니다.',
    );
  });

  it('fills schema-v1 fields added after an older project was saved without replacing user data', () => {
    const project = createDefaultTheme('예전 프로젝트');
    project.meta.author = '나';
    project.screens.chatroom.background = { kind: 'color', color: '#123456' };
    const legacy = JSON.parse(serializeThemeProject(project));
    delete legacy.meta.appearance;
    delete legacy.targets.android;
    delete legacy.screens.notification;
    delete legacy.screens.splash;

    const restored = parseThemeProject(JSON.stringify(legacy));

    expect(restored.meta.author).toBe('나');
    expect(restored.meta.appearance).toBe('light');
    expect(restored.targets).toEqual({ ios: true, android: true });
    expect(restored.screens.notification.background).toEqual({ kind: 'color', color: '#123456' });
    expect(restored.screens.splash).toBeDefined();
  });

  it('repairs a partial schema-v1 project instead of crashing while it is opened', () => {
    const restored = parseThemeProject(JSON.stringify({
      schema: 'kakao-theme-studio',
      schemaVersion: 1,
      meta: { name: '부분 프로젝트' },
    }));

    expect(restored.meta.name).toBe('부분 프로젝트');
    expect(restored.meta.author).toBe('');
    expect(restored.meta.version).toBe('1.0.0');
    expect(restored.targets).toEqual({ ios: true, android: true });
    expect(restored.chat.bubbles.me.normal).toBeDefined();
    expect(restored.chat.bubbles.you.groupedPressed).toBeDefined();
    expect(restored.screens.chatroom.background).toBeDefined();
  });

  it('preserves unknown nested legacy fields while repairing required structures', () => {
    const raw = {
      schema: 'kakao-theme-studio',
      schemaVersion: 1,
      meta: { name: '중첩 레거시 보존' },
      colorValues: {
        legacyDesktop: { legacyAccent: '#123456' },
      },
      screens: {
        friends: { legacyScreenField: { keep: 'screen' } },
      },
      chat: {
        bubbles: {
          legacyBubbleContainer: { keep: 'container' },
          me: {
            legacySideField: { keep: 'me' },
            normal: {
              color: 123,
              textColor: null,
              stretch: [],
              legacyVariantField: { keep: 'variant' },
            },
          },
          you: {
            legacySideField: { keep: 'you' },
          },
        },
      },
    };
    const expected = createDefaultTheme();
    const parsed = parseThemeProject(JSON.stringify(raw));
    const reparsed = parseThemeProject(serializeThemeProject(parsed));

    for (const project of [parsed, reparsed]) {
      const legacy = project as unknown as {
        colorValues: { legacyDesktop: unknown };
        screens: { friends: { legacyScreenField: unknown } };
        chat: {
          bubbles: {
            legacyBubbleContainer: unknown;
            me: {
              legacySideField: unknown;
              normal: { legacyVariantField: unknown };
            };
            you: { legacySideField: unknown };
          };
        };
      };

      expect(legacy.colorValues.legacyDesktop).toEqual({ legacyAccent: '#123456' });
      expect(legacy.screens.friends.legacyScreenField).toEqual({ keep: 'screen' });
      expect(project.screens.friends.background).toEqual(expected.screens.friends.background);
      expect(legacy.chat.bubbles.legacyBubbleContainer).toEqual({ keep: 'container' });
      expect(legacy.chat.bubbles.me.legacySideField).toEqual({ keep: 'me' });
      expect(legacy.chat.bubbles.you.legacySideField).toEqual({ keep: 'you' });
      expect(legacy.chat.bubbles.me.normal.legacyVariantField).toEqual({ keep: 'variant' });
      expect(project.chat.bubbles.me.normal.color).toBe(expected.chat.bubbles.me.normal.color);
      expect(project.chat.bubbles.me.normal.textColor).toBe(expected.chat.bubbles.me.normal.textColor);
      expect(project.chat.bubbles.me.normal.stretch).toEqual(expected.chat.bubbles.me.normal.stretch);
    }
  });

  it('migrates legacy Piccoma tab assets to missing Now slots per platform without replacing current Now assets', () => {
    const project = createDefaultTheme('예전 Piccoma 프로젝트');
    const iosLegacy = { fileName: 'maintabIcoPiccoma@3x.png', dataUrl: 'data:image/png;base64,aW9z' };
    const androidLegacy = { fileName: 'theme_maintab_ico_piccoma_image.png', dataUrl: 'data:image/png;base64,YW5kcm9pZA==' };
    const androidCurrent = { fileName: 'theme_maintab_ico_now_image.png', dataUrl: 'data:image/png;base64,bm93' };
    project.platformResources.ios['main.tab.piccoma.normal'] = iosLegacy;
    project.platformResources.android['main.tab.piccoma.normal'] = androidLegacy;
    project.platformResources.android['main.tab.now.normal'] = androidCurrent;

    const restored = parseThemeProject(serializeThemeProject(project));

    expect(restored.platformResources.ios['main.tab.now.normal']).toEqual(iosLegacy);
    expect(restored.platformResources.android['main.tab.now.normal']).toEqual(androidCurrent);
  });

  it('quarantines a legacy mirrored bubble without deleting saved project data', () => {
    const project = createDefaultTheme('예전 Android import', false);
    const id = 'chat.bubble.me.first.normal';
    const asset = { fileName: 'theme_chatroom_bubble_me_01_image.png', dataUrl: 'data:image/png;base64,YW5kcm9pZA==', width: 122, height: 112, sourceScale: 3 };
    const guides = {
      stretch: { x: [54 / 122, 56 / 122] as [number, number], y: [55 / 112, 57 / 112] as [number, number] },
      content: { left: 20 / 122, top: 12 / 112, right: 92 / 122, bottom: 100 / 112 },
    };
    project.resources[id] = { ...asset };
    project.platformResources.ios[id] = { ...asset };
    project.platformResources.android[id] = { ...asset };
    project.chat.bubbles.me.normal.stretch = structuredClone(guides);
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: structuredClone(guides), android: structuredClone(guides) };

    const restored = parseThemeProject(serializeThemeProject(project));

    expect(restored.resources[id]).toEqual(asset);
    expect(restored.platformResources.ios[id]).toEqual(asset);
    expect(restored.platformResources.android[id]).toEqual(asset);
    expect(restored.chat.bubbles.me.normal.stretchByPlatform).toEqual(project.chat.bubbles.me.normal.stretchByPlatform);
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(restored, 'ios', id)).toBe(true);
  });
});

describe('legacy schema-v1 image migration', () => {
  it('migrates every supported nested v1 asset to eligible platform slots', () => {
    const restored = parseThemeProject(JSON.stringify(nestedAssetsV1Fixture()));
    for (const platform of ['ios', 'android'] as const) {
      expect(restored.platformResources[platform]['common.theme-icon']).toMatchObject({
        fileName: 'theme-icon.png', userSelected: true,
      });
      expect(restored.platformResources[platform]['main.tab.background']).toMatchObject({
        fileName: 'tab-background.png', userSelected: true,
      });
      expect(restored.platformResources[platform]['main.profile.01']).toMatchObject({
        fileName: 'profile.png', userSelected: true,
      });
      expect(restored.platformResources[platform]['main.add-friend.normal']).toMatchObject({
        fileName: 'add-friend.png', userSelected: true,
      });
      for (const tab of ['friends', 'chats', 'now', 'shopping', 'more'] as const) {
        expect(restored.platformResources[platform][`main.tab.${tab}.normal`]?.fileName)
          .toBe(`${tab}-normal.png`);
        expect(restored.platformResources[platform][`main.tab.${tab}.normal`]?.userSelected).toBe(true);
        expect(restored.platformResources[platform][`main.tab.${tab}.selected`]?.fileName)
          .toBe(`${tab}-selected.png`);
      }
      for (let index = 1; index <= 4; index += 1) {
        expect(restored.platformResources[platform][`passcode.bullet.${index}.normal`]?.fileName)
          .toBe(`bullet-${index}-normal.png`);
        expect(restored.platformResources[platform][`passcode.bullet.${index}.normal`]?.userSelected)
          .toBe(true);
        expect(restored.platformResources[platform][`passcode.bullet.${index}.selected`]?.fileName)
          .toBe(`bullet-${index}-selected.png`);
      }
      expect(restored.platformResources[platform]['main.tab.call.normal']).toBeUndefined();
    }
    expect(restored.platformResources.android['main.profile.01.full']?.fileName).toBe('profile-full.png');
    expect(restored.platformResources.ios['main.profile.01.full']).toBeUndefined();
    expect(restored.platformResources.android['splash.image']?.fileName).toBe('nested-splash.png');
    expect(restored.platformResources.ios['splash.image']).toBeUndefined();
    expect(restored.platformResources.ios['passcode.keypad.pressed']?.fileName).toBe('keypad-pressed.png');
    expect(restored.platformResources.android['passcode.keypad.pressed']).toBeUndefined();
  });

  it('migrates sent and received inline bubble variants through the same mapping', () => {
    const restored = parseThemeProject(JSON.stringify(inlineImagesV1Fixture({ equalMainBackgrounds: true })));
    for (const side of ['me', 'you'] as const) {
      for (const [legacy, current] of [
        ['normal', 'first.normal'],
        ['pressed', 'first.pressed'],
        ['grouped', 'grouped.normal'],
        ['groupedPressed', 'grouped.pressed'],
      ] as const) {
        expect(restored.platformResources.ios[`chat.bubble.${side}.${current}`]?.fileName)
          .toBe(`${side}-${legacy}.png`);
        expect(restored.platformResources.ios[`chat.bubble.${side}.${current}`]?.userSelected)
          .toBe(true);
        if (current.endsWith('.pressed')) {
          expect(restored.platformResources.android[`chat.bubble.${side}.${current}`]).toBeUndefined();
        } else {
          expect(restored.platformResources.android[`chat.bubble.${side}.${current}`]?.fileName)
            .toBe(`${side}-${legacy}.png`);
          expect(restored.platformResources.android[`chat.bubble.${side}.${current}`]?.userSelected)
            .toBe(true);
        }
      }
    }
    for (const platform of ['ios', 'android'] as const) {
      expect(restored.platformResources[platform]['main.background']).toMatchObject({
        fileName: 'inline-friends.png', userSelected: true,
      });
      expect(restored.platformResources[platform]['chat.background']).toMatchObject({
        fileName: 'inline-chat.png', userSelected: true,
      });
      expect(restored.platformResources[platform]['passcode.background']).toMatchObject({
        fileName: 'inline-passcode.png', userSelected: true,
      });
    }
    expect(restored.platformResources.android['splash.image']).toMatchObject({
      fileName: 'inline-splash.png', userSelected: true,
    });
    expect(restored.platformResources.ios['splash.image']).toBeUndefined();
  });

  it('keeps current platform assets ahead of shared nested and inline candidates', () => {
    const currentRaw = inlineImagesV1Fixture({ conflictSplash: true });
    Object.assign(currentRaw, {
      resources: { 'splash.image': legacyAsset('shared-splash') },
      platformResources: { android: { 'splash.image': legacyAsset('current-splash') } },
    });
    const current = parseThemeProject(JSON.stringify(currentRaw));
    expect(current.platformResources.android['splash.image']?.fileName).toBe('current-splash.png');

    const sharedRaw = inlineImagesV1Fixture({ conflictSplash: true });
    Object.assign(sharedRaw, { resources: { 'splash.image': legacyAsset('shared-splash') } });
    const shared = parseThemeProject(JSON.stringify(sharedRaw));
    expect(shared.platformResources.android['splash.image']?.fileName).toBe('shared-splash.png');

    const iconRaw = nestedAssetsV1Fixture();
    Object.assign(iconRaw, {
      resources: { 'common.theme-icon': legacyAsset('shared-icon') },
      platformResources: { ios: { 'common.theme-icon': legacyAsset('current-ios-icon') } },
    });
    const icon = parseThemeProject(JSON.stringify(iconRaw));
    expect(icon.platformResources.ios['common.theme-icon']?.fileName).toBe('current-ios-icon.png');
    expect(icon.platformResources.android['common.theme-icon']).toBeUndefined();
  });

  it('produces the same platform resources when a normalized project is parsed again', () => {
    const first = parseThemeProject(JSON.stringify(nestedAssetsV1Fixture()));
    const second = parseThemeProject(serializeThemeProject(first));
    expect(second.platformResources).toEqual(first.platformResources);
  });

  it('preserves conflicting splash images and does not merge unequal main backgrounds', () => {
    const restored = parseThemeProject(JSON.stringify(
      inlineImagesV1Fixture({ conflictSplash: true }),
    ));
    expect(restored.platformResources.android['splash.image']?.fileName).toBe('nested-splash.png');
    expect(restored.platformResources.ios['splash.image']).toBeUndefined();
    expect(restored.screens.splash.background).toMatchObject({
      kind: 'image', image: { fileName: 'inline-splash.png' },
    });
    expect(restored.platformResources.ios['main.background']).toBeUndefined();
    expect(restored.platformResources.android['main.background']).toBeUndefined();
  });

  it('drops invalid image placeholders and ignores unknown legacy tab keys', () => {
    const raw = nestedAssetsV1Fixture();
    Object.assign(raw, {
      legacyMystery: { keep: true },
      resources: {
        'common.theme-icon': {},
        'main.profile.02': { fileName: '', dataUrl: '' },
      },
      platformResources: {
        ios: { 'common.theme-icon': {}, 'main.profile.02': {} },
        android: { 'common.theme-icon': {}, 'main.profile.02': {} },
      },
    });
    const restored = parseThemeProject(JSON.stringify(raw));
    expect(restored.platformResources.ios['common.theme-icon']?.fileName).toBe('theme-icon.png');
    expect(restored.platformResources.android['common.theme-icon']?.fileName).toBe('theme-icon.png');
    expect((restored as unknown as Record<string, unknown>).legacyMystery).toEqual({ keep: true });
    expect(restored.resources['main.profile.02']).toEqual({ fileName: '', dataUrl: '' });
    expect(restored.platformResources.ios['main.profile.02']).toBeUndefined();
    expect(restored.platformResources.android['main.profile.02']).toBeUndefined();
    expect(getMappedResourceWrites(restored, 'ios').some(({ resourceId }) => resourceId === 'main.profile.02'))
      .toBe(false);
    expect(getMappedResourceWrites(restored, 'android').some(({ resourceId }) => resourceId === 'main.profile.02'))
      .toBe(false);
    expect((restored as unknown as { assets: { tabBar: { icons: Record<string, unknown> } } })
      .assets.tabBar.icons.call).toBeDefined();
    for (const platform of ['ios', 'android'] as const) {
      expect(restored.platformResources[platform]['main.tab.call.normal']).toBeUndefined();
      expect(restored.platformResources[platform]['main.tab.call.selected']).toBeUndefined();
    }
  });

  it('repairs a non-record resources field before normalization', () => {
    const raw = nestedAssetsV1Fixture();
    Object.assign(raw, { resources: [] });
    const restored = parseThemeProject(JSON.stringify(raw));
    expect(restored.resources).toEqual({});
    expect(restored.platformResources.android['common.theme-icon']?.fileName).toBe('theme-icon.png');
  });

  it('migrates flat Piccoma resources after platform normalization', () => {
    const raw = {
      schema: 'kakao-theme-studio',
      schemaVersion: 1,
      meta: { name: 'flat-piccoma' },
      resources: {
        'main.tab.now.normal': {},
        'main.tab.piccoma.normal': legacyAsset('piccoma-normal'),
      },
    };
    const restored = parseThemeProject(JSON.stringify(raw));
    for (const platform of ['ios', 'android'] as const) {
      expect(restored.platformResources[platform]['main.tab.now.normal']?.fileName)
        .toBe('piccoma-normal.png');
    }
    expect(restored.resources['main.tab.now.normal']?.fileName).toBe('piccoma-normal.png');
  });

  it('recovers flat-only and 0.1.1 empty-bucket projects on both platforms', () => {
    for (const raw of [
      flatResourcesV1Fixture(),
      flatResourcesV1Fixture({ ios: {}, android: {} }),
    ]) {
      const restored = parseThemeProject(JSON.stringify(raw));
      for (const platform of ['ios', 'android'] as const) {
        expect(restored.platformResources[platform]['common.theme-icon']).toMatchObject({
          fileName: 'shared-theme-icon.png', userSelected: true,
        });
        expect(restored.platformResources[platform]['main.background']).toMatchObject({
          fileName: 'shared-main-background.png', userSelected: true,
        });
      }
      expect(restored.resources['common.theme-icon']?.fileName).toBe('shared-theme-icon.png');
      expect(restored.resources['main.background']?.fileName).toBe('shared-main-background.png');
    }
  });

  it('applies one-sided shared-resource rules without overwriting the existing platform', () => {
    const mirroredShared = legacyAsset('mirrored-shared');
    const selectedShared = legacyAsset('selected-shared');
    const sameShared = legacyAsset('same-shared');
    const ambiguousShared = legacyAsset('ambiguous-shared');
    const bothShared = legacyAsset('both-shared');
    const keypadShared = legacyAsset('keypad-shared');
    const raw = {
      schema: 'kakao-theme-studio', schemaVersion: 1, meta: { name: 'one-sided' },
      resources: {
        'main.background': mirroredShared,
        'chat.background': selectedShared,
        'passcode.background': sameShared,
        'common.theme-icon': ambiguousShared,
        'main.tab.background': bothShared,
        'passcode.keypad.pressed': keypadShared,
      },
      platformResources: { ios: {
        'main.background': { ...legacyAsset('android-mirror'), mirroredFromPlatform: 'android' as const },
        'chat.background': { ...legacyAsset('ios-selected'), userSelected: true as const },
        'passcode.background': { ...sameShared },
        'common.theme-icon': legacyAsset('unrelated-current'),
        'main.tab.background': legacyAsset('ios-tab-current'),
      }, android: {
        'main.tab.background': legacyAsset('android-tab-current'),
      } },
    };
    const restored = parseThemeProject(JSON.stringify(raw));
    expect(restored.platformResources.ios['main.background']?.fileName).toBe('android-mirror.png');
    expect(restored.platformResources.ios['main.background']?.mirroredFromPlatform).toBe('android');
    expect(restored.platformResources.android['main.background']?.fileName).toBe('mirrored-shared.png');
    expect(restored.platformResources.android['main.background']?.mirroredFromPlatform).toBeUndefined();
    expect(restored.platformResources.ios['chat.background']?.fileName).toBe('ios-selected.png');
    expect(restored.platformResources.ios['chat.background']?.userSelected).toBe(true);
    expect(restored.platformResources.android['chat.background']).toMatchObject({
      fileName: 'selected-shared.png', userSelected: true,
    });
    expect(restored.platformResources.android['passcode.background']).toMatchObject({
      fileName: 'same-shared.png', mirroredFromPlatform: 'ios',
    });
    expect(restored.platformResources.android['common.theme-icon']).toBeUndefined();
    expect(restored.platformResources.ios['main.tab.background']?.fileName).toBe('ios-tab-current.png');
    expect(restored.platformResources.android['main.tab.background']?.fileName).toBe('android-tab-current.png');
    expect(restored.platformResources.ios['passcode.keypad.pressed']).toMatchObject({
      fileName: 'keypad-shared.png', userSelected: true,
    });
    expect(restored.platformResources.android['passcode.keypad.pressed']).toBeUndefined();
  });

  it('marks a one-sided shared bubble mirror without quarantining its target', () => {
    const id = 'chat.bubble.me.first.normal';
    const shared = legacyAsset('chatroomBubbleSend01@3x', { sourceScale: 3 });
    const raw = {
      schema: 'kakao-theme-studio', schemaVersion: 1, meta: { name: 'mixed-bubble' },
      resources: { [id]: shared },
      platformResources: { ios: { [id]: { ...shared } } },
    };
    const restored = parseThemeProject(JSON.stringify(raw));
    expect(restored.platformResources.ios[id]?.mirroredFromPlatform).toBeUndefined();
    expect(restored.platformResources.android[id]).toMatchObject({
      fileName: 'chatroomBubbleSend01@3x.png', mirroredFromPlatform: 'ios',
    });
    expect(resolveResourceAsset(restored, 'android', id)).toBeDefined();
    expect(getMappedResourceWrites(restored, 'android'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ resourceId: id })]));
    const reparsed = parseThemeProject(serializeThemeProject(restored));
    expect(reparsed.platformResources.android[id]?.mirroredFromPlatform).toBe('ios');
  });

  it('accepts only image assets with non-empty file names and data URLs', () => {
    expect(isUsableImageAsset(legacyAsset('valid'))).toBe(true);
    expect(isUsableImageAsset({ fileName: '', dataUrl: 'data:image/png;base64,eA==' })).toBe(false);
    expect(isUsableImageAsset({ fileName: 'x.png', dataUrl: '  ' })).toBe(false);
    expect(isUsableImageAsset({})).toBe(false);
  });

  it('captures current, shared, nested, and inline candidates before defaults are applied', () => {
    const raw = inlineImagesV1Fixture({ equalMainBackgrounds: true, conflictSplash: true });
    Object.assign(raw, {
      resources: { 'common.theme-icon': legacyAsset('shared-icon') },
      platformResources: {
        ios: { 'common.theme-icon': legacyAsset('ios-icon'), invalid: {} },
      },
    });
    const candidates = collectLegacyProjectImageCandidates(raw);
    expect(candidates.currentPlatformResources.ios['common.theme-icon']?.fileName).toBe('ios-icon.png');
    expect(candidates.currentPlatformResources.ios.invalid).toBeUndefined();
    expect(candidates.currentPlatformResources.android).toEqual({});
    expect(candidates.sharedResources['common.theme-icon']?.fileName).toBe('shared-icon.png');
    expect(candidates.nestedAssets['splash.image']?.fileName).toBe('nested-splash.png');
    expect(candidates.inlineAssets['splash.image']).toBeUndefined();
    expect(candidates.inlineAssets['main.background']?.fileName).toBe('inline-friends.png');
    expect(candidates.inlineAssets['main.background']?.dataUrl).toBe(legacyAsset('shared-inline-main').dataUrl);
    expect(candidates.inlineAssets['chat.bubble.me.first.normal']).toBeDefined();
    expect(candidates.inlineAssets['chat.bubble.you.grouped.pressed']).toBeDefined();
  });
});
