import type { AndroidCompiledMetadata } from '../../../src/io/androidCompiledMetadata';
import type { StandaloneAndroidMetadataExpectation } from './types';

function normalizedAndroidColor(value: string | undefined) {
  const hex = value?.trim().match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  if (!hex) return undefined;
  return `#${hex.length === 6 ? 'FF' : ''}${hex.toUpperCase()}`;
}

export function verifyStandaloneAndroidMetadata(
  metadata: AndroidCompiledMetadata,
  expected: StandaloneAndroidMetadataExpectation,
) {
  const mismatches: string[] = [];
  if (metadata.themeId !== expected.packageName) {
    mismatches.push(`manifest package ${metadata.themeId ?? 'missing'}`);
  }
  if (metadata.resourcePackage !== expected.packageName) {
    mismatches.push(`resources package ${metadata.resourcePackage ?? 'missing'}`);
  }
  if (expected.versionName !== undefined && metadata.version !== expected.versionName) {
    mismatches.push(`version ${metadata.version ?? 'missing'}`);
  }
  if (expected.name !== undefined && metadata.name !== expected.name) {
    mismatches.push(`name ${metadata.name ?? 'missing'}`);
  }
  if (expected.appearance !== undefined && metadata.appearance !== expected.appearance) {
    mismatches.push(`appearance ${metadata.appearance ?? 'missing'}`);
  }
  const changedColors = Object.keys(expected.colors ?? {}).filter((name) => {
    const actual = normalizedAndroidColor(metadata.colors?.[name]);
    const wanted = normalizedAndroidColor(expected.colors?.[name]);
    return !actual || !wanted || actual !== wanted;
  });
  if (changedColors.length) mismatches.push(`색상 ${changedColors.length}개`);
  if (mismatches.length) {
    throw new Error(`Android APK 리소스 검증에 실패했습니다 (${mismatches.join(', ')}).`);
  }
  return metadata;
}
