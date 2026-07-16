import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { buildNinePatchPng, parseNinePatchPng } from './ninePatchPng';
import { flexibleBubbleTargetSize, pngDimensionsFromDataUrl, sourceHasNinePatchBorder, uploadSourceScale } from './resourceGeometry';

describe('arbitrary-size uploaded resource geometry', () => {
  it('keeps the uploaded iOS logical bubble size while generating @2x and @3x variants', () => {
    const source = { width: 300, height: 240 };
    expect(flexibleBubbleTargetSize('ios', 'Images/chatroomBubbleSend01@3x.png', source, 3, false)).toEqual({ width: 300, height: 240 });
    expect(flexibleBubbleTargetSize('ios', 'Images/chatroomBubbleSend01@2x.png', source, 3, false)).toEqual({ width: 200, height: 160 });
  });

  it('uses an uploaded @2x suffix as the logical source scale', () => {
    expect(uploadSourceScale('ios', 'chat.bubble.me.first.normal', 'custom@2x.png')).toBe(2);
    expect(flexibleBubbleTargetSize('ios', 'Images/chatroomBubbleSend01@3x.png', { width: 202, height: 142 }, 2, false)).toEqual({ width: 303, height: 213 });
  });

  it('preserves an arbitrary Android bubble interior instead of forcing the sample dimensions', () => {
    expect(flexibleBubbleTargetSize('android', 'theme_chatroom_bubble_me_01_image.9.png', { width: 247, height: 133 }, 3, false)).toEqual({ width: 247, height: 133 });
    expect(flexibleBubbleTargetSize('android', 'theme_chatroom_bubble_me_01_image.9.png', { width: 249, height: 135 }, 3, true)).toEqual({ width: 247, height: 133 });
  });

  it('lets explicit borderless metadata override legacy nine-patch filename inference', () => {
    const sourceIsNinePatch = sourceHasNinePatchBorder(false, 'bubble.9.PNG');
    expect(sourceIsNinePatch).toBe(false);
    expect(flexibleBubbleTargetSize(
      'android',
      'theme_chatroom_bubble_me_01_image.9.png',
      { width: 7, height: 5 },
      3,
      sourceIsNinePatch,
    )).toEqual({ width: 7, height: 5 });
    expect(sourceHasNinePatchBorder(undefined, 'legacy.9.PNG')).toBe(true);
  });

  it.each([
    ['@2x', { width: 80, height: 70 }, 2, { width: 120, height: 105 }],
    ['1x', { width: 40, height: 35 }, 1, { width: 120, height: 105 }],
  ] as const)('normalizes a mirrored iOS %s bubble to Android xxhdpi pixels', (_label, source, sourceScale, expected) => {
    expect(flexibleBubbleTargetSize(
      'android',
      'src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png',
      source,
      sourceScale,
      false,
      'ios',
    )).toEqual(expected);
  });

  it('writes normalized mirrored dimensions with independent Android nine-patch markers', () => {
    const size = flexibleBubbleTargetSize(
      'android',
      'src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png',
      { width: 80, height: 70 },
      2,
      false,
      'ios',
    );
    const interior = PNG.sync.write(new PNG(size));
    const androidGuides = {
      stretch: { x: [54 / 122, 56 / 122] as [number, number], y: [55 / 112, 57 / 112] as [number, number] },
      content: { left: 20 / 122, top: 12 / 112, right: 92 / 122, bottom: 100 / 112 },
    };
    const output = PNG.sync.read(buildNinePatchPng(interior, androidGuides));
    const parsed = parseNinePatchPng(PNG.sync.write(output));

    expect([output.width, output.height]).toEqual([122, 107]);
    expect([parsed.width, parsed.height]).toEqual([120, 105]);
    expect(parsed.guides.stretch.x).toEqual([53 / 120, 55 / 120]);
    expect(parsed.guides.content.left).toBeCloseTo(20 / 120, 5);
    expect(parsed.guides.content.top).toBeCloseTo(11 / 105, 5);
  });

  it('uses the guide-specific four-times scale only for the Android tab background', () => {
    expect(uploadSourceScale('android', 'main.tab.background', 'tab.png')).toBe(4);
    expect(uploadSourceScale('android', 'chat.bubble.me.first.normal', 'bubble.png')).toBe(3);
  });

  it('reads an arbitrary PNG source size before the project can be exported', () => {
    const header = Buffer.alloc(24);
    header.set([137, 80, 78, 71, 13, 10, 26, 10]);
    header.writeUInt32BE(300, 16);
    header.writeUInt32BE(240, 20);
    expect(pngDimensionsFromDataUrl(`data:image/png;base64,${header.toString('base64')}`)).toEqual({ width: 300, height: 240 });
  });
});
