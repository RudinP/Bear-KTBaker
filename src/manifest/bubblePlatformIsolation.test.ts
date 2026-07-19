import { describe, expect, it } from 'vitest';
import type { ImageAsset } from '../domain/theme/model';
import { createDefaultTheme } from '../domain/theme/defaults';
import type { NinePatchGuides } from '../domain/ninePatch';
import { updateBubbleGuides } from '../domain/bubbleGuideUpdate';
import {
  legacyMirroredBubbleAssetSource,
  legacyMirroredBubbleGuideSource,
  shouldIgnoreLegacyMirroredBubbleAssetTarget,
  shouldIgnoreLegacyMirroredBubbleGuideTarget,
} from './bubblePlatformIsolation';

const resourceId = 'chat.bubble.me.first.normal';
const iosGuides: NinePatchGuides = {
  stretch: { x: [51 / 120, 54 / 120], y: [51 / 105, 54 / 105] },
  content: { left: 33 / 120, top: 30 / 105, right: 69 / 120, bottom: 84 / 105 },
};
const androidGuides: NinePatchGuides = {
  stretch: { x: [54 / 122, 56 / 122], y: [55 / 112, 57 / 112] },
  content: { left: 20 / 122, top: 12 / 112, right: 92 / 122, bottom: 100 / 112 },
};

function legacyMirror(fileName: string, guides: NinePatchGuides, patch: Partial<ImageAsset> = {}) {
  const project = createDefaultTheme('예전 import', false);
  const asset: ImageAsset = {
    fileName,
    dataUrl: 'data:image/png;base64,bGVnYWN5',
    width: fileName.startsWith('theme_') ? 122 : 120,
    height: fileName.startsWith('theme_') ? 112 : 105,
    sourceScale: 3,
    rawNinePatch: false,
    ...patch,
  };
  project.resources[resourceId] = { ...asset };
  project.platformResources.ios[resourceId] = { ...asset };
  project.platformResources.android[resourceId] = { ...asset };
  project.chat.bubbles.me.normal.stretch = structuredClone(guides);
  project.chat.bubbles.me.normal.stretchByPlatform = {
    ios: structuredClone(guides),
    android: structuredClone(guides),
  };
  return project;
}

