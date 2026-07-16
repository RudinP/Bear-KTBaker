import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { guidesToAndroidMarkers, type NinePatchGuides } from '../domain/ninePatch';
import {
  assertAndroidImageOutputPossible,
  createAndroidImageExpectation,
  verifyCompiledAndroidImages,
} from './androidImageVerification';
import { buildNinePatchPng } from './ninePatchPng';

function png(red: number, alpha = 255, width = 2, height = 2) {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) image.data.set([red, 20, 30, alpha], offset);
  return PNG.sync.write(image);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function compiledNinePatchPng(interior: Buffer, guides: NinePatchGuides) {
  const decoded = PNG.sync.read(interior);
  const markers = guidesToAndroidMarkers(guides, decoded.width, decoded.height);
  const payload = Buffer.alloc(52);
  payload[0] = 1;
  payload[1] = 2;
  payload[2] = 2;
  payload[3] = 1;
  payload.writeUInt32BE(markers.contentX[0], 12);
  payload.writeUInt32BE(decoded.width - markers.contentX[1], 16);
  payload.writeUInt32BE(markers.contentY[0], 20);
  payload.writeUInt32BE(decoded.height - markers.contentY[1], 24);
  payload.writeUInt32BE(markers.stretchX[0], 32);
  payload.writeUInt32BE(markers.stretchX[1], 36);
  payload.writeUInt32BE(markers.stretchY[0], 40);
  payload.writeUInt32BE(markers.stretchY[1], 44);
  payload.writeUInt32BE(1, 48);
  const type = Buffer.from('npTc');
  const chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length, 0);
  type.copy(chunk, 4);
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, payload])), payload.length + 8);
  const encoded = PNG.sync.write(decoded);
  let iendOffset = 8;
  while (encoded.toString('ascii', iendOffset + 4, iendOffset + 8) !== 'IEND') {
    iendOffset += encoded.readUInt32BE(iendOffset) + 12;
  }
  return Buffer.concat([encoded.subarray(0, iendOffset), chunk, encoded.subarray(iendOffset)]);
}

describe('compiled Android image verification', () => {
  it('names a mapped resource whose output size cannot be determined', () => {
    expect(() => assertAndroidImageOutputPossible({
      resourceId: 'main.background',
      sourcePath: 'src/main/theme/drawable-xxhdpi/theme_background_image.png',
      hasTemplate: false,
      hasOutputSize: false,
      flexibleBubble: false,
    })).toThrow('main.background');
  });

  it('keeps separate expectations for the same key in two qualifiers', () => {
    const phone = createAndroidImageExpectation(
      'main.background',
      'src/main/theme/drawable-xxhdpi/theme_background_image.png',
      png(40),
      false,
    )!;
    const tablet = createAndroidImageExpectation(
      'main.background',
      'src/main/theme/drawable-sw600dp/theme_background_image.png',
      png(40),
      false,
    )!;
    expect(phone.resourceKey).toBe(tablet.resourceKey);
    expect(phone.semanticQualifier).toBe('drawable-xxhdpi');
    expect(tablet.semanticQualifier).toBe('drawable-sw600dp');
  });

  it('rejects the correct resource key when compiled pixels differ', async () => {
    const source = png(40);
    const compiled = png(80);
    const expected = createAndroidImageExpectation(
      'main.background',
      'src/main/theme/drawable-xxhdpi/theme_background_image.png',
      source,
      false,
    )!;
    const zip = new JSZip();
    zip.file('res/drawable-xxhdpi-v4/theme_background_image.png', compiled);
    const apk = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(verifyCompiledAndroidImages(apk, {
      resourceFiles: {
        'drawable/theme_background_image': ['res/drawable-xxhdpi-v4/theme_background_image.png'],
      },
    }, [expected])).rejects.toThrow('main.background');
  });

  it('does not let another qualifier satisfy a path-specific expectation', async () => {
    const source = png(40);
    const expected = createAndroidImageExpectation(
      'main.background',
      'src/main/theme/drawable-xxhdpi/theme_background_image.png',
      source,
      false,
    )!;
    const zip = new JSZip();
    zip.file('res/drawable-sw600dp-v13/theme_background_image.png', source);
    await expect(verifyCompiledAndroidImages(
      await zip.generateAsync({ type: 'nodebuffer' }),
      { resourceFiles: { 'drawable/theme_background_image': [
        'res/drawable-sw600dp-v13/theme_background_image.png',
      ] } },
      [expected],
    )).rejects.toThrow('main.background');
  });

  it('accepts compiled nine-patch guides within one pixel and rejects a larger shift', async () => {
    const interior = png(90, 255, 10, 10);
    const guides: NinePatchGuides = {
      stretch: { x: [0, 0.5], y: [0, 0.5] },
      content: { left: 0, top: 0, right: 1, bottom: 1 },
    };
    const source = buildNinePatchPng(interior, guides);
    const compiled = compiledNinePatchPng(interior, guides);
    const expected = createAndroidImageExpectation(
      'chat.bubble.me.first.normal',
      'src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png',
      source,
      true,
    )!;
    const zip = new JSZip();
    zip.file('res/drawable-xxhdpi-v4/theme_chatroom_bubble_me_01_image.9.png', compiled);
    const apk = await zip.generateAsync({ type: 'nodebuffer' });
    const metadata = { resourceFiles: { 'drawable/theme_chatroom_bubble_me_01_image': [
      'res/drawable-xxhdpi-v4/theme_chatroom_bubble_me_01_image.9.png',
    ] } };
    await expect(verifyCompiledAndroidImages(apk, metadata, [expected])).resolves.toBeUndefined();
    const withinOnePixel = structuredClone(expected);
    withinOnePixel.guides!.stretch.x[0] += 1 / expected.width;
    await expect(verifyCompiledAndroidImages(apk, metadata, [withinOnePixel])).resolves.toBeUndefined();
    const outsideTolerance = structuredClone(expected);
    outsideTolerance.guides!.stretch.x[0] += 2 / expected.width;
    await expect(verifyCompiledAndroidImages(apk, metadata, [outsideTolerance]))
      .rejects.toThrow('chat.bubble.me.first.normal');
  });
});
