import { describe, expect, it } from 'vitest';
import {
  guidesToAndroidMarkers,
  guidesToIosMetrics,
  moveGuide,
  type NinePatchGuides,
} from './ninePatch';

const guides: NinePatchGuides = {
  stretch: { x: [0.4, 0.6], y: [0.35, 0.65] },
  content: { left: 0.18, top: 0.12, right: 0.86, bottom: 0.9 },
};

describe('nine-patch guide conversion', () => {
  it('converts normalized drag guides to Android border marker pixels', () => {
    expect(guidesToAndroidMarkers(guides, 120, 105)).toEqual({
      stretchX: [48, 72],
      stretchY: [37, 68],
      contentX: [22, 103],
      contentY: [13, 94],
    });
  });

  it('converts 3x bubble guides to iOS stretch and content metrics', () => {
    expect(guidesToIosMetrics(guides, 120, 105, 3)).toEqual({
      stretchPoint: [16, 12],
      edgeInsets: [4, 7, 4, 6],
    });
  });

  it('keeps a dragged guide inside the image and before its partner', () => {
    expect(moveGuide([0.4, 0.6], 0, 0.9)).toEqual([0.59, 0.6]);
    const clampedEnd = moveGuide([0.4, 0.6], 1, -0.2);
    expect(clampedEnd[0]).toBe(0.4);
    expect(clampedEnd[1]).toBeCloseTo(0.41, 12);
    expect(moveGuide([0.4, 0.6], 0, -1)).toEqual([0, 0.6]);
  });

  it('preserves an exact edited Android pixel through normalized storage and export', () => {
    const stretchX = moveGuide([54 / 122, 60 / 122], 1, 56 / 122);
    const edited: NinePatchGuides = {
      ...guides,
      stretch: { ...guides.stretch, x: stretchX },
    };

    expect(stretchX[1]).toBe(56 / 122);
    expect(guidesToAndroidMarkers(edited, 122, 112).stretchX).toEqual([54, 56]);
  });

  it('allows adjacent source-pixel guides on large custom bubble images', () => {
    const moved = moveGuide([54 / 300, 56 / 300], 0, 55 / 300, 1 / 300);

    expect(moved[0]).toBe(55 / 300);
    expect(moved[1]).toBe(56 / 300);
  });
});
