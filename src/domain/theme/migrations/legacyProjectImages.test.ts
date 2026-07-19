import { describe, expect, it } from 'vitest';
import { createDefaultTheme } from '../defaults';
import type { ImageAsset, Platform } from '../model';
import {
  collectLegacyProjectImageCandidates,
  isUsableImageAsset,
  normalizeLegacyProjectImages,
  type LegacyProjectImageCandidates,
} from './legacyProjectImages';
import {
  inlineImagesV1Fixture,
  legacyAsset,
} from '../../../test/fixtures/legacyThemeProjects';

const platforms: Platform[] = ['ios', 'android'];

function emptyCandidates(): LegacyProjectImageCandidates {
  return {
    currentPlatformResources: { ios: {}, android: {} },
    sharedResources: {},
    nestedAssets: {},
    inlineAssets: {},
  };
}

function normalizeWithCandidates(
  candidates: LegacyProjectImageCandidates,
): Record<Platform, ImageAsset | undefined> {
  const project = createDefaultTheme('우선순위 테스트');
  project.platformResources = {
    ios: { ...candidates.currentPlatformResources.ios },
    android: { ...candidates.currentPlatformResources.android },
  };
  normalizeLegacyProjectImages(project, candidates);
  return {
    ios: project.platformResources.ios['main.tab.background'],
    android: project.platformResources.android['main.tab.background'],
  };
}

describe('legacy project image migration', () => {
  it('accepts only assets with non-empty file names and data URLs', () => {
    expect(isUsableImageAsset(legacyAsset('valid'))).toBe(true);
    expect(isUsableImageAsset({ fileName: '', dataUrl: 'data:image/png;base64,eA==' })).toBe(false);
    expect(isUsableImageAsset({ fileName: 'x.png', dataUrl: '  ' })).toBe(false);
    expect(isUsableImageAsset({})).toBe(false);
  });

  it('collects usable current, shared, nested, and inline candidates before repair', () => {
    const raw = inlineImagesV1Fixture({ equalMainBackgrounds: true, conflictSplash: true });
    Object.assign(raw, {
      resources: { 'common.theme-icon': legacyAsset('shared-icon') },
      platformResources: {
        ios: { 'common.theme-icon': legacyAsset('ios-icon'), invalid: {} },
      },
    });

    const candidates = collectLegacyProjectImageCandidates(raw);

    expect(candidates.currentPlatformResources.ios['common.theme-icon']?.fileName)
      .toBe('ios-icon.png');
    expect(candidates.currentPlatformResources.ios.invalid).toBeUndefined();
    expect(candidates.currentPlatformResources.android).toEqual({});
    expect(candidates.sharedResources['common.theme-icon']?.fileName).toBe('shared-icon.png');
    expect(candidates.nestedAssets['splash.image']?.fileName).toBe('nested-splash.png');
    expect(candidates.inlineAssets['splash.image']).toBeUndefined();
    expect(candidates.inlineAssets['main.background']?.fileName).toBe('inline-friends.png');
  });

  it('keeps current platform assets ahead of shared, nested, and inline assets', () => {
    const candidates = emptyCandidates();
    candidates.currentPlatformResources = {
      ios: { 'main.tab.background': legacyAsset('current-ios') },
      android: { 'main.tab.background': legacyAsset('current-android') },
    };
    candidates.sharedResources['main.tab.background'] = legacyAsset('shared');
    candidates.nestedAssets['main.tab.background'] = legacyAsset('nested');
    candidates.inlineAssets['main.tab.background'] = legacyAsset('inline');

    const restored = normalizeWithCandidates(candidates);

    expect(restored.ios?.fileName).toBe('current-ios.png');
    expect(restored.android?.fileName).toBe('current-android.png');
  });

  it.each([
    ['sharedResources', 'shared'],
    ['nestedAssets', 'nested'],
    ['inlineAssets', 'inline'],
  ] as const)('uses %s when all higher-priority candidates are absent', (bucket, name) => {
    const candidates = emptyCandidates();
    candidates[bucket]['main.tab.background'] = legacyAsset(name);

    const restored = normalizeWithCandidates(candidates);

    for (const platform of platforms) {
      expect(restored[platform]?.fileName).toBe(`${name}.png`);
    }
  });
});
