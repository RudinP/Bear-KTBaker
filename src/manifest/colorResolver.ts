import type { Platform, ThemeProject } from '../domain/theme/model';
import { ANDROID_SAMPLE_COLORS, getColorSlot, IOS_DEFAULT_COLORS, IOS_SAMPLE_ALPHAS } from './kakaoColors';

function alphaHex(alpha: string | undefined) {
  const numeric = Number(alpha);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.round(Math.max(0, Math.min(1, numeric)) * 255).toString(16).padStart(2, '0').toUpperCase();
}

export function colorValue(project: ThemeProject, platform: Platform, slotId: string) {
  const slot = getColorSlot(slotId);
  const key = slot[platform][0];
  if (!key) return '#000000';
  const value = project.colorValues?.[platform]?.[key]
    ?? (platform === 'ios' ? IOS_DEFAULT_COLORS[key] : ANDROID_SAMPLE_COLORS[key])
    ?? '#000000';
  if (platform === 'ios' && slot.iosAlpha && /^#[0-9a-f]{6}$/i.test(value)) {
    const alpha = project.colorValues?.ios?.[slot.iosAlpha] ?? IOS_SAMPLE_ALPHAS[slot.iosAlpha];
    const hex = alphaHex(alpha);
    if (hex) return `#${hex}${value.slice(1)}`;
  }
  return value;
}

export function colorAlpha(project: ThemeProject, platform: Platform, slotId: string) {
  const slot = getColorSlot(slotId);
  if (platform === 'ios') {
    if (!slot.iosAlpha) return undefined;
    return Number(project.colorValues.ios[slot.iosAlpha] ?? IOS_SAMPLE_ALPHAS[slot.iosAlpha] ?? 1);
  }
  const key = slot.android[0];
  const value = key && (project.colorValues.android[key] ?? ANDROID_SAMPLE_COLORS[key]);
  return value && /^#[0-9a-f]{8}$/i.test(value) ? Number.parseInt(value.slice(1, 3), 16) / 255 : undefined;
}

export function cssColor(value: string) {
  if (/^#[0-9a-f]{8}$/i.test(value)) {
    const [alpha, red, green, blue] = [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7), value.slice(7, 9)];
    return `#${red}${green}${blue}${alpha}`;
  }
  return value;
}

export function opaqueColor(value: string) {
  if (/^#[0-9a-f]{8}$/i.test(value)) return `#${value.slice(3)}`;
  return value;
}

export function setColorSlot(project: ThemeProject, _platform: Platform, slotId: string, value: string): ThemeProject {
  const slot = getColorSlot(slotId);
  const colorValues = {
    ios: { ...project.colorValues.ios },
    android: { ...project.colorValues.android },
  };
  const rgb = opaqueColor(value).toUpperCase();
  for (const platform of ['ios', 'android'] as const) {
    for (const key of slot[platform]) {
      if (platform === 'android') {
        const current = colorValues.android[key] ?? ANDROID_SAMPLE_COLORS[key];
        colorValues.android[key] = /^#[0-9a-f]{8}$/i.test(current)
          ? `#${current.slice(1, 3).toUpperCase()}${rgb.slice(1)}`
          : rgb;
      } else {
        colorValues.ios[key] = rgb;
      }
    }
  }
  return { ...project, colorValues };
}

export function setColorSlotAlpha(project: ThemeProject, platform: Platform, slotId: string, alpha: number) {
  const slot = getColorSlot(slotId);
  const clamped = Math.max(0, Math.min(1, alpha));
  if (platform === 'android') {
    const android = { ...project.colorValues.android };
    const hex = Math.round(clamped * 255).toString(16).padStart(2, '0').toUpperCase();
    let changed = false;
    for (const key of slot.android) {
      const current = android[key] ?? ANDROID_SAMPLE_COLORS[key];
      if (!/^#[0-9a-f]{8}$/i.test(current)) continue;
      android[key] = `#${hex}${current.slice(3).toUpperCase()}`;
      changed = true;
    }
    return changed ? { ...project, colorValues: { ...project.colorValues, android } } : project;
  }
  if (!slot.iosAlpha) return project;
  return {
    ...project,
    colorValues: {
      ...project.colorValues,
      ios: { ...project.colorValues.ios, [slot.iosAlpha]: clamped.toFixed(2) },
    },
  };
}
