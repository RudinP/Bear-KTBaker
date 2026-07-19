import { describe, expect, it } from 'vitest';
import { DEFAULT_NINE_PATCH, type NinePatchGuides } from '../domain/ninePatch';
import { createDefaultTheme } from '../domain/theme/defaults';
import { resolveBubbleGuides } from './bubbleGuideResolver';

const iosOfficialSend: NinePatchGuides = {
  stretch: { x: [51 / 120, 54 / 120], y: [51 / 105, 54 / 105] },
  content: { left: 33 / 120, top: 30 / 105, right: 69 / 120, bottom: 84 / 105 },
};

const androidImported: NinePatchGuides = {
  stretch: { x: [54 / 122, 56 / 122], y: [55 / 112, 57 / 112] },
  content: { left: 20 / 122, top: 12 / 112, right: 92 / 122, bottom: 100 / 112 },
};

describe('platform-safe bubble guide resolution', () => {
  it('does not reinterpret an Android stored/shared guide after an iOS asset is attached', () => {
    const project = createDefaultTheme();
    project.chat.bubbles.me.normal.stretch = androidImported;
    project.chat.bubbles.me.normal.stretchByPlatform = { android: androidImported };
    project.platformResources.ios['chat.bubble.me.first.normal'] = {
      fileName: 'custom-ios@3x.png', dataUrl: 'data:image/png;base64,AA==', width: 120, height: 105, sourceScale: 3,
    };

    const resolved = resolveBubbleGuides(project, 'ios', 'chat.bubble.me.first.normal');

    expect(resolved.source).toBe('official-sample');
    expect(resolved.guides).toEqual(iosOfficialSend);
  });

  it('does not treat a newly attached asset plus generic defaults as an explicit legacy edit', () => {
    const project = createDefaultTheme();
    project.platformResources.ios['chat.bubble.me.first.normal'] = {
      fileName: 'fresh@3x.png', dataUrl: 'data:image/png;base64,AA==', width: 120, height: 105, sourceScale: 3,
    };

    const resolved = resolveBubbleGuides(project, 'ios', 'chat.bubble.me.first.normal');

    expect(project.chat.bubbles.me.normal.stretch).toEqual(DEFAULT_NINE_PATCH);
    expect(resolved.source).toBe('official-sample');
    expect(resolved.guides).toEqual(iosOfficialSend);
  });

  it('preserves a real legacy shared edit even when the sample asset itself was untouched', () => {
    const project = createDefaultTheme();
    const legacy: NinePatchGuides = {
      stretch: { x: [0.2, 0.21], y: [0.3, 0.31] },
      content: { left: 0.1, top: 0.2, right: 0.7, bottom: 0.8 },
    };
    project.chat.bubbles.me.normal.stretch = legacy;

    const resolved = resolveBubbleGuides(project, 'ios', 'chat.bubble.me.first.normal');

    expect(resolved.source).toBe('custom-legacy');
    expect(resolved.guides).toEqual(legacy);
  });

  it('uses official iOS guides instead of a legacy mirrored Android stored guide', () => {
    const project = createDefaultTheme('예전 Android import', false);
    const id = 'chat.bubble.me.first.normal';
    const asset = { fileName: 'theme_chatroom_bubble_me_01_image.png', dataUrl: 'data:image/png;base64,YW5kcm9pZA==', width: 122, height: 112, sourceScale: 3 };
    project.resources[id] = { ...asset };
    project.platformResources.ios[id] = { ...asset };
    project.platformResources.android[id] = { ...asset };
    project.chat.bubbles.me.normal.stretch = structuredClone(androidImported);
    project.chat.bubbles.me.normal.stretchByPlatform = {
      ios: structuredClone(androidImported),
      android: structuredClone(androidImported),
    };

    expect(resolveBubbleGuides(project, 'ios', id)).toMatchObject({ source: 'official-sample', guides: iosOfficialSend });
    expect(resolveBubbleGuides(project, 'android', id)).toMatchObject({ source: 'stored-platform', guides: androidImported });
  });

  it('uses official iOS guides after only the legacy mirror target asset is replaced, then honors a target guide edit', () => {
    const project = createDefaultTheme('예전 Android import', false);
    const id = 'chat.bubble.me.first.normal';
    const imported = { fileName: 'theme_chatroom_bubble_me_01_image.png', dataUrl: 'data:image/png;base64,YW5kcm9pZA==', width: 122, height: 112, sourceScale: 3 };
    project.resources[id] = { ...imported };
    project.platformResources.android[id] = { ...imported };
    project.platformResources.ios[id] = { fileName: 'new-ios@3x.png', dataUrl: 'data:image/png;base64,aW9z', width: 120, height: 105, sourceScale: 3 };
    project.chat.bubbles.me.normal.stretch = structuredClone(androidImported);
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: structuredClone(androidImported), android: structuredClone(androidImported) };

    expect(resolveBubbleGuides(project, 'ios', id)).toMatchObject({ source: 'official-sample', guides: iosOfficialSend });

    const edited = { ...iosOfficialSend, content: { ...iosOfficialSend.content, left: 0.2 } };
    project.chat.bubbles.me.normal.stretch = structuredClone(edited);
    project.chat.bubbles.me.normal.stretchByPlatform.ios = structuredClone(edited);
    expect(resolveBubbleGuides(project, 'ios', id)).toMatchObject({ source: 'stored-platform', guides: edited });
  });

  it('uses official Android guides after only an iOS legacy mirror target asset is replaced', () => {
    const project = createDefaultTheme('예전 iOS import', false);
    const id = 'chat.bubble.me.first.normal';
    const imported = { fileName: 'myBubble@3x.png', dataUrl: 'data:image/png;base64,aW9z', width: 120, height: 105, sourceScale: 3 };
    project.resources[id] = { ...imported };
    project.platformResources.ios[id] = { ...imported };
    project.platformResources.android[id] = { fileName: 'new-android.png', dataUrl: 'data:image/png;base64,YW5kcm9pZA==', width: 122, height: 112, sourceScale: 3 };
    project.chat.bubbles.me.normal.stretch = structuredClone(iosOfficialSend);
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: structuredClone(iosOfficialSend), android: structuredClone(iosOfficialSend) };

    expect(resolveBubbleGuides(project, 'android', id)).toMatchObject({ source: 'official-sample', guides: androidImported });
  });

  it('keeps the untouched Android mirror guide isolated after the iOS source guide is edited', () => {
    const project = createDefaultTheme('예전 iOS import', false);
    const id = 'chat.bubble.me.first.normal';
    const imported = { fileName: 'myBubble@3x.png', dataUrl: 'data:image/png;base64,aW9z', width: 120, height: 105, sourceScale: 3 };
    project.resources[id] = { ...imported };
    project.platformResources.ios[id] = { fileName: 'edited@3x.png', dataUrl: 'data:image/png;base64,ZWRpdGVk', width: 120, height: 105, sourceScale: 3 };
    project.platformResources.android[id] = { ...imported };
    const editedSource = { ...iosOfficialSend, content: { ...iosOfficialSend.content, left: 0.2 } };
    project.chat.bubbles.me.normal.stretch = structuredClone(editedSource);
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: structuredClone(editedSource), android: structuredClone(iosOfficialSend) };

    expect(resolveBubbleGuides(project, 'ios', id)).toMatchObject({ source: 'stored-platform', guides: editedSource });
    expect(resolveBubbleGuides(project, 'android', id)).toMatchObject({ source: 'official-sample', guides: androidImported });
  });
});
