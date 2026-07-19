import type { NinePatchGuides } from '../ninePatch';
import type {
  BubbleAppearance,
  FontAsset,
  ImageAsset,
  Platform,
  ThemeProject,
} from './model';

export type UnknownRecord = Record<string, unknown>;

export function objectRecord(
  value: unknown,
): UnknownRecord | undefined {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value > 0;
}

export function repairImageAsset(
  value: unknown,
): ImageAsset | undefined {
  const raw = objectRecord(value);
  if (!raw || !nonEmptyString(raw.fileName) || !nonEmptyString(raw.dataUrl)) {
    return undefined;
  }
  const repaired: UnknownRecord = { ...raw };
  for (const key of [
    'width',
    'height',
    'sourceScale',
    'rawNinePatch',
    'userSelected',
    'mirroredFromPlatform',
  ]) {
    delete repaired[key];
  }
  repaired.fileName = raw.fileName;
  repaired.dataUrl = raw.dataUrl;
  if (positiveFiniteNumber(raw.width)) repaired.width = raw.width;
  if (positiveFiniteNumber(raw.height)) repaired.height = raw.height;
  if (positiveFiniteNumber(raw.sourceScale)) {
    repaired.sourceScale = raw.sourceScale;
  }
  if (typeof raw.rawNinePatch === 'boolean') {
    repaired.rawNinePatch = raw.rawNinePatch;
  }
  if (raw.userSelected === true) repaired.userSelected = true;
  if (raw.mirroredFromPlatform === 'ios'
    || raw.mirroredFromPlatform === 'android') {
    repaired.mirroredFromPlatform = raw.mirroredFromPlatform;
  }
  return repaired as unknown as ImageAsset;
}

export function repairImageAssetMap(
  value: unknown,
): {
  valid: Record<string, ImageAsset>;
  unknown: UnknownRecord;
} {
  const valid: Record<string, ImageAsset> = Object.create(null);
  const unknown: UnknownRecord = Object.create(null);
  for (const [key, candidate] of Object.entries(objectRecord(value) ?? {})) {
    const repaired = repairImageAsset(candidate);
    if (repaired) valid[key] = repaired;
    else unknown[key] = candidate;
  }
  return { valid, unknown };
}

