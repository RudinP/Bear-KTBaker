import type { NinePatchGuides } from '../domain/ninePatch';

export type BubbleSide = 'me' | 'you';

const IOS_SAMPLE_GUIDES: Record<BubbleSide, NinePatchGuides> = {
  me: {
    stretch: { x: [51 / 120, 54 / 120], y: [51 / 105, 54 / 105] },
    content: { left: 33 / 120, top: 30 / 105, right: 69 / 120, bottom: 84 / 105 },
  },
  you: {
    stretch: { x: [66 / 120, 69 / 120], y: [51 / 105, 54 / 105] },
    content: { left: 51 / 120, top: 30 / 105, right: 87 / 120, bottom: 84 / 105 },
  },
};

const IOS_PRESSED_RECEIVE_GUIDES: NinePatchGuides = {
  stretch: { x: [66 / 121, 69 / 121], y: [51 / 105, 54 / 105] },
  content: { left: 51 / 121, top: 30 / 105, right: 88 / 121, bottom: 84 / 105 },
};

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

export function officialSampleBubbleGuides(platform: 'ios' | 'android', side: BubbleSide, pressed = false) {
  if (platform === 'ios' && side === 'you' && pressed) return IOS_PRESSED_RECEIVE_GUIDES;
  return platform === 'ios' ? IOS_SAMPLE_GUIDES[side] : ANDROID_SAMPLE_GUIDES[side];
}

export function ninePatchBorderStyle(image: string, guides: NinePatchGuides, width: number, height: number, density: number): React.CSSProperties {
  const top = Math.max(1, Math.round(guides.stretch.y[0] * height));
  const right = Math.max(1, Math.round((1 - guides.stretch.x[1]) * width));
  const bottom = Math.max(1, Math.round((1 - guides.stretch.y[1]) * height));
  const left = Math.max(1, Math.round(guides.stretch.x[0] * width));
  return {
    position: 'absolute',
    inset: 0,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    borderStyle: 'solid',
    borderWidth: `${top / density}px ${right / density}px ${bottom / density}px ${left / density}px`,
    borderImageSource: `url(${image})`,
    borderImageSlice: `${top} ${right} ${bottom} ${left} fill`,
    borderImageRepeat: 'stretch',
  };
}
