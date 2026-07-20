import type {
  FontAsset,
  ImageAsset,
  Platform,
} from '../domain/theme/model';
import {
  pngDimensionsFromDataUrl,
  uploadSourceScale,
} from '../io/resourceGeometry';

interface PixelSize {
  width: number;
  height: number;
}

interface FileReaderDependencies {
  readDataUrl(file: File): Promise<string>;
}

interface ImageReaderDependencies extends FileReaderDependencies {
  readImageDimensions(dataUrl: string): Promise<PixelSize>;
}

const browserFileReader: FileReaderDependencies = {
  readDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(
        reader.error ?? new Error(`파일을 읽지 못했습니다: ${file.name}`),
      );
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
  },
};

const browserImageReader: ImageReaderDependencies = {
  ...browserFileReader,
  readImageDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onerror = () => reject(
        new Error('이미지의 크기를 읽지 못했습니다.'),
      );
      image.onload = () => resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      image.src = dataUrl;
    });
  },
};

export async function readImageAsset(
  file: File,
  platform: Platform,
  resourceId: string,
  dependencies: ImageReaderDependencies = browserImageReader,
): Promise<ImageAsset> {
  const dataUrl = await dependencies.readDataUrl(file);
  const dimensions = pngDimensionsFromDataUrl(dataUrl)
    ?? await dependencies.readImageDimensions(dataUrl);
  return {
    fileName: file.name,
    dataUrl,
    ...dimensions,
    sourceScale: uploadSourceScale(platform, resourceId, file.name),
    ...(platform === 'android' && /\.9\.png$/i.test(file.name)
      ? { sourceIsNinePatch: true }
      : {}),
    userSelected: true,
  };
}

export async function readFontAsset(
  file: File,
  dependencies: FileReaderDependencies = browserFileReader,
): Promise<FontAsset> {
  return {
    family: file.name.replace(/\.(otf|ttf)$/i, ''),
    fileName: file.name,
    dataUrl: await dependencies.readDataUrl(file),
  };
}
