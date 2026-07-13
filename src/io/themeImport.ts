import path from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { createDefaultTheme, migrateLegacyNowTabAssets, type BubbleAppearance, type ThemeProject } from '../domain/theme';
import type { NinePatchGuides } from '../domain/ninePatch';
import { KAKAO_RESOURCE_SLOTS, type PlatformResourceBinding } from '../manifest/kakaoResources';
import { ANDROID_SAMPLE_COLORS, IOS_DEFAULT_COLORS, IOS_SAMPLE_ALPHAS, KAKAO_COLOR_SLOTS } from '../manifest/kakaoColors';
import {
  inspectCompiledAndroidApk,
  type AndroidCompiledMetadata,
} from './androidCompiledMetadata';
import { parseCompiledNinePatchPng, parseNinePatchPng, stripNinePatchBorder } from './ninePatchPng';

export { inspectCompiledAndroidApk } from './androidCompiledMetadata';
export type { AndroidCompiledMetadata } from './androidCompiledMetadata';

export type ThemeImportKind = 'project' | 'ios' | 'android-apk' | 'android-source';

export function detectThemeImportKind(fileName: string): ThemeImportKind {
  switch (path.extname(fileName).toLowerCase()) {
    case '.ktstudio': return 'project';
    case '.ktheme': return 'ios';
    case '.apk': return 'android-apk';
    case '.zip': return 'android-source';
    default: throw new Error('지원하지 않는 파일입니다. .ktstudio, .ktheme, .apk 또는 .zip 파일을 선택해 주세요.');
  }
}

