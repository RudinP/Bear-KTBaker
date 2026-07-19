import type { ImageAsset, Platform, ThemeProject } from '../domain/theme/model';
import type { NinePatchGuides } from '../domain/ninePatch';

function sameAsset(left: ImageAsset, right: ImageAsset) {
  return left.fileName === right.fileName
    && left.dataUrl === right.dataUrl
    && left.width === right.width
    && left.height === right.height
    && left.sourceScale === right.sourceScale
    && left.rawNinePatch === right.rawNinePatch
    && left.userSelected === right.userSelected
    && left.mirroredFromPlatform === right.mirroredFromPlatform;
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

function bubbleAppearance(project: ThemeProject, resourceId: string) {
  const match = resourceId.match(/^chat\.bubble\.(me|you)\.(first|grouped)\.(normal|pressed)$/);
  if (!match) return undefined;
  const [, side, sequence, state] = match as [string, 'me' | 'you', 'first' | 'grouped', 'normal' | 'pressed'];
  const variant = sequence === 'grouped'
    ? (state === 'pressed' ? 'groupedPressed' : 'grouped')
    : state;
  return project.chat.bubbles[side][variant];
}

function inferredSource(asset: ImageAsset): Platform | undefined {
  const fileName = asset.fileName.split(/[\\/]/).pop() ?? asset.fileName;
  const scaleSuffix = fileName.match(/@([123])x(?=\.[^.]+$)/i)?.[1];
  const canonicalAndroid = /^theme_chatroom_bubble_(?:me|you)_0[12]_image(?:\.9)?\.png$/i.test(fileName);
  const androidFormat = asset.rawNinePatch === true || /\.9\.png$/i.test(fileName);
  // Import has recorded this invariant since schema v1: suffixless iOS is 1x,
  // while mapped Android chat bubbles use the canonical resource name at 3x.
  const ios = asset.sourceScale === 1
    || (scaleSuffix !== undefined && Number(scaleSuffix) === asset.sourceScale)
    || (asset.sourceScale !== undefined && !canonicalAndroid && !androidFormat);
  const android = asset.sourceScale === 3 && (canonicalAndroid || androidFormat);
  if (ios === android) return undefined;
  return ios ? 'ios' : 'android';
}

function legacyMirrorContext(project: ThemeProject, resourceId: string) {
  if (project.baseSample !== undefined) return undefined;
  if (!bubbleAppearance(project, resourceId)) return undefined;
  const shared = project.resources?.[resourceId];
  if (!shared) return undefined;
  const source = inferredSource(shared);
  if (!source) return undefined;
  return { shared, source };
}

function legacyGuideContext(project: ThemeProject, resourceId: string) {
  const context = legacyMirrorContext(project, resourceId);
  if (!context) return undefined;
  const appearance = bubbleAppearance(project, resourceId);
  const target: Platform = context.source === 'ios' ? 'android' : 'ios';
  const sourceGuides = appearance?.stretchByPlatform?.[context.source];
  const targetGuides = appearance?.stretchByPlatform?.[target];
  if (!appearance || !sourceGuides || !targetGuides) return undefined;
  return {
    ...context,
    appearance,
    target,
    sharedMatchesSource: sameGuides(appearance.stretch, sourceGuides),
    sharedMatchesTarget: sameGuides(appearance.stretch, targetGuides),
  };
}

/** Returns a target edit inferred from a pre-marker legacy project. */
export function legacyExplicitBubbleGuidePlatform(project: ThemeProject, resourceId: string): Platform | undefined {
  const context = legacyGuideContext(project, resourceId);
  if (!context) return undefined;
  if (context.appearance.guideEditedByPlatform?.[context.target]) return context.target;
  return context.sharedMatchesTarget && !context.sharedMatchesSource ? context.target : undefined;
}

/** Detects copied guides independently from a later target-asset replacement. */
export function legacyMirroredBubbleGuideSource(project: ThemeProject, resourceId: string): Platform | undefined {
  const context = legacyGuideContext(project, resourceId);
  if (!context || context.appearance.guideEditedByPlatform?.[context.target]) return undefined;
  // updateBubbleGuides writes `stretch` together with the platform last edited.
  // A target-only edit is therefore explicit; untouched or source-last values
  // still identify the other platform's old automatic copy.
  if (context.sharedMatchesTarget && !context.sharedMatchesSource) return undefined;
  return context.sharedMatchesSource ? context.source : undefined;
}

/**
 * Detects the exact asset copies produced by the old theme-import mirror.
 * It never mutates saved data and leaves ambiguous or edited targets alone.
 */
export function legacyMirroredBubbleAssetSource(project: ThemeProject, resourceId: string): Platform | undefined {
  const context = legacyMirrorContext(project, resourceId);
  if (!context) return undefined;
  const target = project.platformResources[context.source === 'ios' ? 'android' : 'ios']?.[resourceId];
  if (!target || target.userSelected || !sameAsset(context.shared, target)) return undefined;
  return context.source;
}

export function shouldIgnoreLegacyMirroredBubbleAssetTarget(
  project: ThemeProject,
  platform: Platform,
  resourceId: string,
) {
  const source = legacyMirroredBubbleAssetSource(project, resourceId);
  return source !== undefined && source !== platform;
}

export function shouldIgnoreLegacyMirroredBubbleGuideTarget(
  project: ThemeProject,
  platform: Platform,
  resourceId: string,
) {
  const source = legacyMirroredBubbleGuideSource(project, resourceId);
  return source !== undefined && source !== platform;
}
