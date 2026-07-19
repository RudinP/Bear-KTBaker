import type { NinePatchGuides } from './ninePatch';
import type { Platform, ThemeProject } from './theme/model';
import { resolveBubbleGuides } from '../manifest/bubbleGuideResolver';
import { legacyExplicitBubbleGuidePlatform } from '../manifest/bubblePlatformIsolation';

export type BubbleVariant = 'normal' | 'pressed' | 'grouped' | 'groupedPressed';

const pairedVariant: Record<BubbleVariant, BubbleVariant> = {
  normal: 'pressed',
  pressed: 'normal',
  grouped: 'groupedPressed',
  groupedPressed: 'grouped',
};

function bubbleResourceId(side: 'me' | 'you', variant: BubbleVariant) {
  const sequence = variant === 'grouped' || variant === 'groupedPressed' ? 'grouped' : 'first';
  const state = variant === 'pressed' || variant === 'groupedPressed' ? 'pressed' : 'normal';
  return `chat.bubble.${side}.${sequence}.${state}`;
}

function copyGuides(guides: NinePatchGuides): NinePatchGuides {
  return {
    stretch: { x: [...guides.stretch.x], y: [...guides.stretch.y] },
    content: { ...guides.content },
  };
}

function editMarkers(project: ThemeProject, side: 'me' | 'you', variant: BubbleVariant, platform: Platform) {
  const appearance = project.chat.bubbles[side][variant];
  const inferred = legacyExplicitBubbleGuidePlatform(project, bubbleResourceId(side, variant));
  return {
    ...appearance.guideEditedByPlatform,
    ...(inferred ? { [inferred]: true as const } : {}),
    [platform]: true as const,
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
      guideEditedByPlatform: editMarkers(project, side, variant, platform),
    },
  };

  if (platform === 'ios') {
    const pair = pairedVariant[variant];
    const pairedAppearance = set[pair];
    const pairedGuides = copyGuides(resolveBubbleGuides(project, 'ios', bubbleResourceId(side, pair)).guides);
    pairedGuides.content = { ...guides.content };
    nextSet[pair] = {
      ...pairedAppearance,
      stretchByPlatform: { ...pairedAppearance.stretchByPlatform, ios: pairedGuides },
      guideEditedByPlatform: editMarkers(project, side, pair, 'ios'),
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
