import { describe, expectTypeOf, it } from 'vitest';
import type {
  ImageAsset,
  Platform,
  ThemeProject,
} from './model';

describe('theme model contract', () => {
  it('keeps schema and platform literals stable', () => {
    expectTypeOf<ThemeProject['schema']>()
      .toEqualTypeOf<'kakao-theme-studio'>();
    expectTypeOf<ThemeProject['schemaVersion']>()
      .toEqualTypeOf<1>();
    expectTypeOf<Platform>()
      .toEqualTypeOf<'ios' | 'android'>();
    expectTypeOf<ThemeProject['platformResources']['ios'][string]>()
      .toEqualTypeOf<ImageAsset>();
  });
});
