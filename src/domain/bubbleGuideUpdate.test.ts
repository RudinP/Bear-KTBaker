import { describe, expect, it } from 'vitest';
import { createDefaultTheme } from './theme';
import type { NinePatchGuides } from './ninePatch';
import { updateBubbleGuides } from './bubbleGuideUpdate';

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
});