export function repairFontAsset(
  value: unknown,
): FontAsset | undefined {
  const raw = objectRecord(value);
  if (
    !raw
    || typeof raw.family !== 'string'
    || !nonEmptyString(raw.fileName)
    || !nonEmptyString(raw.dataUrl)
  ) {
    return undefined;
  }
  return {
    ...raw,
    family: raw.family,
    fileName: raw.fileName,
    dataUrl: raw.dataUrl,
  } as FontAsset;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function numberPair(value: unknown): [number, number] | undefined {
  return Array.isArray(value)
    && value.length === 2
    && finiteNumber(value[0])
    && finiteNumber(value[1])
    ? [value[0], value[1]]
    : undefined;
}

function repairNinePatchGuides(
  value: unknown,
): NinePatchGuides | undefined {
  const raw = objectRecord(value);
  const stretch = objectRecord(raw?.stretch);
  const content = objectRecord(raw?.content);
  const x = numberPair(stretch?.x);
  const y = numberPair(stretch?.y);
  if (
    !raw
    || !stretch
    || !content
    || !x
    || !y
    || !finiteNumber(content.left)
    || !finiteNumber(content.top)
    || !finiteNumber(content.right)
    || !finiteNumber(content.bottom)
  ) {
    return undefined;
  }
  return {
    stretch: { ...stretch, x, y },
    content: {
      ...content,
      left: content.left,
      top: content.top,
      right: content.right,
      bottom: content.bottom,
    },
  };
}

function repairPlatformGuides(
  value: unknown,
): BubbleAppearance['stretchByPlatform'] | undefined {
  const raw = objectRecord(value);
  if (!raw) return undefined;
  const repaired: UnknownRecord = { ...raw };
  delete repaired.ios;
  delete repaired.android;
  for (const platform of ['ios', 'android'] as const) {
    const guides = repairNinePatchGuides(raw[platform]);
    if (guides) repaired[platform] = guides;
  }
  return Object.keys(repaired).length > 0
    ? repaired as BubbleAppearance['stretchByPlatform']
    : undefined;
}

function repairGuideEditedPlatforms(
  value: unknown,
): BubbleAppearance['guideEditedByPlatform'] | undefined {
  const raw = objectRecord(value);
  if (!raw) return undefined;
  const repaired: UnknownRecord = { ...raw };
  delete repaired.ios;
  delete repaired.android;
  for (const platform of ['ios', 'android'] as const) {
    if (raw[platform] === true) repaired[platform] = true;
  }
  return Object.keys(repaired).length > 0
    ? repaired as BubbleAppearance['guideEditedByPlatform']
    : undefined;
}

export function repairBubbleAppearance(
  value: unknown,
  fallback: BubbleAppearance,
): BubbleAppearance {
  const raw = objectRecord(value) ?? {};
  const repaired = {
    ...raw,
    color: typeof raw.color === 'string' ? raw.color : fallback.color,
    textColor: typeof raw.textColor === 'string'
      ? raw.textColor
      : fallback.textColor,
    stretch: repairNinePatchGuides(raw.stretch)
      ?? structuredClone(fallback.stretch),
  } as BubbleAppearance;
  const stretchByPlatform = repairPlatformGuides(raw.stretchByPlatform);
  if (stretchByPlatform) repaired.stretchByPlatform = stretchByPlatform;
  else delete repaired.stretchByPlatform;
  const guideEditedByPlatform = repairGuideEditedPlatforms(
    raw.guideEditedByPlatform,
  );
  if (guideEditedByPlatform) {
    repaired.guideEditedByPlatform = guideEditedByPlatform;
  } else {
    delete repaired.guideEditedByPlatform;
  }
  return repaired;
}

export function repairVisualFill(
  value: unknown,
): ThemeProject['screens'][keyof ThemeProject['screens']]['background']
  | undefined {
  const raw = objectRecord(value);
  if (!raw || typeof raw.color !== 'string') return undefined;
  if (raw.kind === 'color') {
    const { image: _image, ...rest } = raw;
    return {
      ...rest,
      kind: 'color',
      color: raw.color,
    };
  }
  if (raw.kind !== 'image') return undefined;
  const image = repairImageAsset(raw.image);
  if (!image) return undefined;
  return {
    ...raw,
    kind: 'image',
    color: raw.color,
    image,
  };
}

export function repairStringMap(
  value: unknown,
  defaults: Record<string, string>,
): {
  valid: Record<string, string>;
  unknown: UnknownRecord;
} {
  const valid: Record<string, string> = Object.assign(
    Object.create(null),
    defaults,
  );
  const unknown: UnknownRecord = Object.create(null);
  for (const [key, candidate] of Object.entries(objectRecord(value) ?? {})) {
    if (typeof candidate === 'string') valid[key] = candidate;
    else unknown[key] = candidate;
  }
  return { valid, unknown };
}

export function repairPreservedFields(
  value: unknown,
): ThemeProject['__preservedUnknownFields'] {
  const raw = objectRecord(value);
  if (!raw) return undefined;
  const resources = objectRecord(raw.resources);
  const rawPlatformResources = objectRecord(raw.platformResources);
  const rawColorValues = objectRecord(raw.colorValues);
  const result: NonNullable<ThemeProject['__preservedUnknownFields']> = {};
  if (resources) result.resources = { ...resources };
  if (rawPlatformResources) {
    const root = objectRecord(rawPlatformResources.root);
    const ios = objectRecord(rawPlatformResources.ios);
    const android = objectRecord(rawPlatformResources.android);
    result.platformResources = {
      ...(root ? { root: { ...root } } : {}),
      ...(ios ? { ios: { ...ios } } : {}),
      ...(android ? { android: { ...android } } : {}),
    };
  }
  if (rawColorValues) {
    const ios = objectRecord(rawColorValues.ios);
    const android = objectRecord(rawColorValues.android);
    result.colorValues = {
      ...(ios ? { ios: { ...ios } } : {}),
      ...(android ? { android: { ...android } } : {}),
    };
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function mergeUnknownRecords(
  left: UnknownRecord | undefined,
  right: UnknownRecord,
): UnknownRecord | undefined {
  const merged = { ...(left ?? {}), ...right };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export const platforms: readonly Platform[] = ['ios', 'android'];
