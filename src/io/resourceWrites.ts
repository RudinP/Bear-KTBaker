import type { ImageAsset, Platform, ThemeProject } from '../domain/theme';
import { shouldIgnoreLegacyMirroredBubbleAssetTarget } from '../manifest/bubblePlatformIsolation';
import { getResourceSlot } from '../manifest/kakaoResources';

export interface MappedResourceWrite {
  resourceId: string;
  path: string;
  asset: ImageAsset;
  ninePatch: boolean;
}

export function getMappedResourceWrites(project: ThemeProject, platform: Platform): MappedResourceWrite[] {
  const resources = project.platformResources?.[platform] ?? {};
  return Object.entries(resources).flatMap(([resourceId, asset]) => {
    if (shouldIgnoreLegacyMirroredBubbleAssetTarget(project, platform, resourceId)) return [];
    const binding = getResourceSlot(resourceId)[platform];
    if (!binding) return [];
    return binding.files.map((path) => ({ resourceId, path, asset, ninePatch: Boolean(binding.ninePatch) }));
  });
}
