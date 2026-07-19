import { describe, expectTypeOf, it } from 'vitest';
import type {
  AndroidApkBuilderPort,
  AndroidApkBuildRequest,
  AndroidApkInspectorPort,
} from './androidApk';
import type { DialogPort } from './dialog';
import type { FileSystemPort } from './fileSystem';
import type {
  ImageProcessorPort,
  ImageSize,
} from './imageProcessor';

describe('application ports', () => {
  it('exposes byte-oriented and cancellation-safe boundaries', () => {
    expectTypeOf<DialogPort['selectFile']>()
      .returns.toEqualTypeOf<Promise<string | null>>();
    expectTypeOf<FileSystemPort['readBytes']>()
      .returns.toEqualTypeOf<Promise<Uint8Array>>();
    expectTypeOf<ImageProcessorPort['resizeToPng']>()
      .returns.toEqualTypeOf<Uint8Array | null>();
    expectTypeOf<AndroidApkBuilderPort['build']>()
      .returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf<AndroidApkInspectorPort['inspect']>()
      .returns.toMatchTypeOf<Promise<unknown>>();
    expectTypeOf<AndroidApkBuildRequest['expectedImages']>()
      .toMatchTypeOf<readonly unknown[]>();
    expectTypeOf<ImageSize>()
      .toEqualTypeOf<{ width: number; height: number }>();
  });
});
