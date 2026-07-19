import { PNG } from 'pngjs';
import { guidesToAndroidMarkers, type NinePatchGuides } from '../domain/ninePatch';

type PixelRange = [number, number];

function isMarker(png: PNG, x: number, y: number) {
  const offset = (png.width * y + x) * 4;
  return png.data[offset] <= 8 && png.data[offset + 1] <= 8 && png.data[offset + 2] <= 8 && png.data[offset + 3] >= 247;
}

function firstRun(values: boolean[], fallbackEnd: number): PixelRange {
  let start = -1;
  for (let index = 1; index < values.length - 1; index += 1) {
    if (values[index] && start < 0) start = index - 1;
    if (!values[index] && start >= 0) return [start, index - 1];
  }
  return start >= 0 ? [start, values.length - 2] : [0, fallbackEnd];
}

function normalize(range: PixelRange, length: number): [number, number] {
  return [range[0] / length, range[1] / length];
}

function pngChunk(buffer: Buffer, expectedType: string) {
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === expectedType) return buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
  }
  return undefined;
}

export function parseCompiledNinePatchPng(buffer: Buffer) {
  const png = PNG.sync.read(buffer);
  const chunk = pngChunk(buffer, 'npTc');
  if (!chunk || chunk.length < 32) throw new Error('컴파일된 9-patch 정보를 찾을 수 없습니다.');
  const xCount = chunk[1];
  const yCount = chunk[2];
  const colorCount = chunk[3];
  const invalid = () => { throw new Error('컴파일된 9-patch 구간 정보가 손상되었습니다.'); };
  if (xCount % 2 !== 0
    || yCount % 2 !== 0
    || colorCount === 0
    || chunk.length < 32 + (xCount + yCount + colorCount) * 4) invalid();
  const paddingLeft = chunk.readUInt32BE(12);
  const paddingRight = chunk.readUInt32BE(16);
  const paddingTop = chunk.readUInt32BE(20);
  const paddingBottom = chunk.readUInt32BE(24);
  const divisionRange = (offset: number, count: number, length: number): PixelRange => {
    if (count === 0) return [0, length];
    const divisions = Array.from({ length: count }, (_, index) => chunk.readUInt32BE(offset + index * 4));
    if (divisions.some((value, index) => value > length || (index > 0 && value <= divisions[index - 1]))) {
      invalid();
    }
    return [divisions[0], divisions[1]];
  };
  const x = divisionRange(32, xCount, png.width);
  const yOffset = 32 + xCount * 4;
  const y = divisionRange(yOffset, yCount, png.height);
  return {
    width: png.width,
    height: png.height,
    guides: {
      stretch: { x: normalize(x, png.width), y: normalize(y, png.height) },
      content: {
        left: paddingLeft / png.width,
        top: paddingTop / png.height,
        right: (png.width - paddingRight) / png.width,
        bottom: (png.height - paddingBottom) / png.height,
      },
    } satisfies NinePatchGuides,
  };
}

export function parseNinePatchPng(buffer: Buffer) {
  const png = PNG.sync.read(buffer);
  if (png.width < 3 || png.height < 3) throw new Error('9-patch 이미지는 테두리를 포함해 3×3px 이상이어야 합니다.');
  const width = png.width - 2;
  const height = png.height - 2;
  const top = firstRun(Array.from({ length: png.width }, (_, x) => isMarker(png, x, 0)), width);
  const left = firstRun(Array.from({ length: png.height }, (_, y) => isMarker(png, 0, y)), height);
  const bottom = firstRun(Array.from({ length: png.width }, (_, x) => isMarker(png, x, png.height - 1)), width);
  const right = firstRun(Array.from({ length: png.height }, (_, y) => isMarker(png, png.width - 1, y)), height);
  const contentX = normalize(bottom, width);
  const contentY = normalize(right, height);
  const guides: NinePatchGuides = {
    stretch: { x: normalize(top, width), y: normalize(left, height) },
    content: { left: contentX[0], top: contentY[0], right: contentX[1], bottom: contentY[1] },
  };
  return { width, height, guides };
}

export function stripNinePatchBorder(sourceBytes: Uint8Array): Buffer {
  const source = PNG.sync.read(Buffer.from(sourceBytes));
  if (source.width < 3 || source.height < 3) throw new Error('9-patch 테두리를 제거할 수 없는 이미지입니다.');
  const output = new PNG({ width: source.width - 2, height: source.height - 2 });
  PNG.bitblt(source, output, 1, 1, output.width, output.height, 0, 0);
  return PNG.sync.write(output);
}

export function replaceNinePatchInterior(
  templatePng: Uint8Array,
  borderlessPng: Uint8Array,
): Buffer {
  const templateBytes = Buffer.from(templatePng);
  const template = PNG.sync.read(templateBytes);
  const interior = PNG.sync.read(Buffer.from(borderlessPng));
  if (interior.width !== template.width - 2 || interior.height !== template.height - 2) {
    throw new Error('교체 이미지 크기가 9-patch 내부 크기와 맞지 않습니다.');
  }
  const output = PNG.sync.read(templateBytes);
  PNG.bitblt(interior, output, 0, 0, interior.width, interior.height, 1, 1);
  return PNG.sync.write(output);
}

function mark(png: PNG, x: number, y: number) {
  const offset = (png.width * y + x) * 4;
  png.data[offset] = 0;
  png.data[offset + 1] = 0;
  png.data[offset + 2] = 0;
  png.data[offset + 3] = 255;
}

function markHorizontal(png: PNG, y: number, range: PixelRange) {
  for (let value = range[0]; value < range[1]; value += 1) mark(png, value + 1, y);
}

function markVertical(png: PNG, x: number, range: PixelRange) {
  for (let value = range[0]; value < range[1]; value += 1) mark(png, x, value + 1);
}

export function buildNinePatchPng(
  borderlessPng: Uint8Array,
  guides: NinePatchGuides,
): Buffer {
  const source = PNG.sync.read(Buffer.from(borderlessPng));
  const output = new PNG({ width: source.width + 2, height: source.height + 2 });
  output.data.fill(0);
  PNG.bitblt(source, output, 0, 0, source.width, source.height, 1, 1);
  const markers = guidesToAndroidMarkers(guides, source.width, source.height);
  markHorizontal(output, 0, markers.stretchX);
  markVertical(output, 0, markers.stretchY);
  markHorizontal(output, output.height - 1, markers.contentX);
  markVertical(output, output.width - 1, markers.contentY);
  return PNG.sync.write(output);
}