function dataUrl(buffer: Buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function preferredFile(binding: PlatformResourceBinding, platform: 'ios' | 'android') {
  if (platform === 'ios') return binding.files.find((file) => file.includes('@3x.')) ?? binding.files[0];
  return binding.files.find((file) => file.includes('/mipmap-xxhdpi/'))
    ?? binding.files.find((file) => file.includes('/drawable-xxhdpi/'))
    ?? binding.files[0];
}

function compiledAndroidPath(sourcePath: string) {
  const theme = sourcePath.match(/^src\/main\/theme\/([^/]+)\/(.+)$/);
  if (theme) {
    const [, qualifier, name] = theme;
    const version = qualifier.includes('sw600dp') ? '-v13' : qualifier.startsWith('drawable-') ? '-v4' : '';
    return `res/${qualifier}${version}/${name}`;
  }
  const res = sourcePath.match(/^src\/main\/res\/(mipmap-[^/]+)\/(.+)$/);
  if (res) return `res/${res[1]}-v4/${res[2]}`;
  return undefined;
}

function orderedFiles(binding: PlatformResourceBinding, platform: 'ios' | 'android') {
  const preferred = preferredFile(binding, platform);
  return preferred ? [preferred, ...binding.files.filter((file) => file !== preferred)] : binding.files;
}

function importedSourceScale(resourceId: string, platform: 'ios' | 'android', fileName: string) {
  const iosScale = fileName.match(/@(\d+)x(?=\.[^.]+$)/i)?.[1];
  if (platform === 'ios') return iosScale ? Number(iosScale) : 1;
  if (['main.background', 'chat.background', 'passcode.background', 'main.tab.background', 'splash.image'].includes(resourceId)) return 4;
  if (/drawable-xhdpi/i.test(fileName)) return 2;
  if (/drawable-xxxhdpi/i.test(fileName)) return 4;
  return 3;
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

function iosGuides(width: number, height: number, scale: number, point: number[], insets: number[]): NinePatchGuides {
  const x = (point[0] * scale) / width;
  const y = (point[1] * scale) / height;
  const [top, left, bottom, right] = insets;
  return {
    stretch: { x: [x, Math.min(1, x + scale / width)], y: [y, Math.min(1, y + scale / height)] },
    content: {
      left: (left * scale) / width,
      top: (top * scale) / height,
      right: (width - right * scale) / width,
      bottom: (height - bottom * scale) / height,
    },
  };
}

function setBubbleGuides(project: ThemeProject, resourceId: string, guides: NinePatchGuides, platform: 'ios' | 'android') {
  const match = resourceId.match(/^chat\.bubble\.(me|you)\.(first|grouped)\.(normal|pressed)$/);
  if (!match) return;
  const [, side, sequence, state] = match as [string, 'me' | 'you', 'first' | 'grouped', 'normal' | 'pressed'];
  const key: keyof ThemeProject['chat']['bubbles']['me'] = sequence === 'grouped' ? (state === 'pressed' ? 'groupedPressed' : 'grouped') : state;
  const appearance = project.chat.bubbles[side][key];
  appearance.stretch = guides;
  appearance.stretchByPlatform = { ...appearance.stretchByPlatform, [platform]: guides };
}

function iosReferencedFiles(resourceId: string, binding: PlatformResourceBinding, css: string | undefined) {
  if (!css || !binding.css) return [];
  const references = quotedValues(cssValue(css, binding.css.block, binding.css.property));
  const profile = resourceId.match(/^main\.profile\.(0[1-3])$/)?.[1];
  const reference = profile ? references[Number(profile) - 1] : references[0];
  if (!reference) return [];
  const normalized = reference.replace(/^\.\//, '').replace(/^Images\//i, '');
  const extension = path.extname(normalized) || '.png';
  const stem = normalized.slice(0, normalized.length - extension.length);
  const hasScale = /@\d+x$/i.test(stem);
  const names = hasScale
    ? [normalized]
    : [`${stem}@3x${extension}`, `${stem}@2x${extension}`, normalized];
  return names.map((name) => `Images/${name}`);
}

async function importMappedImages(
  zip: JSZip,
  project: ThemeProject,
  platform: 'ios' | 'android',
  iosCss?: string,
) {
  for (const slot of KAKAO_RESOURCE_SLOTS) {
    const binding = slot[platform];
    if (!binding || binding.files.length === 0) continue;
    let file: string | undefined;
    let entry: JSZip.JSZipObject | null = null;
    let compiled = false;
    const candidates = platform === 'ios'
      ? [...iosReferencedFiles(slot.id, binding, iosCss), ...orderedFiles(binding, platform)]
      : orderedFiles(binding, platform);
    for (const candidate of [...new Set(candidates)]) {
      entry = zip.file(candidate);
      file = candidate;
      if (entry) break;
      const apkPath = platform === 'android' ? compiledAndroidPath(candidate) : undefined;
      if (apkPath) {
        entry = zip.file(apkPath);
        if (entry) { file = apkPath; compiled = true; break; }
      }
    }
    if (!file || !entry) continue;
    const source = await entry.async('nodebuffer');
    if (platform === 'android' && binding.ninePatch) {
      const png = PNG.sync.read(source);
      const parsed = compiled && slot.id.startsWith('chat.bubble.')
        ? parseCompiledNinePatchPng(source)
        : compiled ? { width: png.width, height: png.height, guides: undefined }
          : parseNinePatchPng(source);
      if (parsed.guides) setBubbleGuides(project, slot.id, parsed.guides, platform);
      const preview = compiled ? source : stripNinePatchBorder(source);
      const asset = {
        fileName: path.basename(file).replace('.9.png', '.png'),
        dataUrl: dataUrl(preview),
        width: parsed.width,
        height: parsed.height,
        sourceScale: importedSourceScale(slot.id, platform, file),
        rawNinePatch: false,
      };
      project.resources[slot.id] = asset;
      project.platformResources[platform][slot.id] = asset;
    } else {
      const png = PNG.sync.read(source);
      const asset = {
        fileName: path.basename(file),
        dataUrl: dataUrl(source),
        width: png.width,
        height: png.height,
        sourceScale: importedSourceScale(slot.id, platform, file),
        rawNinePatch: false,
      };
      project.resources[slot.id] = asset;
      project.platformResources[platform][slot.id] = asset;
    }
  }
}

function applyIosColors(project: ThemeProject, css: string) {
  const parsedBindings = new Set<string>();
  for (const binding of Object.keys(IOS_DEFAULT_COLORS)) {
    const separator = binding.indexOf('|');
    const parsed = color(cssValue(css, binding.slice(0, separator), binding.slice(separator + 1)));
    if (parsed) {
      project.colorValues.ios[binding] = parsed;
      parsedBindings.add(binding);
    }
  }
  for (const binding of Object.keys(IOS_SAMPLE_ALPHAS)) {
    const separator = binding.indexOf('|');
    const parsed = cssValue(css, binding.slice(0, separator), binding.slice(separator + 1))?.trim();
    if (parsed && /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(parsed)) project.colorValues.ios[binding] = parsed;
  }
  project.colors.header = color(cssValue(css, 'HeaderStyle-Main', '-ios-text-color')) ?? project.colors.header;
  project.colors.primaryText = color(cssValue(css, 'MainViewStyle-Primary', '-ios-text-color')) ?? project.colors.primaryText;
  project.colors.secondaryText = color(cssValue(css, 'MainViewStyle-Primary', '-ios-description-text-color')) ?? project.colors.secondaryText;
  project.colors.inputBar = color(cssValue(css, 'InputBarStyle-Chat', 'background-color')) ?? project.colors.inputBar;
  project.colors.accent = color(cssValue(css, 'InputBarStyle-Chat', '-ios-send-normal-background-color')) ?? project.colors.accent;
  const main = color(cssValue(css, 'MainViewStyle-Primary', 'background-color'));
  const chat = color(cssValue(css, 'BackgroundStyle-ChatRoom', 'background-color'));
  const passcode = color(cssValue(css, 'BackgroundStyle-Passcode', 'background-color'));
  if (main) for (const screen of ['friends', 'chats', 'now', 'more'] as const) project.screens[screen].background = { kind: 'color', color: main };
  if (chat) project.screens.chatroom.background = { kind: 'color', color: chat };
  if (chat) project.screens.notification.background = { kind: 'color', color: chat };
  if (passcode) project.screens.passcode.background = { kind: 'color', color: passcode };
  project.chat.bubbles.me.normal.textColor = color(cssValue(css, 'MessageCellStyle-Send', '-ios-text-color')) ?? project.chat.bubbles.me.normal.textColor;
  project.chat.bubbles.you.normal.textColor = color(cssValue(css, 'MessageCellStyle-Receive', '-ios-text-color')) ?? project.chat.bubbles.you.normal.textColor;
  project.chat.unreadColor = color(cssValue(css, 'MessageCellStyle-Send', '-ios-unread-text-color')) ?? project.chat.unreadColor;
  return parsedBindings;
}

function copyGuides(guides: NinePatchGuides): NinePatchGuides {
  return {
    stretch: { x: [...guides.stretch.x] as [number, number], y: [...guides.stretch.y] as [number, number] },
    content: { ...guides.content },
  };
}

function bubbleAppearance(project: ThemeProject, resourceId: string): BubbleAppearance | undefined {
  const match = resourceId.match(/^chat\.bubble\.(me|you)\.(first|grouped)\.(normal|pressed)$/);
  if (!match) return undefined;
  const [, side, sequence, state] = match as [string, 'me' | 'you', 'first' | 'grouped', 'normal' | 'pressed'];
  const key: keyof ThemeProject['chat']['bubbles']['me'] = sequence === 'grouped'
    ? (state === 'pressed' ? 'groupedPressed' : 'grouped')
    : state;
  return project.chat.bubbles[side][key];
}

function mirrorSemanticResources(project: ThemeProject, source: 'ios' | 'android') {
  const target = source === 'ios' ? 'android' : 'ios';
  for (const slot of KAKAO_RESOURCE_SLOTS) {
    const sourceBinding = slot[source];
    const targetBinding = slot[target];
    if (!sourceBinding?.files.length || !targetBinding?.files.length) continue;
    const asset = project.platformResources[source][slot.id];
    if (!asset || project.platformResources[target][slot.id]) continue;
    project.platformResources[target][slot.id] = { ...asset };

    const appearance = bubbleAppearance(project, slot.id);
    const guides = appearance?.stretchByPlatform?.[source] ?? appearance?.stretch;
    if (appearance && guides) {
      const mirrored = copyGuides(guides);
      appearance.stretchByPlatform = { ...appearance.stretchByPlatform, [target]: mirrored };
    }
  }
}

function rgb(value: string | undefined) {
  const match = value?.match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  return match ? match.slice(-6).toUpperCase() : undefined;
}

function withPreservedTargetAlpha(value: string | undefined, sourceRgb: string) {
  const match = value?.match(/^#([0-9a-f]{8})$/i)?.[1];
  return match ? `#${match.slice(0, 2).toUpperCase()}${sourceRgb}` : `#${sourceRgb}`;
}

function mirrorSemanticColors(project: ThemeProject, source: 'ios' | 'android', imported: Set<string>) {
  const target = source === 'ios' ? 'android' : 'ios';
  for (const slot of KAKAO_COLOR_SLOTS) {
    const sourceKeys = slot[source];
    const targetKeys = slot[target];
    if (!sourceKeys.length || !targetKeys.length) continue;
    const sourceKey = sourceKeys.find((key) => imported.has(key));
    const sourceRgb = sourceKey ? rgb(project.colorValues[source][sourceKey]) : undefined;
    if (!sourceRgb) continue;
    for (const key of targetKeys) {
      project.colorValues[target][key] = withPreservedTargetAlpha(project.colorValues[target][key], sourceRgb);
    }
  }
}

function applyIosBubbleGuides(project: ThemeProject, css: string) {
  const configs = [
    ['me', 'Send', 'first', 'normal', '-ios-background-image', '-ios-title-edgeinsets'],
    ['me', 'Send', 'first', 'pressed', '-ios-selected-background-image', '-ios-title-edgeinsets'],
    ['me', 'Send', 'grouped', 'normal', '-ios-group-background-image', '-ios-group-title-edgeinsets'],
    ['me', 'Send', 'grouped', 'pressed', '-ios-group-selected-background-image', '-ios-group-title-edgeinsets'],
    ['you', 'Receive', 'first', 'normal', '-ios-background-image', '-ios-title-edgeinsets'],
    ['you', 'Receive', 'first', 'pressed', '-ios-selected-background-image', '-ios-title-edgeinsets'],
    ['you', 'Receive', 'grouped', 'normal', '-ios-group-background-image', '-ios-group-title-edgeinsets'],
    ['you', 'Receive', 'grouped', 'pressed', '-ios-group-selected-background-image', '-ios-group-title-edgeinsets'],
  ] as const;
  for (const [side, direction, sequence, state, imageProperty, insetProperty] of configs) {
    const id = `chat.bubble.${side}.${sequence}.${state}`;
    const asset = project.resources[id];
    if (!asset?.width || !asset.height) continue;
    const point = numbers(cssValue(css, `MessageCellStyle-${direction}`, imageProperty)).slice(-2);
    const insets = numbers(cssValue(css, `MessageCellStyle-${direction}`, insetProperty));
    if (point.length !== 2 || insets.length !== 4) continue;
    const scale = /@3x/.test(asset.fileName) ? 3 : /@2x/.test(asset.fileName) ? 2 : 1;
    setBubbleGuides(project, id, iosGuides(asset.width, asset.height, scale, point, insets), 'ios');
  }
}

export async function importIosKtheme(source: Buffer, suggestedName: string) {
  const zip = await JSZip.loadAsync(source);
  const css = await zip.file('KakaoTalkTheme.css')?.async('string');
  if (!css) throw new Error('KakaoTalkTheme.css가 없는 iPhone 테마입니다.');
  const project = createDefaultTheme(suggestedName.replace(/\.ktheme$/i, ''), false);
  project.meta.name = quoted(cssValue(css, 'ManifestStyle', '-kakaotalk-theme-name')) ?? project.meta.name;
  project.meta.author = quoted(cssValue(css, 'ManifestStyle', '-kakaotalk-author-name')) ?? '';
  project.meta.version = quoted(cssValue(css, 'ManifestStyle', '-kakaotalk-theme-version')) ?? project.meta.version;
  project.meta.themeId = quoted(cssValue(css, 'ManifestStyle', '-kakaotalk-theme-id')) ?? project.meta.themeId;
  project.meta.appearance = quoted(cssValue(css, 'ManifestStyle', '-kakaotalk-theme-style')) === 'dark' ? 'dark' : 'light';
  const importedColors = applyIosColors(project, css);
  await importMappedImages(zip, project, 'ios', css);
  migrateLegacyNowTabAssets(project);
  applyIosBubbleGuides(project, css);
  mirrorSemanticResources(project, 'ios');
  mirrorSemanticColors(project, 'ios', importedColors);
  return project;
}

function xmlColor(xml: string, name: string) {
  return xml.match(new RegExp(`<color\\s+name=["']${name}["']\\s*>([^<]+)</color>`))?.[1].trim();
}

function decodeXmlText(value: string | undefined) {
  return value?.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_entity, numeric: string | undefined, named: string | undefined) => {
    if (numeric) {
      const codePoint = numeric[0].toLowerCase() === 'x'
        ? Number.parseInt(numeric.slice(1), 16)
        : Number.parseInt(numeric, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _entity;
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[(named ?? '').toLowerCase()] ?? _entity;
  });
}

function applyAndroidColors(project: ThemeProject, values: Record<string, string>) {
  const parsedBindings = new Set<string>();
  for (const [name, value] of Object.entries(values)) {
    if (name in ANDROID_SAMPLE_COLORS) {
      project.colorValues.android[name] = value;
      parsedBindings.add(name);
    }
  }
  project.colors.header = values.theme_header_color ?? project.colors.header;
  project.colors.primaryText = values.theme_title_color ?? project.colors.primaryText;
  project.colors.secondaryText = values.theme_description_color ?? project.colors.secondaryText;
  project.colors.inputBar = values.theme_chatroom_input_bar_background_color ?? project.colors.inputBar;
  project.colors.accent = values.theme_chatroom_input_bar_send_button_color ?? project.colors.accent;
  project.colors.notificationBackground = values.theme_notification_background_color ?? project.colors.notificationBackground;
  project.colors.notificationTitle = values.theme_notification_color ?? project.colors.notificationTitle;
  project.colors.notificationMessage = values.theme_notification_color ?? project.colors.notificationMessage;
  const main = values.theme_background_color;
  const chat = values.theme_chatroom_background_color;
  const passcode = values.theme_passcode_background_color;
  if (main) for (const screen of ['friends', 'chats', 'now', 'more'] as const) project.screens[screen].background = { kind: 'color', color: main };
  if (chat) project.screens.chatroom.background = { kind: 'color', color: chat };
  if (chat) project.screens.notification.background = { kind: 'color', color: chat };
  if (passcode) project.screens.passcode.background = { kind: 'color', color: passcode };
  return parsedBindings;
}

export async function importAndroidSourceZip(source: Buffer, suggestedName: string, compiledMetadata?: AndroidCompiledMetadata) {
  const zip = await JSZip.loadAsync(source);
  const project = createDefaultTheme(suggestedName.replace(/\.(zip|apk)$/i, ''), false);
  await importMappedImages(zip, project, 'android');
  migrateLegacyNowTabAssets(project);
  let importedColors = new Set<string>();
  const manifest = await zip.file('src/main/AndroidManifest.xml')?.async('string');
  project.meta.appearance = manifest && /<meta-data\b(?=[^>]*android:name=["']com\.kakao\.talk\.theme_style["'])(?=[^>]*android:value=["']dark["'])[^>]*\/>/i.test(manifest)
    ? 'dark'
    : 'light';
  if (compiledMetadata?.appearance) project.meta.appearance = compiledMetadata.appearance;
  const colors = await zip.file('src/main/theme/values/colors.xml')?.async('string');
  if (colors) {
    const parsedColors: Record<string, string> = {};
    for (const name of Object.keys(ANDROID_SAMPLE_COLORS)) {
      const parsed = xmlColor(colors, name);
      if (parsed) parsedColors[name] = parsed;
    }
    importedColors = applyAndroidColors(project, parsedColors);
  } else if (compiledMetadata?.colors) {
    importedColors = applyAndroidColors(project, compiledMetadata.colors);
  }
  const strings = await zip.file('src/main/theme/values/strings.xml')?.async('string');
  const title = decodeXmlText(strings?.match(/<string\s+name=["']theme_title["']>([^<]+)</)?.[1]);
  const gradle = await (zip.file('build.gradle.kts') ?? zip.file('build.gradle'))?.async('string');
  const sourceVersion = gradle?.match(/\bversionName\s*(?:=\s*)?["']([^"']+)["']/)?.[1]
    ?? manifest?.match(/\bandroid:versionName=["']([^"']+)["']/)?.[1];
  const sourceThemeId = gradle?.match(/\bapplicationId\s*(?:=\s*)?["']([^"']+)["']/)?.[1]
    ?? manifest?.match(/\bpackage=["']([^"']+)["']/)?.[1]
    ?? gradle?.match(/\bnamespace\s*(?:=\s*)?["']([^"']+)["']/)?.[1];
  if (title || compiledMetadata?.name) project.meta.name = title ?? compiledMetadata!.name!;
  if (compiledMetadata?.version || sourceVersion) project.meta.version = compiledMetadata?.version ?? sourceVersion!;
  if (compiledMetadata?.themeId || sourceThemeId) project.meta.themeId = compiledMetadata?.themeId ?? sourceThemeId!;
  mirrorSemanticResources(project, 'android');
  mirrorSemanticColors(project, 'android', importedColors);
  return project;
}

export async function importAndroidThemeArchive(source: Buffer, suggestedName: string, compiledMetadata?: AndroidCompiledMetadata) {
  const project = await importAndroidSourceZip(source, suggestedName, compiledMetadata);
  const hasMappedImage = Object.keys(project.platformResources.android).length > 0;
  const hasCompiledThemeColor = Object.keys(compiledMetadata?.colors ?? {})
    .some((name) => name in ANDROID_SAMPLE_COLORS);
  let hasSourceThemeColor = false;
  if (!hasMappedImage && !hasCompiledThemeColor) {
    const zip = await JSZip.loadAsync(source);
    const colors = await zip.file('src/main/theme/values/colors.xml')?.async('string');
    hasSourceThemeColor = Object.keys(ANDROID_SAMPLE_COLORS)
      .some((name) => new RegExp(`<color\\s+name=["']${name}["']`).test(colors ?? ''));
  }
  if (!hasMappedImage && !hasCompiledThemeColor && !hasSourceThemeColor) {
    throw new Error('카카오톡 Android 테마 리소스를 찾지 못했습니다. APK 또는 Android 테마 소스 ZIP을 확인해 주세요.');
  }
  return project;
}
