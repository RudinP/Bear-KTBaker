import { describe, expect, it } from 'vitest';
import { decodeIosCss, resolveIosBubbleGuides } from './iosCssDecoder';

describe('decodeIosCss', () => {
  it('returns canonical metadata and colors without creating a project', () => {
    const decoded = decodeIosCss(`
      ManifestStyle {
        -kakaotalk-theme-name: '복숭아';
        -kakaotalk-theme-style: 'dark';
      }
      MainViewStyle-Primary {
        background-color: #123456;
      }
    `);

    expect(decoded.metadata).toMatchObject({
      name: '복숭아',
      appearance: 'dark',
    });
    expect(decoded.screenColors.friends).toBe('#123456');
    expect(decoded.screenColors.now).toBe('#123456');
  });

  it('collects referenced files and bubble guide declarations', () => {
    const decoded = decodeIosCss(`
      DefaultProfileStyle { -ios-profile-images: 'one.png' 'two@2x.png'; }
      MessageCellStyle-Send {
        -ios-background-image: 'sent.png' 17px 18px;
        -ios-title-edgeinsets: 10px 11px 7px 17px;
      }
    `);

    expect(decoded.referencedFiles['main.profile.01']).toEqual([
      'Images/one@3x.png', 'Images/one@2x.png', 'Images/one.png',
    ]);
    expect(decoded.bubbleGuides).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resourceId: 'chat.bubble.me.first.normal',
        point: [17, 18],
        insets: [10, 11, 7, 17],
      }),
    ]));
  });
});

describe('resolveIosBubbleGuides', () => {
  it('converts CSS points and edge insets using the asset source scale', () => {
    const [declaration] = decodeIosCss(`
      MessageCellStyle-Send {
        -ios-background-image: 'sent@3x.png' 17px 18px;
        -ios-title-edgeinsets: 10px 11px 7px 17px;
      }
    `).bubbleGuides;

    expect(resolveIosBubbleGuides(declaration!, {
      width: 120,
      height: 90,
      sourceScale: 3,
    })).toMatchObject({
      stretch: { x: [51 / 120, 54 / 120], y: [54 / 90, 57 / 90] },
      content: { left: 33 / 120, top: 30 / 90, right: 69 / 120, bottom: 69 / 90 },
    });
  });
});
