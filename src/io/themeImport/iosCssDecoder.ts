import path from 'node:path';
import type { ImageAsset, ScreenId, ThemeProject } from '../../domain/theme/model';
import type { NinePatchGuides } from '../../domain/ninePatch';
import { IOS_DEFAULT_COLORS, IOS_SAMPLE_ALPHAS } from '../../manifest/kakaoColors';
import { KAKAO_RESOURCE_SLOTS } from '../../manifest/kakaoResources';

export interface IosBubbleGuideDeclaration {
  resourceId:
    `chat.bubble.${'me' | 'you'}.${'first' | 'grouped'}.${'normal' | 'pressed'}`;
  point: readonly [number, number];
  insets: readonly [number, number, number, number];
}

export interface DecodedIosCss {
  metadata: {
    name?: string;
    author?: string;
    version?: string;
    themeId?: string;
    appearance: 'light' | 'dark';
  };
  colorValues: Record<string, string>;
  importedColorBindings: ReadonlySet<string>;
  themeColors: Partial<ThemeProject['colors']>;
  screenColors: Partial<Record<ScreenId, string>>;
  bubbleTextColors: Partial<Record<'me' | 'you', string>>;
  unreadColor?: string;
  referencedFiles: Record<string, readonly string[]>;
  bubbleGuides: readonly IosBubbleGuideDeclaration[];
}

