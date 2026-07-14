import { describe, expect, it } from 'vitest';
import { iosInsetGeometry, ninePatchBorderStyle, officialSampleBubbleGuides } from './ninePatchStyle';

describe('nine-patch preview style', () => {
  it('keeps fixed edges and stretches only the marker-defined center', () => {
    const style = ninePatchBorderStyle('bubble.png', { stretch: { x: [54 / 122, 56 / 122], y: [55 / 112, 57 / 112] }, content: { left: 0, top: 0, right: 1, bottom: 1 } }, 122, 112, 3);
    expect(style.borderImageSlice).toBe('55 66 55 54 fill');
    expect(style.borderWidth).toBe('18.333333333333332px 22px 18.333333333333332px 18px');
    expect(style.backgroundColor).toBe('transparent');
  });

  it('treats one iOS point as three source pixels in the @3x sample bubble', () => {
    const guides = officialSampleBubbleGuides('ios', 'you');
    const style = ninePatchBorderStyle('receive.png', guides, 120, 105, 3);

    expect(guides.stretch.x).toEqual([66 / 120, 69 / 120]);
    expect(guides.content).toEqual({ left: 51 / 120, top: 30 / 105, right: 87 / 120, bottom: 84 / 105 });
    expect(style.borderImageSlice).toBe('51 51 51 66 fill');
    expect(style.borderWidth).toBe('17px 17px 17px 22px');
  });

  it('normalizes the one-pixel-wider iOS pressed receive image against 121px', () => {
    const guides = officialSampleBubbleGuides('ios', 'you', true);
    expect(guides.stretch.x).toEqual([66 / 121, 69 / 121]);
    expect(guides.content.left).toBe(51 / 121);
    expect(guides.content.right).toBe(88 / 121);
  });

  it('treats the iOS stretch coordinate as one logical point even when a stale range end is wider', () => {
    const style = ninePatchBorderStyle('bubble.png', {
      stretch: { x: [51 / 120, 90 / 120], y: [51 / 105, 90 / 105] },
      content: { left: 33 / 120, top: 30 / 105, right: 69 / 120, bottom: 84 / 105 },
    }, 120, 105, 3, 'ios');

    expect(style.borderImageSlice).toBe('51 66 51 51 fill');
  });

  it('uses the same integer-point quantization as the exported iOS CSS', () => {
    const geometry = iosInsetGeometry({
      stretch: { x: [50 / 120, 90 / 120], y: [52 / 105, 90 / 105] },
      content: { left: 32 / 120, top: 31 / 105, right: 70 / 120, bottom: 83 / 105 },
    }, { width: 120, height: 105 }, 3);

    expect(geometry.guides).toEqual({
      stretch: { x: [48 / 120, 51 / 120], y: [51 / 105, 54 / 105] },
      content: { left: 33 / 120, top: 30 / 105, right: 69 / 120, bottom: 84 / 105 },
    });
    expect(geometry.minimumSize).toEqual({ width: 40, height: 35 });
  });

  it('preserves suffixless imported iOS artwork at its authored 1x scale', () => {
    const guides = {
      stretch: { x: [17 / 40, 18 / 40] as [number, number], y: [17 / 35, 18 / 35] as [number, number] },
      content: { left: 11 / 40, top: 10 / 35, right: 23 / 40, bottom: 28 / 35 },
    };

    const geometry = iosInsetGeometry(guides, { width: 40, height: 35 }, 1);

    expect(geometry.scale).toBe(1);
    expect(geometry.guides).toEqual(guides);
    expect(geometry.minimumSize).toEqual({ width: 40, height: 35 });
  });
});
