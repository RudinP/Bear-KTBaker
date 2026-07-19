import type { Platform, ThemeProject } from '../../domain/theme';
import { KAKAO_COLOR_SLOTS } from '../../manifest/kakaoColors';
import { KAKAO_RESOURCE_SLOTS } from '../../manifest/kakaoResources';

export function mirrorSemanticResources(
  project: ThemeProject,
  source: Platform,
): void {
  const target = source === 'ios' ? 'android' : 'ios';
  for (const slot of KAKAO_RESOURCE_SLOTS) {
    const sourceBinding = slot[source];
    const targetBinding = slot[target];
    if (!sourceBinding?.files.length || !targetBinding?.files.length) continue;
    const asset = project.platformResources[source][slot.id];
    if (!asset || project.platformResources[target][slot.id]) continue;
    project.platformResources[target][slot.id] = {
      ...asset,
      mirroredFromPlatform: source,
    };
  }
}

function rgb(value: string | undefined) {
  const match = value?.match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  return match ? match.slice(-6).toUpperCase() : undefined;
}

function withPreservedTargetAlpha(value: string | undefined, sourceRgb: string) {
  const match = value?.match(/^#([0-9a-f]{8})$/i)?.[1];
  return match
    ? `#${match.slice(0, 2).toUpperCase()}${sourceRgb}`
    : `#${sourceRgb}`;
}

export function mirrorSemanticColors(
  project: ThemeProject,
  source: Platform,
  importedBindings: ReadonlySet<string>,
): void {
  const target = source === 'ios' ? 'android' : 'ios';
  for (const slot of KAKAO_COLOR_SLOTS) {
    const sourceKeys = slot[source];
    const targetKeys = slot[target];
    if (!sourceKeys.length || !targetKeys.length) continue;
    const sourceKey = sourceKeys.find((key) => importedBindings.has(key));
    const sourceRgb = sourceKey ? rgb(project.colorValues[source][sourceKey]) : undefined;
    if (!sourceRgb) continue;
    for (const key of targetKeys) {
      project.colorValues[target][key] = withPreservedTargetAlpha(
        project.colorValues[target][key],
        sourceRgb,
      );
    }
  }
}
