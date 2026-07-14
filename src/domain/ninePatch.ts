export interface NinePatchGuides {
  stretch: { x: [number, number]; y: [number, number] };
  content: { left: number; top: number; right: number; bottom: number };
}

export function moveGuide(
  range: [number, number],
  index: 0 | 1,
  nextValue: number,
  minimumGap = 0.01,
): [number, number] {
  const clamped = Math.max(0, Math.min(1, nextValue));
  const result: [number, number] = [...range];
  result[index] =
    index === 0
      ? Math.min(clamped, result[1] - minimumGap)
      : Math.max(clamped, result[0] + minimumGap);
  return result;
}

export function guidesToAndroidMarkers(
  guides: NinePatchGuides,
  width: number,
  height: number,
) {
  return {
    stretchX: [
      Math.round(guides.stretch.x[0] * width),
      Math.floor(guides.stretch.x[1] * width),
    ] as [number, number],
    stretchY: [
      Math.round(guides.stretch.y[0] * height),
      Math.floor(guides.stretch.y[1] * height),
    ] as [number, number],
    contentX: [
      Math.round(guides.content.left * width),
      Math.floor(guides.content.right * width),
    ] as [number, number],
    contentY: [
      Math.round(guides.content.top * height),
      Math.floor(guides.content.bottom * height),
    ] as [number, number],
  };
}

export function guidesToIosMetrics(
  guides: NinePatchGuides,
  width: number,
  height: number,
  scale: 1 | 2 | 3,
) {
  return {
    stretchPoint: [
      Math.floor((guides.stretch.x[0] * width) / scale),
      Math.floor((guides.stretch.y[0] * height) / scale),
    ] as [number, number],
    edgeInsets: [
      Math.round((guides.content.top * height) / scale),
      Math.round((guides.content.left * width) / scale),
      Math.round((height - guides.content.bottom * height) / scale),
      Math.round((width - guides.content.right * width) / scale),
    ] as [number, number, number, number],
  };
}

export const DEFAULT_NINE_PATCH: NinePatchGuides = {
  stretch: { x: [0.42, 0.58], y: [0.4, 0.6] },
  content: { left: 0.16, top: 0.12, right: 0.84, bottom: 0.88 },
};