describe('legacy mirrored bubble isolation', () => {
  it('never classifies an ordinary semantic resource as a legacy bubble mirror', () => {
    const project = createDefaultTheme('일반 리소스 import', false);
    const id = 'main.background';
    const asset: ImageAsset = {
      fileName: 'mainBgImage@3x.png', dataUrl: 'data:image/png;base64,bWFpbg==', width: 960, height: 1740, sourceScale: 3,
    };
    project.resources[id] = { ...asset };
    project.platformResources.ios[id] = { ...asset };
    project.platformResources.android[id] = { ...asset };

    expect(legacyMirroredBubbleAssetSource(project, id)).toBeUndefined();
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'android', id)).toBe(false);
  });

  it('keeps a provenance-marked image-only semantic bubble mirror visible', () => {
    const project = legacyMirror('chatroomBubbleSend01@3x.png', iosGuides);
    delete project.chat.bubbles.me.normal.stretchByPlatform?.android;
    project.platformResources.android[resourceId] = {
      ...project.platformResources.android[resourceId]!, mirroredFromPlatform: 'ios',
    };

    expect(legacyMirroredBubbleAssetSource(project, resourceId)).toBeUndefined();
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'android', resourceId)).toBe(false);
  });

  it('quarantines only the Android copy of a canonical iOS import', () => {
    const project = legacyMirror('chatroomBubbleSend01@3x.png', iosGuides);

    expect(legacyMirroredBubbleAssetSource(project, resourceId)).toBe('ios');
    expect(legacyMirroredBubbleGuideSource(project, resourceId)).toBe('ios');
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'ios', resourceId)).toBe(false);
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'android', resourceId)).toBe(true);
    expect(shouldIgnoreLegacyMirroredBubbleGuideTarget(project, 'android', resourceId)).toBe(true);
  });

  it('quarantines only the iOS copy of a canonical Android import', () => {
    const project = legacyMirror('theme_chatroom_bubble_me_01_image.png', androidGuides);

    expect(legacyMirroredBubbleAssetSource(project, resourceId)).toBe('android');
    expect(legacyMirroredBubbleGuideSource(project, resourceId)).toBe('android');
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'ios', resourceId)).toBe(true);
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'android', resourceId)).toBe(false);
    expect(shouldIgnoreLegacyMirroredBubbleGuideTarget(project, 'ios', resourceId)).toBe(true);
  });

  it.each([
    ['myBubble@3x.png', 3],
    ['custom.png', 1],
    ['theme_chatroom_bubble_me_01_image.png', 1],
  ])('recognizes a valid iOS import provenance for %s', (fileName, sourceScale) => {
    const project = legacyMirror(fileName, iosGuides, { sourceScale });

    expect(legacyMirroredBubbleAssetSource(project, resourceId)).toBe('ios');
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'android', resourceId)).toBe(true);
  });

  it('keeps a new target asset while quarantining only its stale mirrored guide', () => {
    const project = legacyMirror('theme_chatroom_bubble_me_01_image.png', androidGuides);
    project.platformResources.ios[resourceId] = {
      fileName: 'new-ios@3x.png', dataUrl: 'data:image/png;base64,bmV3', width: 120, height: 105, sourceScale: 3,
    };

    expect(legacyMirroredBubbleAssetSource(project, resourceId)).toBeUndefined();
    expect(legacyMirroredBubbleGuideSource(project, resourceId)).toBe('android');
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'ios', resourceId)).toBe(false);
    expect(shouldIgnoreLegacyMirroredBubbleGuideTarget(project, 'ios', resourceId)).toBe(true);

    project.chat.bubbles.me.normal.stretch = structuredClone(iosGuides);
    project.chat.bubbles.me.normal.stretchByPlatform!.ios = structuredClone(iosGuides);
    expect(legacyMirroredBubbleGuideSource(project, resourceId)).toBeUndefined();
    expect(shouldIgnoreLegacyMirroredBubbleGuideTarget(project, 'ios', resourceId)).toBe(false);
  });

  it('keeps the untouched target asset and guide quarantined after source-side edits', () => {
    const project = legacyMirror('myBubble@3x.png', iosGuides);
    project.platformResources.ios[resourceId] = {
      fileName: 'edited-source@3x.png', dataUrl: 'data:image/png;base64,ZWRpdGVk', width: 120, height: 105, sourceScale: 3,
    };
    const editedSource = structuredClone(iosGuides);
    editedSource.content.left = 0.2;
    project.chat.bubbles.me.normal.stretch = structuredClone(editedSource);
    project.chat.bubbles.me.normal.stretchByPlatform!.ios = structuredClone(editedSource);

    expect(legacyMirroredBubbleAssetSource(project, resourceId)).toBe('ios');
    expect(legacyMirroredBubbleGuideSource(project, resourceId)).toBe('ios');
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'android', resourceId)).toBe(true);
    expect(shouldIgnoreLegacyMirroredBubbleGuideTarget(project, 'android', resourceId)).toBe(true);
  });

  it('recognizes a target guide edit without exposing its still-mirrored asset', () => {
    const project = legacyMirror('myBubble@3x.png', iosGuides);
    const editedTarget = structuredClone(androidGuides);
    project.chat.bubbles.me.normal.stretch = structuredClone(editedTarget);
    project.chat.bubbles.me.normal.stretchByPlatform!.android = structuredClone(editedTarget);

    expect(legacyMirroredBubbleAssetSource(project, resourceId)).toBe('ios');
    expect(legacyMirroredBubbleGuideSource(project, resourceId)).toBeUndefined();
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'android', resourceId)).toBe(true);
    expect(shouldIgnoreLegacyMirroredBubbleGuideTarget(project, 'android', resourceId)).toBe(false);
  });

  it('remembers a target guide edit after the source guide is edited later', () => {
    const project = legacyMirror('myBubble@3x.png', iosGuides);
    project.platformResources.android[resourceId] = {
      fileName: 'new-android.png', dataUrl: 'data:image/png;base64,YW5kcm9pZA==', width: 122, height: 112, sourceScale: 3,
    };
    const afterTarget = updateBubbleGuides(project, 'me', 'normal', 'android', androidGuides);
    const editedSource = structuredClone(iosGuides);
    editedSource.content.left = 0.2;
    const afterSource = updateBubbleGuides(afterTarget, 'me', 'normal', 'ios', editedSource);

    expect(afterSource.chat.bubbles.me.normal.guideEditedByPlatform).toEqual({ android: true, ios: true });
    expect(legacyMirroredBubbleGuideSource(afterSource, resourceId)).toBeUndefined();
    expect(shouldIgnoreLegacyMirroredBubbleGuideTarget(afterSource, 'android', resourceId)).toBe(false);
  });

  it('honors an explicit target selection even when the selected bytes match the old mirror', () => {
    const project = legacyMirror('myBubble@3x.png', iosGuides);
    project.platformResources.android[resourceId] = {
      ...project.platformResources.android[resourceId]!, userSelected: true,
    };

    expect(legacyMirroredBubbleAssetSource(project, resourceId)).toBeUndefined();
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'android', resourceId)).toBe(false);
  });

  it.each([
    ['ambiguous provenance', (project: ReturnType<typeof legacyMirror>) => {
      for (const asset of [project.resources[resourceId], project.platformResources.ios[resourceId], project.platformResources.android[resourceId]]) {
        if (asset) { asset.fileName = 'custom.png'; asset.sourceScale = undefined; }
      }
    }],
    ['conflicting format signal', (project: ReturnType<typeof legacyMirror>) => { project.resources[resourceId]!.rawNinePatch = project.platformResources.ios[resourceId]!.rawNinePatch = project.platformResources.android[resourceId]!.rawNinePatch = true; }],
    ['missing shared import asset', (project: ReturnType<typeof legacyMirror>) => { delete project.resources[resourceId]; }],
    ['bundled sample project', (project: ReturnType<typeof legacyMirror>) => { project.baseSample = 'apeach'; }],
  ])('preserves both platforms for %s', (_label, mutate) => {
    const project = legacyMirror('chatroomBubbleSend01@3x.png', iosGuides);
    mutate(project);

    expect(legacyMirroredBubbleAssetSource(project, resourceId)).toBeUndefined();
    expect(legacyMirroredBubbleGuideSource(project, resourceId)).toBeUndefined();
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'ios', resourceId)).toBe(false);
    expect(shouldIgnoreLegacyMirroredBubbleAssetTarget(project, 'android', resourceId)).toBe(false);
    expect(shouldIgnoreLegacyMirroredBubbleGuideTarget(project, 'ios', resourceId)).toBe(false);
    expect(shouldIgnoreLegacyMirroredBubbleGuideTarget(project, 'android', resourceId)).toBe(false);
  });
});
