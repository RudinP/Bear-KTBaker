import type { Platform, ThemeProject } from '../domain/theme';
import { shouldIgnoreLegacyMirroredBubbleAssetTarget } from './bubblePlatformIsolation';
import { getResourceSlot } from './kakaoResources';

function preferredFile(platform: Platform, files: readonly string[]) {
  if (platform === 'ios') return files.find((file) => file.includes('@3x.')) ?? files[0];
  return files.find((file) => file.includes('/drawable-xxhdpi/'))
    ?? files.find((file) => file.includes('/mipmap-xxhdpi/'))
    ?? files[0];
}

export function resolveResourceAsset(project: ThemeProject, platform: Platform, resourceId: string) {
  if (shouldIgnoreLegacyMirroredBubbleAssetTarget(project, platform, resourceId)) return undefined;
  return project.platformResources?.[platform]?.[resourceId];
}

export function resolveResourceUrl(project: ThemeProject, platform: Platform, resourceId: string) {
  const custom = resolveResourceAsset(project, platform, resourceId);
  if (custom) return custom.dataUrl;
  if (project.baseSample !== 'apeach') return undefined;
  const binding = getResourceSlot(resourceId)[platform];
  if (binding?.sampleIncluded === false) return undefined;
  const file = binding ? preferredFile(platform, binding.files) : undefined;
  return file ? `./sample/${platform}/${file}` : undefined;
}
