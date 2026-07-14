import { useLayoutEffect, useRef, useState } from 'react';
import type { NinePatchGuides } from '../domain/ninePatch';
import type { Size } from '../preview/layout';
import { iosInsetGeometry } from '../preview/ninePatchStyle';
import { calculateNineSlice, singleLineLabelPlacement } from '../preview/nineSlice';

interface LabelPlacementState {
  x: number;
  y: number;
  frameCenterX?: number;
  frameCenterY?: number;
}

const INITIAL_PLACEMENT: LabelPlacementState = { x: 0, y: 0 };

function samePlacement(left: LabelPlacementState, right: LabelPlacementState) {
  return Math.abs(left.x - right.x) < 0.001
    && Math.abs(left.y - right.y) < 0.001
    && Math.abs((left.frameCenterX ?? 0) - (right.frameCenterX ?? 0)) < 0.001
    && Math.abs((left.frameCenterY ?? 0) - (right.frameCenterY ?? 0)) < 0.001;
}

export function IosBubbleLabel({ children, className, guides, sourceSize, sourceScale }: {
  children: React.ReactNode;
  className: string;
  guides: NinePatchGuides;
  sourceSize: Size;
  sourceScale: number;
}) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [placement, setPlacement] = useState<LabelPlacementState>(INITIAL_PLACEMENT);

  useLayoutEffect(() => {
    const label = labelRef.current;
    const bubble = label?.parentElement;
    if (!label || !bubble) return;
    const geometry = iosInsetGeometry(guides, sourceSize, sourceScale);

    const update = () => {
      const target = { width: bubble.clientWidth, height: bubble.clientHeight };
      const labelRect = {
        x: label.offsetLeft,
        y: label.offsetTop,
        width: label.offsetWidth,
        height: label.offsetHeight,
      };
      if (target.width <= 0 || target.height <= 0 || labelRect.width <= 0 || labelRect.height <= 0) return;
      const layout = calculateNineSlice(geometry.guides, sourceSize, geometry.scale, target);
      const next = singleLineLabelPlacement(layout, geometry.guides, labelRect);
      const state = {
        x: next.translate.x,
        y: next.translate.y,
        frameCenterX: next.contentFrame.x + next.contentFrame.width / 2,
        frameCenterY: next.contentFrame.y + next.contentFrame.height / 2,
      };
      setPlacement((current) => samePlacement(current, state) ? current : state);
    };

    update();
    if (!('ResizeObserver' in window)) return;
    const observer = new ResizeObserver(update);
    observer.observe(bubble);
    observer.observe(label);
    return () => observer.disconnect();
  }, [guides, sourceScale, sourceSize.height, sourceSize.width]);

  return <span
    ref={labelRef}
    className={className}
    data-content-mode="single-line"
    data-ios-label-placement="mapped-nine-slice"
    data-ios-content-center-x={placement.frameCenterX}
    data-ios-content-center-y={placement.frameCenterY}
    style={{ transform: `translate(${placement.x}px, ${placement.y}px)` }}
  >{children}</span>;
}
