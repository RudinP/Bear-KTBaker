import { describe, expect, it } from 'vitest';
import {
  decodeImageDataUrl,
  ImageDataUrlError,
} from './imageDataUrl';

describe('image data URL decoding', () => {
  it.each(['png', 'jpeg', 'webp'])(
    'decodes exact bytes from image/%s base64 URLs',
    (kind) => {
      expect(decodeImageDataUrl(
        `data:image/${kind};base64,AAECA/7/`,
      )).toEqual(new Uint8Array([0, 1, 2, 3, 254, 255]));
    },
  );

  it.each([
    'data:text/plain;base64,SGVsbG8=',
    'data:image/gif;base64,R0lGODlh',
    'data:image/png,AAAA',
    'data:IMAGE/PNG;base64,AAAA',
    'data:image/png;base64,',
    'data:image/png;base64,AAA',
    'data:image/png;base64,AA=A',
    'data:image/png;base64,@@@@',
  ])('rejects a non-image or invalid base64 URL: %s', (dataUrl) => {
    expect(() => decodeImageDataUrl(dataUrl))
      .toThrow(ImageDataUrlError);
  });

  it('exposes a layer-neutral codec error', () => {
    let failure: unknown;
    try {
      decodeImageDataUrl('not a data URL');
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(ImageDataUrlError);
    expect(failure).toMatchObject({
      name: 'ImageDataUrlError',
      message: '이미지 data URL이 올바르지 않습니다.',
    });
    expect(failure).not.toHaveProperty('code');
    expect(failure).not.toHaveProperty('operation');
  });
});
