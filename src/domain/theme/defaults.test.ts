import { describe, expect, it } from 'vitest';
import { createDefaultTheme } from './defaults';

describe('theme defaults', () => {
  it('targets both platforms with independent resource maps', () => {
    const project = createDefaultTheme('복숭아 우체국');

    expect(project.meta.name).toBe('복숭아 우체국');
    expect(project.schemaVersion).toBe(1);
    expect(project.targets).toEqual({ ios: true, android: true });
    expect(project.platformResources).toEqual({ ios: {}, android: {} });
    expect(project.platformResources.ios)
      .not.toBe(project.platformResources.android);
  });
});
