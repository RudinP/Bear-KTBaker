import { describe, expect, it } from 'vitest';
import { createDefaultTheme } from './theme';
import type { NinePatchGuides } from './ninePatch';
import { updateBubbleGuides } from './bubbleGuideUpdate';
import { resolveBubbleGuides } from '../manifest/bubbleGuideResolver';

const guides = (stretchX: number, left: number): NinePatchGuides => ({
  stretch: { x: [stretchX, stretchX + 0.01], y: [0.4, 0.41] },
  content: { left, top: 0.2, right: 0.8, bottom: 0.9 },
});

describe('OS bubble guide contract', () => {
  it.each([
    ['normal', 'pressed'],
    ['pressed', 'normal'],
    ['grouped', 'groupedPressed'],
    ['groupedPressed', 'grouped'],
  ] as const)('shares iOS content between %s and %s while preserving each stretch point', (edited, paired) => {
    const project = createDefaultTheme();
    const set = project.chat.bubbles.me;
    set[edited].stretchByPlatform = { ios: guides(0.2, 0.1) };
    set[paired].stretchByPlatform = { ios: guides(0.6, 0.3) };
    const nextGuides = guides(0.35, 0.25);

    const next = updateBubbleGuides(project, 'me', edited, 'ios', nextGuides);
    const nextSet = next.chat.bubbles.me;

    expect(nextSet[edited].stretchByPlatform?.ios).toEqual(nextGuides);
    expect(nextSet[paired].stretchByPlatform?.ios?.content).toEqual(nextGuides.content);
    expect(nextSet[paired].stretchByPlatform?.ios?.stretch).toEqual(set[paired].stretchByPlatform?.ios?.stretch);
  });

  it('does not apply iOS pair synchronization to Android guides', () => {
    const project = createDefaultTheme();
    const originalPressed = guides(0.6, 0.3);
    project.chat.bubbles.me.pressed.stretchByPlatform = { android: originalPressed };

    const next = updateBubbleGuides(project, 'me', 'normal', 'android', guides(0.35, 0.25));

    expect(next.chat.bubbles.me.pressed.stretchByPlatform?.android).toEqual(originalPressed);
  });

  it('keeps the untouched paired iOS state on the official baseline after the first edit', () => {
    const project = createDefaultTheme();
    const edited: NinePatchGuides = {
      stretch: { x: [30 / 120, 33 / 120], y: [45 / 105, 48 / 105] },
      content: { left: 15 / 120, top: 12 / 105, right: 90 / 120, bottom: 84 / 105 },
    };

    const next = updateBubbleGuides(project, 'me', 'normal', 'ios', edited);

    expect(next.chat.bubbles.me.normal.stretchByPlatform?.ios).toEqual(edited);
    expect(next.chat.bubbles.me.pressed.stretchByPlatform?.ios?.stretch).toEqual({
      x: [51 / 120, 54 / 120],
      y: [51 / 105, 54 / 105],
    });
    expect(next.chat.bubbles.me.pressed.stretchByPlatform?.ios?.content).toEqual(edited.content);
  });

  it('persists an explicit legacy target edit across a later source edit', () => {
    const project = createDefaultTheme('예전 iOS import', false);
    const id = 'chat.bubble.me.first.normal';
    const imported = { fileName: 'myBubble@3x.png', dataUrl: 'data:image/png;base64,aW9z', width: 120, height: 105, sourceScale: 3 };
    const importedGuides = guides(0.425, 0.275);
    project.resources[id] = { ...imported };
    project.platformResources.ios[id] = { ...imported };
    project.platformResources.android[id] = { fileName: 'android.png', dataUrl: 'data:image/png;base64,YW5kcm9pZA==', width: 122, height: 112, sourceScale: 3 };
    project.chat.bubbles.me.normal.stretch = structuredClone(importedGuides);
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: structuredClone(importedGuides), android: structuredClone(importedGuides) };
    const androidEdit = guides(0.44, 0.16);
    const iosEdit = guides(0.3, 0.2);

    const afterTarget = updateBubbleGuides(project, 'me', 'normal', 'android', androidEdit);
    const afterSource = updateBubbleGuides(afterTarget, 'me', 'normal', 'ios', iosEdit);

    expect(afterTarget.chat.bubbles.me.normal.guideEditedByPlatform).toEqual({ android: true });
    expect(afterSource.chat.bubbles.me.normal.guideEditedByPlatform).toEqual({ android: true, ios: true });
    expect(resolveBubbleGuides(afterSource, 'android', id)).toMatchObject({ source: 'stored-platform', guides: androidEdit });
  });
});
