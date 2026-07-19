import type { ResourceRenderMode } from '../../manifest/kakaoResources';

export interface ImageSize {
  width: number;
  height: number;
}

export interface ImageProcessorPort {
  dimensions(source: Uint8Array): ImageSize | null;
  resizeToPng(input: {
    source: Uint8Array;
    width: number;
    height: number;
    mode: ResourceRenderMode;
  }): Uint8Array | null;
}
