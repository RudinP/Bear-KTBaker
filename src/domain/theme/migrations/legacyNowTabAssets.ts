import type { ImageAsset, ThemeProject } from '../model';
import { isUsableImageAsset } from './legacyProjectImages';

export function migrateLegacyNowTabAssets(
  project: ThemeProject,
): ThemeProject {
  for (const state of ['normal', 'selected'] as const) {
    const currentId = `main.tab.now.${state}`;
    const legacyId = `main.tab.piccoma.${state}`;
    const sharedCurrent = isUsableImageAsset(project.resources[currentId])
      ? project.resources[currentId]
      : undefined;
    let firstFallback: ImageAsset | undefined;
    for (const platform of ['ios', 'android'] as const) {
      const current = project.platformResources[platform][currentId];
      if (isUsableImageAsset(current) || sharedCurrent) continue;
      const platformLegacy = project.platformResources[platform][legacyId];
      const sharedLegacy = project.resources[legacyId];
      const legacy = isUsableImageAsset(platformLegacy)
        ? platformLegacy
        : isUsableImageAsset(sharedLegacy) ? sharedLegacy : undefined;
      if (!legacy) continue;
      project.platformResources[platform][currentId] = { ...legacy };
      firstFallback ??= legacy;
    }
    if (!sharedCurrent && firstFallback) {
      project.resources[currentId] = { ...firstFallback };
    }
  }
  return project;
}
