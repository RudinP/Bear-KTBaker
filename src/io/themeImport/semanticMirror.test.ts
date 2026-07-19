import { describe, expect, it } from 'vitest';
import { createDefaultTheme } from '../../domain/theme';
import { mirrorSemanticColors, mirrorSemanticResources } from './semanticMirror';

describe('semantic mirror', () => {
  it('does not overwrite an existing target resource', () => {
    const project = createDefaultTheme('mirror', false);
    const source = {
      fileName: 'ios-main@3x.png',
      dataUrl: 'data:image/png;base64,aW9z',
      sourceScale: 3,
      userSelected: true as const,
    };
    const target = {
      fileName: 'android-main.png',
      dataUrl: 'data:image/png;base64,YW5kcm9pZA==',
      sourceScale: 4,
      userSelected: true as const,
    };
    project.resources['main.background'] = source;
    project.platformResources.ios['main.background'] = source;
    project.platformResources.android['main.background'] = target;

    mirrorSemanticResources(project, 'ios');

    expect(project.platformResources.android['main.background']).toBe(target);
    expect(project.resources['main.background']).toBe(source);
  });

  it('mirrors only the current source platform asset and records its provenance', () => {
    const project = createDefaultTheme('mirror', false);
    const shared = {
      fileName: 'shared.png',
      dataUrl: 'data:image/png;base64,c2hhcmVk',
    };
    const source = {
      fileName: 'ios-main@3x.png',
      dataUrl: 'data:image/png;base64,aW9z',
      sourceScale: 3,
      userSelected: true as const,
    };
    project.resources['main.background'] = shared;
    project.platformResources.ios['main.background'] = source;

    mirrorSemanticResources(project, 'ios');

    expect(project.platformResources.android['main.background']).toEqual({
      ...source,
      mirroredFromPlatform: 'ios',
    });
    expect(project.resources['main.background']).toBe(shared);
  });

  it('preserves Android target alpha while copying imported iOS RGB', () => {
    const project = createDefaultTheme('mirror', false);
    const sourceKey = 'MainViewStyle-Primary|-ios-normal-background-color';
    project.colorValues.ios[sourceKey] = '#ABCDEF';
    project.colorValues.android.theme_body_cell_color = '#7F112233';

    mirrorSemanticColors(project, 'ios', new Set([sourceKey]));

    expect(project.colorValues.android.theme_body_cell_color).toBe('#7FABCDEF');
  });

  it('only mirrors a color from an imported source binding', () => {
    const project = createDefaultTheme('mirror', false);
    const sourceKey = 'HeaderStyle-Main|-ios-text-color';
    project.colorValues.ios[sourceKey] = '#ABCDEF';
    const existing = project.colorValues.android.theme_header_color;

    mirrorSemanticColors(project, 'ios', new Set());

    expect(project.colorValues.android.theme_header_color).toBe(existing);
  });
});
