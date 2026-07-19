import type { ImageAsset } from '../domain/theme/model';
import type { ResourceRenderMode } from '../manifest/kakaoResources';

export type AssetScaleContext = 'ios' | 'android' | 'android-tab';

export interface ImageSourceGeometry {
  width: number;
  height: number;
  scale: number;
}

export interface ImageSurfaceGeometry {
  width: number;
  height: number;
}

export interface ImagePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

const rounded = (value: number) => Math.round(value * 10_000) / 10_000;

export function resolveAssetScale(
  asset: Pick<ImageAsset, 'fileName' | 'sourceScale'>,
  context: AssetScaleContext,
) {
  if (asset.sourceScale && asset.sourceScale > 0) return asset.sourceScale;
  const suffix = asset.fileName.match(/@(\d+)x(?=\.[^.]+$)/i)?.[1];
  if (suffix) return Number(suffix);
  if (context === 'android-tab') return 4;
  return context === 'android' || context === 'ios' ? 3 : 1;
}

export function calculateImagePlacement(
  source: ImageSourceGeometry,
  surface: ImageSurfaceGeometry,
  mode: ResourceRenderMode,
): ImagePlacement {
  const logicalWidth = source.width / source.scale;
  const logicalHeight = source.height / source.scale;

  if (mode === 'stretch') return { x: 0, y: 0, width: surface.width, height: surface.height };

  let scale = 1;
  if (mode === 'top-center-crop') {
    scale = surface.width / logicalWidth;
  } else if (mode === 'contain') {
    scale = Math.min(surface.width / logicalWidth, surface.height / logicalHeight);
  } else {
    scale = Math.max(surface.width / logicalWidth, surface.height / logicalHeight);
  }

  const width = rounded(logicalWidth * scale);
  const height = rounded(logicalHeight * scale);
  return {
    x: rounded((surface.width - width) / 2),
    y: mode === 'top-center-crop' || mode === 'top-center-cover' ? 0 : rounded((surface.height - height) / 2),
    width,
    height,
  };
}

export function placementBackgroundStyle(placement: ImagePlacement): React.CSSProperties {
  return {
    backgroundPosition: `${placement.x}px ${placement.y}px`,
    backgroundSize: `${placement.width}px ${placement.height}px`,
    backgroundRepeat: 'no-repeat',
  };
}
