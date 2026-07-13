import type { NinePatchGuides } from './ninePatch';
import type { Platform, ThemeProject } from './theme';

export type BubbleVariant = 'normal' | 'pressed' | 'grouped' | 'groupedPressed';

const pairedVariant: Record<BubbleVariant, BubbleVariant> = {
  normal: 'pressed',
  pressed: 'normal',
  grouped: 'groupedPressed',
  groupedPressed: 'grouped',
};

function copyGuides(guides: NinePatchGuides): NinePatchGuides {
  return {
    stretch: { x: [...guides.stretch.x], y: [...guides.stretch.y] },
    content: { ...guides.content },
  };
}

export function updateBubbleGuides(
  project: ThemeProject,
  side: 'me' | 'you',
  variant: BubbleVariant,
  platform: Platform,
  guides: NinePatchGuides,
): ThemeProject {
  const set = project.chat.bubbles[side];
  const appearance = set[variant];
  const nextGuides = copyGuides(guides);
  const nextSet = {
    ...set,
    [variant]: {
      ...appearance,
      stretch: nextGuides,
      stretchByPlatform: { ...appearance.stretchByPlatform, [platform]: nextGuides },
    },
  };

  if (platform === 'ios') {
    const pair = pairedVariant[variant];
    const pairedAppearance = set[pair];
    const pairedGuides = copyGuides(pairedAppearance.stretchByPlatform?.ios ?? pairedAppearance.stretch);
    pairedGuides.content = { ...guides.content };
    nextSet[pair] = {
      ...pairedAppearance,
      stretchByPlatform: { ...pairedAppearance.stretchByPlatform, ios: pairedGuides },
    };
  }

  return {
    ...project,
    chat: {
      ...project.chat,
      bubbles: { ...project.chat.bubbles, [side]: nextSet },
    },
  };
}
