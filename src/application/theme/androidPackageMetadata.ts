export function androidPackageId(themeId: string): string {
  const clean = themeId
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .split('.')
    .filter(Boolean)
    .map((part) => /^[a-z]/.test(part) ? part : `t${part}`)
    .join('.');
  return clean.includes('.')
    ? clean
    : `com.themestudio.${clean || 'theme'}`;
}

export function androidVersionCode(version: string): number {
  const [major = 1, minor = 0, patch = 0] = version
    .split('.')
    .map((part) => Number(part.replace(/\D/g, '')) || 0);
  return Math.max(1, major * 10_000 + minor * 100 + patch);
}

export function androidVersionName(version: string): string {
  return version.replace(/[^0-9A-Za-z._-]/g, '') || '1.0.0';
}