function cssBlock(css: string, block: string) {
  return css.match(new RegExp(`${block.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? '';
}

function cssValue(css: string, block: string, property: string) {
  const body = cssBlock(css, block);
  return body.match(new RegExp(`${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+)`))?.[1].trim();
}

function color(value: string | undefined) {
  return value?.match(/#[0-9a-f]{6,8}/i)?.[0];
}

function quoted(value: string | undefined) {
  return value?.match(/['"]([^'"]+)['"]/)?.[1];
}

function quotedValues(value: string | undefined) {
  return [...(value ?? '').matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function numbers(value: string | undefined) {
  return [...(value ?? '').matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
}

function referencedFiles(resourceId: string, css: string) {
  const binding = KAKAO_RESOURCE_SLOTS.find((slot) => slot.id === resourceId)?.ios;
  if (!binding?.css) return [];
  const references = quotedValues(cssValue(css, binding.css.block, binding.css.property));
  const profile = resourceId.match(/^main\.profile\.(0[1-3])$/)?.[1];
  const reference = profile ? references[Number(profile) - 1] : references[0];
  if (!reference) return [];
  const normalized = reference.replace(/^\.\//, '').replace(/^Images\//i, '');
  const extension = path.extname(normalized) || '.png';
  const stem = normalized.slice(0, normalized.length - extension.length);
  const names = /@\d+x$/i.test(stem)
    ? [normalized]
    : [`${stem}@3x${extension}`, `${stem}@2x${extension}`, normalized];
  return names.map((name) => `Images/${name}`);
}

const BUBBLE_GUIDE_CONFIGS = [
  ['me', 'Send', 'first', 'normal', '-ios-background-image', '-ios-title-edgeinsets'],
  ['me', 'Send', 'first', 'pressed', '-ios-selected-background-image', '-ios-title-edgeinsets'],
  ['me', 'Send', 'grouped', 'normal', '-ios-group-background-image', '-ios-group-title-edgeinsets'],
  ['me', 'Send', 'grouped', 'pressed', '-ios-group-selected-background-image', '-ios-group-title-edgeinsets'],
  ['you', 'Receive', 'first', 'normal', '-ios-background-image', '-ios-title-edgeinsets'],
  ['you', 'Receive', 'first', 'pressed', '-ios-selected-background-image', '-ios-title-edgeinsets'],
  ['you', 'Receive', 'grouped', 'normal', '-ios-group-background-image', '-ios-group-title-edgeinsets'],
  ['you', 'Receive', 'grouped', 'pressed', '-ios-group-selected-background-image', '-ios-group-title-edgeinsets'],
] as const;

export function decodeIosCss(css: string): DecodedIosCss {
  const colorValues: Record<string, string> = {};
  const importedColorBindings = new Set<string>();
  for (const binding of Object.keys(IOS_DEFAULT_COLORS)) {
    const separator = binding.indexOf('|');
    const parsed = color(cssValue(css, binding.slice(0, separator), binding.slice(separator + 1)));
    if (parsed) {
      colorValues[binding] = parsed;
      importedColorBindings.add(binding);
    }
  }
  for (const binding of Object.keys(IOS_SAMPLE_ALPHAS)) {
    const separator = binding.indexOf('|');
    const parsed = cssValue(css, binding.slice(0, separator), binding.slice(separator + 1))?.trim();
    if (parsed && /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(parsed)) colorValues[binding] = parsed;
  }

  const main = color(cssValue(css, 'MainViewStyle-Primary', 'background-color'));
  const chat = color(cssValue(css, 'BackgroundStyle-ChatRoom', 'background-color'));
  const passcode = color(cssValue(css, 'BackgroundStyle-Passcode', 'background-color'));
  const screenColors: Partial<Record<ScreenId, string>> = {};
  if (main) for (const screen of ['friends', 'chats', 'now', 'more'] as const) screenColors[screen] = main;
  if (chat) {
    screenColors.chatroom = chat;
    screenColors.notification = chat;
  }
  if (passcode) screenColors.passcode = passcode;

  const bubbleGuides: IosBubbleGuideDeclaration[] = [];
  for (const [side, direction, sequence, state, imageProperty, insetProperty] of BUBBLE_GUIDE_CONFIGS) {
    const point = numbers(cssValue(css, `MessageCellStyle-${direction}`, imageProperty)).slice(-2);
    const insets = numbers(cssValue(css, `MessageCellStyle-${direction}`, insetProperty));
    if (point.length !== 2 || insets.length !== 4) continue;
    bubbleGuides.push({
      resourceId: `chat.bubble.${side}.${sequence}.${state}`,
      point: point as [number, number],
      insets: insets as [number, number, number, number],
    });
  }

  return {
    metadata: {
      name: quoted(cssValue(css, 'ManifestStyle', '-kakaotalk-theme-name')),
      author: quoted(cssValue(css, 'ManifestStyle', '-kakaotalk-author-name')),
      version: quoted(cssValue(css, 'ManifestStyle', '-kakaotalk-theme-version')),
      themeId: quoted(cssValue(css, 'ManifestStyle', '-kakaotalk-theme-id')),
      appearance: quoted(cssValue(css, 'ManifestStyle', '-kakaotalk-theme-style')) === 'dark' ? 'dark' : 'light',
    },
    colorValues,
    importedColorBindings,
    themeColors: {
      header: color(cssValue(css, 'HeaderStyle-Main', '-ios-text-color')),
      primaryText: color(cssValue(css, 'MainViewStyle-Primary', '-ios-text-color')),
      secondaryText: color(cssValue(css, 'MainViewStyle-Primary', '-ios-description-text-color')),
      inputBar: color(cssValue(css, 'InputBarStyle-Chat', 'background-color')),
      accent: color(cssValue(css, 'InputBarStyle-Chat', '-ios-send-normal-background-color')),
    },
    screenColors,
    bubbleTextColors: {
      me: color(cssValue(css, 'MessageCellStyle-Send', '-ios-text-color')),
      you: color(cssValue(css, 'MessageCellStyle-Receive', '-ios-text-color')),
    },
    unreadColor: color(cssValue(css, 'MessageCellStyle-Send', '-ios-unread-text-color')),
    referencedFiles: Object.fromEntries(
      KAKAO_RESOURCE_SLOTS.map((slot) => [slot.id, referencedFiles(slot.id, css)]),
    ),
    bubbleGuides,
  };
}

export function resolveIosBubbleGuides(
  declaration: IosBubbleGuideDeclaration,
  asset: Pick<ImageAsset, 'width' | 'height' | 'sourceScale'>,
): NinePatchGuides | undefined {
  if (!asset.width || !asset.height) return undefined;
  const scale = asset.sourceScale ?? 1;
  const [pointX, pointY] = declaration.point;
  const [top, left, bottom, right] = declaration.insets;
  const x = (pointX * scale) / asset.width;
  const y = (pointY * scale) / asset.height;
  return {
    stretch: { x: [x, Math.min(1, x + scale / asset.width)], y: [y, Math.min(1, y + scale / asset.height)] },
    content: {
      left: (left * scale) / asset.width,
      top: (top * scale) / asset.height,
      right: (asset.width - right * scale) / asset.width,
      bottom: (asset.height - bottom * scale) / asset.height,
    },
  };
}
