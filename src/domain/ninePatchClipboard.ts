import type { NinePatchGuides } from './ninePatch';

export type NinePatchClipboardScope = 'stretch' | 'content' | 'all';
export type NinePatchClipboardPlatform = 'ios' | 'android';
export type NinePatchSourceSize = { width: number; height: number };

type PixelGuides = {
  stretch: { x: [number, number]; y: [number, number] };
  content: { left: number; top: number; right: number; bottom: number };
};

type ClipboardPayload = { sourceSize: NinePatchSourceSize; pixels: PixelGuides };

const clipboard = new Map<string, ClipboardPayload>();
const clipboardKey = (platform: NinePatchClipboardPlatform, scope: NinePatchClipboardScope) => `${platform}:${scope}`;

const toPixels = (guides: NinePatchGuides, size: NinePatchSourceSize): PixelGuides => ({
  stretch: {
    x: guides.stretch.x.map((value) => Math.round(value * size.width)) as [number, number],
    y: guides.stretch.y.map((value) => Math.round(value * size.height)) as [number, number],
  },
  content: {
    left: Math.round(guides.content.left * size.width),
    top: Math.round(guides.content.top * size.height),
    right: Math.round(guides.content.right * size.width),
    bottom: Math.round(guides.content.bottom * size.height),
  },
});

const scaledPixel = (value: number, sourceLength: number, targetLength: number) => (
  sourceLength === targetLength ? value : Math.round((value / sourceLength) * targetLength)
);

const normalizedPair = (values: [number, number], sourceLength: number, targetLength: number): [number, number] => {
  const start = Math.max(0, Math.min(targetLength - 1, scaledPixel(values[0], sourceLength, targetLength)));
  const end = Math.max(start + 1, Math.min(targetLength, scaledPixel(values[1], sourceLength, targetLength)));
  return [start / targetLength, end / targetLength];
};

const scaledContent = (payload: ClipboardPayload, target: NinePatchSourceSize): NinePatchGuides['content'] => {
  const left = Math.max(0, Math.min(target.width - 1, scaledPixel(payload.pixels.content.left, payload.sourceSize.width, target.width)));
  const right = Math.max(left + 1, Math.min(target.width, scaledPixel(payload.pixels.content.right, payload.sourceSize.width, target.width)));
  const top = Math.max(0, Math.min(target.height - 1, scaledPixel(payload.pixels.content.top, payload.sourceSize.height, target.height)));
  const bottom = Math.max(top + 1, Math.min(target.height, scaledPixel(payload.pixels.content.bottom, payload.sourceSize.height, target.height)));
  return { left: left / target.width, top: top / target.height, right: right / target.width, bottom: bottom / target.height };
};

export function copyNinePatchGuides(platform: NinePatchClipboardPlatform, scope: NinePatchClipboardScope, guides: NinePatchGuides, sourceSize: NinePatchSourceSize) {
  clipboard.set(clipboardKey(platform, scope), { sourceSize: { ...sourceSize }, pixels: toPixels(guides, sourceSize) });
}

export function hasNinePatchClipboard(platform: NinePatchClipboardPlatform, scope: NinePatchClipboardScope) {
  return clipboard.has(clipboardKey(platform, scope));
}

export function pasteNinePatchGuides(
  platform: NinePatchClipboardPlatform,
  scope: NinePatchClipboardScope,
  current: NinePatchGuides,
  targetSize: NinePatchSourceSize,
): NinePatchGuides | undefined {
  const payload = clipboard.get(clipboardKey(platform, scope));
  if (!payload) return undefined;
  const stretch = {
    x: normalizedPair(payload.pixels.stretch.x, payload.sourceSize.width, targetSize.width),
    y: normalizedPair(payload.pixels.stretch.y, payload.sourceSize.height, targetSize.height),
  };
  const content = scaledContent(payload, targetSize);
  if (scope === 'stretch') return { ...current, stretch };
  if (scope === 'content') return { ...current, content };
  return { stretch, content };
}

export function clearNinePatchClipboard() {
  clipboard.clear();
}
