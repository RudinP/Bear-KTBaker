import { PNG } from 'pngjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElectronImageProcessor } from './electronImageProcessor';

interface Size {
  width: number;
  height: number;
}

const resize = vi.fn();
const crop = vi.fn();

function png(width: number, height: number) {
  return PNG.sync.write(new PNG({ width, height }));
}

function image(size: Size): Electron.NativeImage {
  return {
    isEmpty: () => false,
    getSize: () => size,
    resize(options: Electron.ResizeOptions) {
      const resizedSize = {
        width: options.width ?? size.width,
        height: options.height ?? size.height,
      };
      resize(options);
      return image(resizedSize);
    },
    crop(rectangle: Electron.Rectangle) {
      crop(rectangle);
      return image({
        width: rectangle.width,
        height: rectangle.height,
      });
    },
    toPNG: () => png(size.width, size.height),
  } as unknown as Electron.NativeImage;
}

const createFromBuffer = vi.fn((source: Buffer) => {
  try {
    const decoded = PNG.sync.read(source);
    return image({
      width: decoded.width,
      height: decoded.height,
    });
  } catch {
    return {
      isEmpty: () => true,
    } as Electron.NativeImage;
  }
});

describe('Electron image processor', () => {
  const images = createElectronImageProcessor(
    createFromBuffer as typeof import('electron').nativeImage.createFromBuffer,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns exact dimensions for a valid PNG', () => {
    expect(images.dimensions(png(4, 2))).toEqual({
      width: 4,
      height: 2,
    });
  });

  it('returns null for bytes Electron cannot decode', () => {
    expect(images.dimensions(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(images.resizeToPng({
      source: new Uint8Array([1, 2, 3]),
      width: 2,
      height: 2,
      mode: 'stretch',
    })).toBeNull();
  });

  it('stretches directly to the requested dimensions as PNG bytes', () => {
    const result = images.resizeToPng({
      source: png(4, 2),
      width: 3,
      height: 5,
      mode: 'stretch',
    });

    expect(result).toBeInstanceOf(Uint8Array);
    expect(images.dimensions(result!)).toEqual({
      width: 3,
      height: 5,
    });
    expect(resize).toHaveBeenCalledWith({
      width: 3,
      height: 5,
      quality: 'best',
    });
    expect(crop).not.toHaveBeenCalled();
  });

  it.each(['center-crop', 'cover'] as const)(
    '%s cover-resizes and crops equally from the horizontal sides',
    (mode) => {
      const result = images.resizeToPng({
        source: png(4, 2),
        width: 2,
        height: 2,
        mode,
      });

      expect(images.dimensions(result!)).toEqual({
        width: 2,
        height: 2,
      });
      expect(resize).toHaveBeenCalledWith({
        width: 4,
        height: 2,
        quality: 'best',
      });
      expect(crop).toHaveBeenCalledWith({
        x: 1,
        y: 0,
        width: 2,
        height: 2,
      });
    },
  );

  it.each(['top-center-crop', 'top-center-cover'] as const)(
    '%s anchors a vertical crop at the top',
    (mode) => {
      images.resizeToPng({
        source: png(2, 4),
        width: 2,
        height: 2,
        mode,
      });

      expect(crop).toHaveBeenCalledWith({
        x: 0,
        y: 0,
        width: 2,
        height: 2,
      });
    },
  );

  it.each(['center-crop', 'cover'] as const)(
    '%s centers a vertical crop',
    (mode) => {
      images.resizeToPng({
        source: png(2, 4),
        width: 2,
        height: 2,
        mode,
      });

      expect(crop).toHaveBeenCalledWith({
        x: 0,
        y: 1,
        width: 2,
        height: 2,
      });
    },
  );

  it('rejects non-positive target dimensions', () => {
    expect(images.resizeToPng({
      source: png(4, 2),
      width: 0,
      height: 2,
      mode: 'stretch',
    })).toBeNull();
  });
});
