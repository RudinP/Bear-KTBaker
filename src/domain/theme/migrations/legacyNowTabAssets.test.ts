import { describe, expect, it } from 'vitest';
import { createDefaultTheme } from '../defaults';
import { migrateLegacyNowTabAssets } from './legacyNowTabAssets';

describe('legacy Piccoma-to-Now migration', () => {
  it('fills a missing Now slot from its platform Piccoma asset while preserving current Now assets', () => {
    const project = createDefaultTheme('예전 Piccoma 프로젝트');
    for (const state of ['normal', 'selected'] as const) {
      project.platformResources.ios[`main.tab.piccoma.${state}`] = {
        fileName: `maintabIcoPiccoma-${state}@3x.png`,
        dataUrl: `data:image/png;base64,aW9z-${state}`,
      };
      project.platformResources.android[`main.tab.piccoma.${state}`] = {
        fileName: `theme_maintab_ico_piccoma_${state}_image.png`,
        dataUrl: `data:image/png;base64,YW5kcm9pZA==-${state}`,
      };
      project.platformResources.android[`main.tab.now.${state}`] = {
        fileName: `theme_maintab_ico_now_${state}_image.png`,
        dataUrl: `data:image/png;base64,bm93-${state}`,
      };
    }

    const migrated = migrateLegacyNowTabAssets(project);

    for (const state of ['normal', 'selected'] as const) {
      expect(migrated.platformResources.ios[`main.tab.now.${state}`]).toEqual({
        fileName: `maintabIcoPiccoma-${state}@3x.png`,
        dataUrl: `data:image/png;base64,aW9z-${state}`,
      });
      expect(migrated.platformResources.android[`main.tab.now.${state}`]).toEqual({
        fileName: `theme_maintab_ico_now_${state}_image.png`,
        dataUrl: `data:image/png;base64,bm93-${state}`,
      });
      expect(migrated.resources[`main.tab.now.${state}`]).toEqual({
        fileName: `maintabIcoPiccoma-${state}@3x.png`,
        dataUrl: `data:image/png;base64,aW9z-${state}`,
      });
    }
  });

  it('ignores an invalid Now placeholder when a valid Piccoma fallback exists', () => {
    const project = createDefaultTheme('잘못된 Piccoma 프로젝트');
    project.platformResources.ios['main.tab.now.normal'] = {} as never;
    project.platformResources.ios['main.tab.piccoma.normal'] = {
      fileName: 'maintabIcoPiccoma@3x.png',
      dataUrl: 'data:image/png;base64,aW9z',
    };

    const migrated = migrateLegacyNowTabAssets(project);

    expect(migrated.platformResources.ios['main.tab.now.normal']).toEqual({
      fileName: 'maintabIcoPiccoma@3x.png',
      dataUrl: 'data:image/png;base64,aW9z',
    });
    expect(migrated.resources['main.tab.now.normal']).toEqual({
      fileName: 'maintabIcoPiccoma@3x.png',
      dataUrl: 'data:image/png;base64,aW9z',
    });
  });
});
