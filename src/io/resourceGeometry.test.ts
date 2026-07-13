import { describe, expect, it } from 'vitest';
import { flexibleBubbleTargetSize, pngDimensionsFromDataUrl, uploadSourceScale } from './resourceGeometry';

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
