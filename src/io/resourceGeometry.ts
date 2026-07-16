import type { Platform } from '../domain/theme';

interface PixelSize {
  width: number;
  height: number;
}

export function pngDimensionsFromDataUrl(dataUrl: string): PixelSize | undefined {
  if (!/^data:image\/png;base64,/i.test(dataUrl)) return undefined;
  try {
    const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    if (binary.length < 24 || binary.charCodeAt(0) !== 137 || binary.slice(1, 4) !== 'PNG') return undefined;
    const value = (offset: number) => (
      binary.charCodeAt(offset) * 0x1000000
      + binary.charCodeAt(offset + 1) * 0x10000
      + binary.charCodeAt(offset + 2) * 0x100
      + binary.charCodeAt(offset + 3)
    );
    return { width: value(16), height: value(20) };
  } catch {
    return undefined;
  }
}

export function uploadSourceScale(platform: Platform, resourceId: string, fileName: string) {
  const iosSuffix = fileName.match(/@(1|2|3)x(?=\.[^.]+$)/i)?.[1];
  if (platform === 'ios') return iosSuffix ? Number(iosSuffix) : 3;
  if (resourceId === 'main.tab.background') return 4;
  return 3;
}

export function sourceHasNinePatchBorder(rawNinePatch: boolean | undefined, fileName: string) {
  return rawNinePatch ?? /\.9\.png$/i.test(fileName);
}

export function flexibleBubbleTargetSize(
  platform: Platform,
  targetPath: string,
  source: PixelSize,
  sourceScale: number,
  sourceIsNinePatch: boolean,
  mirroredFromPlatform?: Platform,
): PixelSize {
  const contentWidth = Math.max(1, source.width - (sourceIsNinePatch ? 2 : 0));
  const contentHeight = Math.max(1, source.height - (sourceIsNinePatch ? 2 : 0));
  if (platform === 'android' && mirroredFromPlatform === 'ios') {
    const logicalScale = sourceScale > 0 ? sourceScale : 3;
    return {
      width: Math.max(1, Math.round((contentWidth / logicalScale) * 3)),
      height: Math.max(1, Math.round((contentHeight / logicalScale) * 3)),
    };
  }
  if (platform === 'android') return { width: contentWidth, height: contentHeight };
  const targetScale = /@2x\.png$/i.test(targetPath) ? 2 : 3;
  return {
    width: Math.max(1, Math.round((contentWidth / sourceScale) * targetScale)),
    height: Math.max(1, Math.round((contentHeight / sourceScale) * targetScale)),
  };
}
