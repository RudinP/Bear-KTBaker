export class ImageDataUrlError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ImageDataUrlError';
  }
}

export function decodeImageDataUrl(dataUrl: string): Uint8Array {
  const match = dataUrl.match(
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/,
  );
  if (
    !match
    || match[2].length === 0
    || match[2].length % 4 !== 0
  ) {
    throw new ImageDataUrlError(
      '이미지 data URL이 올바르지 않습니다.',
    );
  }
  try {
    const binary = atob(match[2]);
    return Uint8Array.from(
      binary,
      (character) => character.charCodeAt(0),
    );
  } catch (cause) {
    throw new ImageDataUrlError(
      '이미지 base64 데이터를 읽지 못했습니다.',
      { cause },
    );
  }
}
