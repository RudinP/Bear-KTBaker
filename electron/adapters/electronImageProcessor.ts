import { nativeImage } from 'electron';
import type { ImageProcessorPort } from '../../src/application/ports/imageProcessor';
import type { ResourceRenderMode } from '../../src/manifest/kakaoResources';

export function createElectronImageProcessor(
  createFromBuffer = nativeImage.createFromBuffer,
): ImageProcessorPort {
  const decode = (source: Uint8Array) => {
    const image = createFromBuffer(Buffer.from(source));
    return image.isEmpty() ? null : image;
  };

  return {
    dimensions(source) {
      return decode(source)?.getSize() ?? null;
    },

    resizeToPng({ source, width, height, mode }) {
      const image = decode(source);
      if (!image || width <= 0 || height <= 0) return null;
      const cropMode = [
        'top-center-crop',
        'top-center-cover',
        'center-crop',
        'cover',
      ].includes(mode);
      const output = cropMode
        ? coverAndCrop(image, width, height, mode)
        : image.resize({ width, height, quality: 'best' });
      return new Uint8Array(output.toPNG());
    },
  };
}

function coverAndCrop(
  source: Electron.NativeImage,
  width: number,
  height: number,
  mode: ResourceRenderMode,
) {
  const size = source.getSize();
  const scale = Math.max(
    width / size.width,
    height / size.height,
  );
  const resized = source.resize({
    width: Math.max(width, Math.round(size.width * scale)),
    height: Math.max(height, Math.round(size.height * scale)),
    quality: 'best',
  });
  const resizedSize = resized.getSize();
  const topAligned =
    mode === 'top-center-crop'
    || mode === 'top-center-cover';
  return resized.crop({
    x: Math.max(
      0,
      Math.floor((resizedSize.width - width) / 2),
    ),
    y: topAligned
      ? 0
      : Math.max(
          0,
          Math.floor((resizedSize.height - height) / 2),
        ),
    width,
    height,
  });
}
