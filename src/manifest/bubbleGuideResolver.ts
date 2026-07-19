import { DEFAULT_NINE_PATCH, guidesToIosMetrics, type NinePatchGuides } from '../domain/ninePatch';
import type { BubbleAppearance, Platform, ThemeProject } from '../domain/theme/model';
import { shouldIgnoreLegacyMirroredBubbleGuideTarget } from './bubblePlatformIsolation';
import { getResourceSlot } from './kakaoResources';
import { resolveResourceAsset } from './resourceResolver';

export type BubbleSide = 'me' | 'you';

export interface ResolvedBubbleGuides {
  appearance: BubbleAppearance;
  guides: NinePatchGuides;
  side: BubbleSide;
  source: 'stored-platform' | 'custom-legacy' | 'official-sample';
}

const ANDROID_SAMPLE_GUIDES: Record<BubbleSide, NinePatchGuides> = {
  me: {
    stretch: { x: [54 / 122, 56 / 122], y: [55 / 112, 57 / 112] },
    content: { left: 20 / 122, top: 12 / 112, right: 92 / 122, bottom: 100 / 112 },
  },
  you: {
    stretch: { x: [66 / 122, 68 / 122], y: [55 / 112, 57 / 112] },
    content: { left: 30 / 122, top: 12 / 112, right: 102 / 122, bottom: 100 / 112 },
  },
};

function iosGuidesFromMetrics(
  width: number,
  height: number,
  scale: 1 | 2 | 3,
  stretchPoint: readonly [number, number],
  edgeInsets: readonly [number, number, number, number],
): NinePatchGuides {
  const [top, left, bottom, right] = edgeInsets;
  const [x, y] = stretchPoint;
  return {
    stretch: {
      x: [(x * scale) / width, ((x + 1) * scale) / width],
      y: [(y * scale) / height, ((y + 1) * scale) / height],
    },
    content: {
      left: (left * scale) / width,
      top: (top * scale) / height,
      right: (width - right * scale) / width,
      bottom: (height - bottom * scale) / height,
    },
  };
}

function sameGuides(left: NinePatchGuides, right: NinePatchGuides) {
  return left.stretch.x[0] === right.stretch.x[0]
    && left.stretch.x[1] === right.stretch.x[1]
    && left.stretch.y[0] === right.stretch.y[0]
    && left.stretch.y[1] === right.stretch.y[1]
    && left.content.left === right.content.left
    && left.content.top === right.content.top
    && left.content.right === right.content.right
    && left.content.bottom === right.content.bottom;
}

function bubbleParts(resourceId: string) {
  const match = resourceId.match(/^chat\.bubble\.(me|you)\.(first|grouped)\.(normal|pressed)$/);
  if (!match) throw new Error(`Unknown bubble resource: ${resourceId}`);
  const [, side, sequence, state] = match as [string, BubbleSide, 'first' | 'grouped', 'normal' | 'pressed'];
  const variant = sequence === 'grouped'
    ? (state === 'pressed' ? 'groupedPressed' : 'grouped')
    : state;
  return { side, state, variant } as const;
}

export function officialSampleBubbleGuides(platform: Platform, side: BubbleSide, pressed = false) {
  if (platform === 'android') return ANDROID_SAMPLE_GUIDES[side];
  const resourceId = `chat.bubble.${side}.first.${pressed ? 'pressed' : 'normal'}`;
  const slot = getResourceSlot(resourceId);
  const binding = slot.ios;
  const size = binding?.sampleContentSize ?? binding?.samplePixelSize ?? [120, 105];
  const stretchPoint = slot.render.iosStretchPoint;
  const edgeInsets = slot.render.iosContentInsets;
  if (!stretchPoint || !edgeInsets) throw new Error(`Official iOS bubble metrics are missing for ${resourceId}`);
  return iosGuidesFromMetrics(size[0], size[1], 3, stretchPoint, edgeInsets);
}

export function resolveBubbleGuides(
  project: ThemeProject,
  platform: Platform,
  resourceId: string,
): ResolvedBubbleGuides {
  const { side, state, variant } = bubbleParts(resourceId);
  const appearance = project.chat.bubbles[side][variant];
  const stored = shouldIgnoreLegacyMirroredBubbleGuideTarget(project, platform, resourceId)
    ? undefined
    : appearance.stretchByPlatform?.[platform];
  if (stored) return { appearance, guides: stored, side, source: 'stored-platform' };
  const otherPlatform = platform === 'ios' ? 'android' : 'ios';
  const belongsOnlyToLegacySharedStorage = !appearance.stretchByPlatform?.[otherPlatform]
    && !sameGuides(appearance.stretch, DEFAULT_NINE_PATCH);
  if (belongsOnlyToLegacySharedStorage) {
    return { appearance, guides: appearance.stretch, side, source: 'custom-legacy' };
  }
  return {
    appearance,
    guides: officialSampleBubbleGuides(platform, side, state === 'pressed'),
    side,
    source: 'official-sample',
  };
}

export function resolveIosBubbleMetrics(project: ThemeProject, resourceId: string) {
  const resolved = resolveBubbleGuides(project, 'ios', resourceId);
  const asset = resolveResourceAsset(project, 'ios', resourceId);
  const binding = getResourceSlot(resourceId).ios;
  const sampleSize = binding?.sampleContentSize ?? binding?.samplePixelSize ?? [120, 105];
  const width = asset?.width ?? sampleSize[0];
  const height = asset?.height ?? sampleSize[1];
  const suffixScale = asset?.fileName.match(/@(1|2|3)x(?=\.[^.]+$)/i)?.[1];
  const scale = (asset?.sourceScale === 1 || asset?.sourceScale === 2 || asset?.sourceScale === 3
    ? asset.sourceScale
    : suffixScale ? Number(suffixScale) : 3) as 1 | 2 | 3;
  return {
    ...resolved,
    width,
    height,
    scale,
    metrics: guidesToIosMetrics(resolved.guides, width, height, scale),
  };
}
