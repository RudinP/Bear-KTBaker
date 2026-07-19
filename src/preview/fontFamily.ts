import type { Platform } from '../domain/theme/model';

const KAKAO_SMALL_SANS_STACK = '"Kakao Small Sans", sans-serif';

const PLATFORM_FONT_STACK: Record<Platform, string> = {
  ios: KAKAO_SMALL_SANS_STACK,
  android: KAKAO_SMALL_SANS_STACK,
};

export function previewFontFamily(platform: Platform, customFamily?: string) {
  const fallback = PLATFORM_FONT_STACK[platform];
  if (!customFamily) return fallback;
  const escaped = customFamily.replace(/["\\]/g, '\\$&');
  return `"${escaped}", ${fallback}`;
}
