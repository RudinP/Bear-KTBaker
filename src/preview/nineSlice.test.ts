import { describe, expect, it } from 'vitest';
import { iosInsetGeometry } from './ninePatchStyle';
import { calculateNineSlice, contentInsetsPx } from './nineSlice';

const iosSend = {
  stretch: { x: [51 / 120, 54 / 120] as [number, number], y: [51 / 105, 54 / 105] as [number, number] },
  content: { left: 33 / 120, top: 30 / 105, right: 69 / 120, bottom: 84 / 105 },
};

const androidMe = {
  stretch: { x: [54 / 122, 56 / 122] as [number, number], y: [55 / 112, 57 / 112] as [number, number] },
  content: { left: 20 / 122, top: 12 / 112, right: 92 / 122, bottom: 100 / 112 },
};

describe('nine-slice bubble geometry', () => {
  it('converts the iOS sample content coordinates into CSS point insets', () => {
    expect(contentInsetsPx(iosSend, { width: 120, height: 105 }, 3)).toEqual({
      top: 10, right: 17, bottom: 7, left: 11,
    });
  });

  it('converts Android marker content coordinates independently of stretch markers', () => {
    expect(contentInsetsPx(androidMe, { width: 122, height: 112 }, 3, 'android')).toEqual({
      top: 4, right: 10, bottom: 4, left: 7,
    });
  });

  it('converts the 300×240 custom iOS send bubble into its authored CSS insets', () => {
    const custom = {
      stretch: { x: [99 / 300, 102 / 300] as [number, number], y: [174 / 240, 177 / 240] as [number, number] },
      content: { left: 90 / 300, top: 171 / 240, right: 111 / 300, bottom: 183 / 240 },
    };
    expect(contentInsetsPx(custom, { width: 300, height: 240 }, 3)).toEqual({
      top: 57, right: 63, bottom: 19, left: 30,
    });
  });

  it('keeps corners fixed and assigns all additional size to the stretch row and column', () => {
    const layout = calculateNineSlice(androidMe, { width: 122, height: 112 }, 3, { width: 120, height: 54 });
    const topLeft = layout.cells[0];
    const center = layout.cells[4];
    const bottomRight = layout.cells[8];

    expect(topLeft.target).toEqual({ x: 0, y: 0, width: 18, height: 55 / 3 });
    expect(bottomRight.target.x + bottomRight.target.width).toBeCloseTo(120, 6);
    expect(bottomRight.target.y + bottomRight.target.height).toBeCloseTo(54, 6);
    expect(center.target.width).toBeCloseTo(120 - 18 - 22, 6);
  });

  it('compresses fixed Android caps into the measured view when it is smaller than the source minimum', () => {
    const layout = calculateNineSlice(androidMe, { width: 122, height: 112 }, 3, { width: 58, height: 32 });
    const bottomRight = layout.cells[8];

    expect(layout.target).toEqual({ width: 58, height: 32 });
    expect(bottomRight.target.x + bottomRight.target.width).toBeCloseTo(58, 6);
    expect(bottomRight.target.y + bottomRight.target.height).toBeCloseTo(32, 6);
    expect(layout.cells.every((cell) => (
      cell.target.x >= 0
      && cell.target.y >= 0
      && cell.target.x + cell.target.width <= 58.000001
      && cell.target.y + cell.target.height <= 32.000001
    ))).toBe(true);
  });

  it('builds a short iOS target from intrinsic text plus insets and proportionally compresses fixed caps', () => {
    const intrinsicText = { width: 10, height: 18 };
    const insets = contentInsetsPx(iosSend, { width: 120, height: 105 }, 3);
    const target = {
      width: intrinsicText.width + insets.left + insets.right,
      height: intrinsicText.height + insets.top + insets.bottom,
    };
    const layout = calculateNineSlice(iosSend, { width: 120, height: 105 }, 3, target);

    expect(target).toEqual({ width: 38, height: 35 });
    expect(layout.cells[4].target.width).toBe(0);
    expect(layout.cells[0].target.width).toBeCloseTo(17 * (38 / 39), 6);
    expect(layout.cells[2].target.width).toBeCloseTo(22 * (38 / 39), 6);
    expect(layout.cells.every((cell) => cell.target.x + cell.target.width <= 38.000001)).toBe(true);
  });

  it('keeps the iOS title origin at the authored edge insets instead of remapping it through stretch', () => {
    const source = { width: 240, height: 150 };
    const authoredGuides = {
      stretch: { x: [114 / 240, 117 / 240] as [number, number], y: [78 / 150, 81 / 150] as [number, number] },
      content: { left: 102 / 240, top: 81 / 150, right: 132 / 240, bottom: 93 / 150 },
    };
    const geometry = iosInsetGeometry(authoredGuides, source, 3);
    const insets = contentInsetsPx(geometry.guides, source, geometry.scale);
    const label = { x: insets.left, y: insets.top, width: 13, height: 18 };
    const target = {
      width: label.width + insets.left + insets.right,
      height: label.height + insets.top + insets.bottom,
    };

    expect(insets).toEqual({ top: 27, right: 36, bottom: 19, left: 34 });
    expect(target).toEqual({ width: 83, height: 64 });
    expect(label).toEqual({ x: 34, y: 27, width: 13, height: 18 });
  });
});
