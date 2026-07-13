import { useEffect, useRef, useState } from 'react';
import type { NinePatchGuides } from '../domain/ninePatch';
import type { Size } from '../preview/layout';
import { calculateNineSlice } from '../preview/nineSlice';

export function NineSliceImage({ image, guides, sourceSize, sourceScale, targetSize, className = '', renderer = 'nine-slice' }: {
  image: string;
  guides: NinePatchGuides;
  sourceSize: Size;
  sourceScale: number;
  targetSize?: Size;
  className?: string;
  renderer?: 'nine-slice' | 'android-nine-patch' | 'poster-nine-slice';
}) {
  const layer = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sourceImage = useRef<HTMLImageElement>(null);
  const [imageRevision, setImageRevision] = useState(0);
  const [measured, setMeasured] = useState<Size>(targetSize ?? {
    width: sourceSize.width / sourceScale,
    height: sourceSize.height / sourceScale,
  });

  useEffect(() => {
    if (targetSize) {
      setMeasured(targetSize);
      return;
    }
    const element = layer.current;
    if (!element) return;
    const update = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      if (width > 0 && height > 0) setMeasured({ width, height });
    };
    update();
    if (!('ResizeObserver' in window)) return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [targetSize]);

  const layout = calculateNineSlice(guides, sourceSize, sourceScale, measured);
  const seamOverlap = 0;

  useEffect(() => {
    const target = canvas.current;
    const source = sourceImage.current;
    if (!target || !source?.complete || !source.naturalWidth || !source.naturalHeight) return;
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    target.width = Math.max(1, Math.round(layout.target.width * pixelRatio));
    target.height = Math.max(1, Math.round(layout.target.height * pixelRatio));
    const context = target.getContext('2d');
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, layout.target.width, layout.target.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    for (const cell of layout.cells) {
      if (cell.source.width <= 0 || cell.source.height <= 0 || cell.target.width <= 0 || cell.target.height <= 0) continue;
      context.drawImage(
        source,
        cell.source.x,
        cell.source.y,
        cell.source.width,
        cell.source.height,
        cell.target.x,
        cell.target.y,
        cell.target.width,
        cell.target.height,
      );
    }
  }, [imageRevision, layout]);

  const center = layout.cells[4].target;
  return <span ref={layer} className={`kt-nine-slice ${className}`.trim()} data-renderer={renderer} data-seam-overlap={seamOverlap} aria-hidden="true">
    <img ref={sourceImage} className="kt-nine-slice-source" src={image} alt="" onLoad={() => setImageRevision((revision) => revision + 1)} />
    <canvas ref={canvas} className="kt-nine-slice-canvas" data-source-image={image}
      data-target-width={layout.target.width} data-target-height={layout.target.height}
      data-center-width={center.width} data-center-height={center.height} />
  </span>;
}
