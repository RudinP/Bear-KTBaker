import { guidesToIosMetrics, type NinePatchGuides } from '../domain/ninePatch';
import type { Size } from './layout';

export { officialSampleBubbleGuides } from '../manifest/bubbleGuideResolver';
export type { BubbleSide } from '../manifest/bubbleGuideResolver';

function iosExportScale(sourceScale: number): 1 | 2 | 3 {
  if (sourceScale === 1 || sourceScale === 2) return sourceScale;
  return 3;
}

function iosOnePointRange(point: number, sourceScale: 1 | 2 | 3): [number, number] {
  const start = point * sourceScale;
  return [start, start + sourceScale];
}

export function iosInsetGeometry(guides: NinePatchGuides, source: Size, sourceScale: number) {
  const scale = iosExportScale(sourceScale);
  const metrics = guidesToIosMetrics(guides, source.width, source.height, scale);
  const x = iosOnePointRange(metrics.stretchPoint[0], scale);
  const y = iosOnePointRange(metrics.stretchPoint[1], scale);
  const [top, left, bottom, right] = metrics.edgeInsets;
  const normalizedGuides: NinePatchGuides = {
    stretch: {
      x: [x[0] / source.width, x[1] / source.width],
      y: [y[0] / source.height, y[1] / source.height],
    },
    content: {
      left: (left * scale) / source.width,
      top: (top * scale) / source.height,
      right: (source.width - right * scale) / source.width,
      bottom: (source.height - bottom * scale) / source.height,
    },
  };
  return {
    scale,
    guides: normalizedGuides,
    minimumSize: {
      width: (x[0] + scale + (source.width - x[1])) / scale,
      height: (y[0] + scale + (source.height - y[1])) / scale,
    },
  };
}

export function ninePatchBorderStyle(image: string, guides: NinePatchGuides, width: number, height: number, density: number, renderer: 'nine-patch' | 'ios' = 'nine-patch'): React.CSSProperties {
  const iosGeometry = renderer === 'ios' ? iosInsetGeometry(guides, { width, height }, density) : undefined;
  const renderGuides = iosGeometry?.guides ?? guides;
  const renderDensity = iosGeometry?.scale ?? density;
  const top = Math.max(1, Math.round(renderGuides.stretch.y[0] * height));
  const right = Math.max(1, Math.round((1 - renderGuides.stretch.x[1]) * width));
  const bottom = Math.max(1, Math.round((1 - renderGuides.stretch.y[1]) * height));
  const left = Math.max(1, Math.round(renderGuides.stretch.x[0] * width));
  return {
    position: 'absolute',
    inset: 0,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    borderStyle: 'solid',
    borderWidth: `${top / renderDensity}px ${right / renderDensity}px ${bottom / renderDensity}px ${left / renderDensity}px`,
    borderImageSource: `url(${image})`,
    borderImageSlice: `${top} ${right} ${bottom} ${left} fill`,
    borderImageRepeat: 'stretch',
  };
}
