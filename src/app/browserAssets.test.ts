// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
  readFontAsset,
  readImageAsset,
} from './browserAssets';

describe('browser assets', () => {
  it('returns one image asset after resolving fallback dimensions', async () => {
    const readDataUrl = vi.fn().mockResolvedValue(
      'data:image/webp;base64,d2VicA==',
    );
    const readImageDimensions = vi.fn().mockResolvedValue({
      width: 320,
      height: 200,
    });
    const file = new File(['webp'], 'background.webp', {
      type: 'image/webp',
    });

    await expect(
      readImageAsset(file, 'android', 'chat.background', {
        readDataUrl,
        readImageDimensions,
      }),
    ).resolves.toMatchObject({
      fileName: 'background.webp',
      width: 320,
      height: 200,
      sourceScale: 3,
      userSelected: true,
    });
    expect(readDataUrl).toHaveBeenCalledOnce();
    expect(readImageDimensions).toHaveBeenCalledOnce();
  });

  it('reads a font exactly once before creating its asset', async () => {
    const readDataUrl = vi.fn().mockResolvedValue(
      'data:font/ttf;base64,Zm9udA==',
    );
    const file = new File(['font'], 'Kakao Sans.ttf', {
      type: 'font/ttf',
    });

    await expect(
      readFontAsset(file, { readDataUrl }),
    ).resolves.toEqual({
      family: 'Kakao Sans',
      fileName: 'Kakao Sans.ttf',
      dataUrl: 'data:font/ttf;base64,Zm9udA==',
    });
    expect(readDataUrl).toHaveBeenCalledOnce();
  });
});
