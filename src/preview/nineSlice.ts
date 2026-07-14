import type { NinePatchGuides } from '../domain/ninePatch';
import type { Size } from './layout';

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SliceRect extends Size {
  x: number;
  y: number;
}

export interface NineSliceCell {
  row: 0 | 1 | 2;
  column: 0 | 1 | 2;
  source: SliceRect;
  target: SliceRect;
}

export interface NineSliceLayout {
  source: Size;
  target: Size;
  scale: number;
  cells: NineSliceCell[];
}

export interface SingleLineLabelPlacement {
  contentFrame: SliceRect;
  translate: { x: number; y: number };
}

export function contentInsetsPx(guides: NinePatchGuides, source: Size, scale: number, renderer: 'css' | 'android' = 'css'): EdgeInsets {
  const logical = (sourcePixels: number) => {
    const value = sourcePixels / scale;
    if (renderer !== 'android') return value;
    return sourcePixels === 0 ? 0 : Math.max(1, Math.round(value));
  };
  return {
    top: logical(guides.content.top * source.height),
    right: logical(source.width - guides.content.right * source.width),
    bottom: logical(source.height - guides.content.bottom * source.height),
    left: logical(guides.content.left * source.width),
  };
}

function cuts(range: [number, number], length: number) {
  const start = Math.max(1, Math.min(length - 2, Math.round(range[0] * length)));
  const end = Math.max(start + 1, Math.min(length - 1, Math.round(range[1] * length)));
  return [start, end] as const;
}

export function calculateNineSlice(
  guides: NinePatchGuides,
  source: Size,
  scale: number,
  requestedTarget: Size,
): NineSliceLayout {
  const [sourceX1, sourceX2] = cuts(guides.stretch.x, source.width);
  const [sourceY1, sourceY2] = cuts(guides.stretch.y, source.height);
  const fixedLeft = sourceX1 / scale;
  const fixedRight = (source.width - sourceX2) / scale;
  const fixedTop = sourceY1 / scale;
  const fixedBottom = (source.height - sourceY2) / scale;
  const target = requestedTarget;

  const targetAxis = (leading: number, trailing: number, length: number) => {
    const fixed = leading + trailing;
    if (length >= fixed || fixed === 0) return { leading, stretch: Math.max(0, length - fixed), trailing };
    const compression = length / fixed;
    return { leading: leading * compression, stretch: 0, trailing: trailing * compression };
  };
  const targetX = targetAxis(fixedLeft, fixedRight, target.width);
  const targetY = targetAxis(fixedTop, fixedBottom, target.height);

  const sourceXs = [0, sourceX1, sourceX2];
  const sourceYs = [0, sourceY1, sourceY2];
  const sourceWidths = [sourceX1, sourceX2 - sourceX1, source.width - sourceX2];
  const sourceHeights = [sourceY1, sourceY2 - sourceY1, source.height - sourceY2];
  const targetXs = [0, targetX.leading, targetX.leading + targetX.stretch];
  const targetYs = [0, targetY.leading, targetY.leading + targetY.stretch];
  const targetWidths = [targetX.leading, targetX.stretch, targetX.trailing];
  const targetHeights = [targetY.leading, targetY.stretch, targetY.trailing];
  const cells: NineSliceCell[] = [];

  for (let row = 0 as 0 | 1 | 2; row < 3; row = (row + 1) as 0 | 1 | 2) {
    for (let column = 0 as 0 | 1 | 2; column < 3; column = (column + 1) as 0 | 1 | 2) {
      cells.push({
        row,
        column,
        source: { x: sourceXs[column], y: sourceYs[row], width: sourceWidths[column], height: sourceHeights[row] },
        target: { x: targetXs[column], y: targetYs[row], width: targetWidths[column], height: targetHeights[row] },
      });
    }
  }

  return { source, target, scale, cells };
}

function mapSourceCoordinate(
  layout: NineSliceLayout,
  axis: 'x' | 'y',
  coordinate: number,
) {
  const cells = axis === 'x'
    ? layout.cells.filter((cell) => cell.row === 0)
    : layout.cells.filter((cell) => cell.column === 0);
  const length = axis === 'x' ? layout.source.width : layout.source.height;
  const value = Math.max(0, Math.min(length, coordinate));

  for (const [index, cell] of cells.entries()) {
    const sourceStart = cell.source[axis];
    const sourceLength = axis === 'x' ? cell.source.width : cell.source.height;
    const sourceEnd = sourceStart + sourceLength;
    if (value > sourceEnd && index < cells.length - 1) continue;
    const targetStart = cell.target[axis];
    const targetLength = axis === 'x' ? cell.target.width : cell.target.height;
    const progress = sourceLength > 0 ? (value - sourceStart) / sourceLength : 0;
    return targetStart + Math.max(0, Math.min(1, progress)) * targetLength;
  }

  return axis === 'x' ? layout.target.width : layout.target.height;
}

export function contentFrameForNineSlice(layout: NineSliceLayout, guides: NinePatchGuides): SliceRect {
  const left = mapSourceCoordinate(layout, 'x', guides.content.left * layout.source.width);
  const right = mapSourceCoordinate(layout, 'x', guides.content.right * layout.source.width);
  const top = mapSourceCoordinate(layout, 'y', guides.content.top * layout.source.height);
  const bottom = mapSourceCoordinate(layout, 'y', guides.content.bottom * layout.source.height);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function singleLineLabelPlacement(
  layout: NineSliceLayout,
  guides: NinePatchGuides,
  labelRect: SliceRect,
): SingleLineLabelPlacement {
  const contentFrame = contentFrameForNineSlice(layout, guides);
  return {
    contentFrame,
    translate: {
      x: contentFrame.x + contentFrame.width / 2 - (labelRect.x + labelRect.width / 2),
      y: contentFrame.y + contentFrame.height / 2 - (labelRect.y + labelRect.height / 2),
    },
  };
}
