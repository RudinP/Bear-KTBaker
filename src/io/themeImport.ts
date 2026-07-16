import path from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { createDefaultTheme, migrateLegacyNowTabAssets, type ImageAsset, type ThemeProject } from '../domain/theme';
import type { NinePatchGuides } from '../domain/ninePatch';
import {
  KAKAO_RESOURCE_SLOTS,
  type KakaoResourceSlot,
  type PlatformResourceBinding,
} from '../manifest/kakaoResources';
import { ANDROID_SAMPLE_COLORS, IOS_DEFAULT_COLORS, IOS_SAMPLE_ALPHAS, KAKAO_COLOR_SLOTS } from '../manifest/kakaoColors';
import {
  androidPngCandidates,
  androidResourceIdentity,
  createAndroidArchiveIndex,
  isAndroidPngPath,
} from './androidArchiveResources';
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

interface MappedImageImportResult {
  mappedIds: Set<string>;
  failedResources: FailedAndroidResource[];
}

interface FailedAndroidResource {
  resourceKey: string;
  referencedPaths: string[];
  errors: string[];
}

interface MappedImageCandidate {
  path: string;
  entry: JSZip.JSZipObject;
  compiled: boolean;
}

interface DecodedMappedImage {
  asset: ImageAsset;
  guides?: NinePatchGuides;
}

function iosImageCandidates(
  zip: JSZip,
  resourceId: string,
  binding: PlatformResourceBinding,
  iosCss?: string,
): MappedImageCandidate[] {
  return [...new Set([
    ...iosReferencedFiles(resourceId, binding, iosCss),
    ...orderedFiles(binding, 'ios'),
  ])].flatMap((candidate) => {
    const entry = zip.file(candidate);
    return entry ? [{ path: candidate, entry, compiled: false }] : [];
  });
}

async function decodeMappedImage(
  platform: 'ios' | 'android',
  slot: KakaoResourceSlot,
  candidate: MappedImageCandidate,
): Promise<DecodedMappedImage> {
  const binding = slot[platform]!;
  const source = await candidate.entry.async('nodebuffer');
  if (platform === 'android' && binding.ninePatch) {
    const png = PNG.sync.read(source);
    const parsed = candidate.compiled && slot.id.startsWith('chat.bubble.')
      ? parseCompiledNinePatchPng(source)
      : candidate.compiled
        ? { width: png.width, height: png.height, guides: undefined }
        : parseNinePatchPng(source);
    const preview = candidate.compiled ? source : stripNinePatchBorder(source);
    return {
      asset: {
        fileName: path.basename(candidate.path).replace('.9.png', '.png'),
        dataUrl: dataUrl(preview),
        width: parsed.width,
        height: parsed.height,
        sourceScale: importedSourceScale(slot.id, platform, candidate.path),
        rawNinePatch: false,
      },
      guides: parsed.guides,
    };
  }
  const png = PNG.sync.read(source);
  return {
    asset: {
      fileName: path.basename(candidate.path),
      dataUrl: dataUrl(source),
      width: png.width,
      height: png.height,
      sourceScale: importedSourceScale(slot.id, platform, candidate.path),
      rawNinePatch: false,
    },
  };
}

function applyDecodedMappedImage(
  project: ThemeProject,
  platform: 'ios' | 'android',
  resourceId: string,
  decoded: DecodedMappedImage,
) {
  if (decoded.guides) setBubbleGuides(project, resourceId, decoded.guides, platform);
  project.resources[resourceId] = decoded.asset;
  project.platformResources[platform][resourceId] = decoded.asset;
}

async function importMappedImages(
  zip: JSZip,
  project: ThemeProject,
  platform: 'ios' | 'android',
  options: {
    archiveKind: 'ios' | 'source' | 'apk';
    resourceFiles?: Record<string, string[]>;
    iosCss?: string;
  },
): Promise<MappedImageImportResult> {
  const mappedIds = new Set<string>();
  const failedResources: FailedAndroidResource[] = [];
  const androidIndex = platform === 'android'
    ? createAndroidArchiveIndex(zip, options.archiveKind === 'apk' ? 'apk' : 'source')
    : undefined;

  for (const slot of KAKAO_RESOURCE_SLOTS) {
    const binding = slot[platform];
    if (!binding || binding.files.length === 0) continue;
    const candidates = platform === 'android'
      ? androidPngCandidates({
        index: androidIndex!,
        kind: options.archiveKind === 'apk' ? 'apk' : 'source',
        bindingFiles: orderedFiles(binding, platform),
        resourceFiles: options.resourceFiles,
      })
      : iosImageCandidates(zip, slot.id, binding, options.iosCss);
    const decodeErrors: string[] = [];
    let restored = false;
    for (const candidate of candidates) {
      let decoded: DecodedMappedImage;
      try {
        decoded = await decodeMappedImage(platform, slot, candidate);
      } catch (error) {
        decodeErrors.push(`${candidate.path}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      applyDecodedMappedImage(project, platform, slot.id, decoded);
      mappedIds.add(slot.id);
      restored = true;
      break;
    }
    if (!restored && platform === 'android') {
      const referencesByKey = new Map<string, string[]>();
      for (const file of binding.files) {
        const key = androidResourceIdentity(file)?.key;
        if (!key) continue;
        const paths = (options.resourceFiles?.[key] ?? []).filter(isAndroidPngPath);
        if (paths.length) referencesByKey.set(key, paths);
      }
      for (const [resourceKey, referencedPaths] of referencesByKey) {
        failedResources.push({
          resourceKey,
          referencedPaths,
          errors: [
            ...referencedPaths
              .filter((candidatePath) => !androidIndex!.find(candidatePath))
              .map((candidatePath) => `${candidatePath}: ZIP 엔트리 없음`),
            ...decodeErrors,
          ],
        });
      }
    }
  }
  return { mappedIds, failedResources };
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

function mirrorSemanticResources(project: ThemeProject, source: 'ios' | 'android') {
  const target = source === 'ios' ? 'android' : 'ios';
  for (const slot of KAKAO_RESOURCE_SLOTS) {
    const sourceBinding = slot[source];
    const targetBinding = slot[target];
    if (!sourceBinding?.files.length || !targetBinding?.files.length) continue;
    const asset = project.platformResources[source][slot.id];
    if (!asset || project.platformResources[target][slot.id]) continue;
    project.platformResources[target][slot.id] = { ...asset, mirroredFromPlatform: source };
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
  await importMappedImages(zip, project, 'ios', { archiveKind: 'ios', iosCss: css });
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

interface AndroidArchiveImport {
  zip: JSZip;
  project: ThemeProject;
  images: MappedImageImportResult;
  archiveKind: 'apk' | 'source';
  compiledMetadata?: AndroidCompiledMetadata;
}

async function importAndroidArchive(
  source: Buffer,
  suggestedName: string,
  archiveKind: 'apk' | 'source',
  compiledMetadata?: AndroidCompiledMetadata,
) {
  const zip = await JSZip.loadAsync(source);
  const project = createDefaultTheme(suggestedName.replace(/\.(zip|apk)$/i, ''), false);
  const images = await importMappedImages(zip, project, 'android', {
    archiveKind,
    resourceFiles: compiledMetadata?.resourceFiles,
  });
  return { zip, project, images, archiveKind, compiledMetadata } satisfies AndroidArchiveImport;
}

async function finishAndroidImport({
  zip,
  project,
  archiveKind,
  compiledMetadata,
}: AndroidArchiveImport): Promise<ThemeProject> {
  migrateLegacyNowTabAssets(project);
  let importedColors = new Set<string>();

  if (archiveKind === 'apk') {
    if (compiledMetadata?.appearance) project.meta.appearance = compiledMetadata.appearance;
    if (compiledMetadata?.colors) {
      importedColors = applyAndroidColors(project, compiledMetadata.colors);
    }
    if (compiledMetadata?.name) project.meta.name = compiledMetadata.name;
    if (compiledMetadata?.version) project.meta.version = compiledMetadata.version;
    if (compiledMetadata?.themeId) project.meta.themeId = compiledMetadata.themeId;
  } else {
    const manifest = await zip.file('src/main/AndroidManifest.xml')?.async('string');
    project.meta.appearance = manifest
      && /<meta-data\b(?=[^>]*android:name=["']com\.kakao\.talk\.theme_style["'])(?=[^>]*android:value=["']dark["'])[^>]*\/>/i.test(manifest)
      ? 'dark'
      : 'light';
    const colors = await zip.file('src/main/theme/values/colors.xml')?.async('string');
    if (colors) {
      const parsedColors: Record<string, string> = {};
      for (const name of Object.keys(ANDROID_SAMPLE_COLORS)) {
        const parsed = xmlColor(colors, name);
        if (parsed) parsedColors[name] = parsed;
      }
      importedColors = applyAndroidColors(project, parsedColors);
    }
    const strings = await zip.file('src/main/theme/values/strings.xml')?.async('string');
    const title = decodeXmlText(
      strings?.match(/<string\s+name=["']theme_title["']>([^<]+)</)?.[1],
    );
    const gradle = await (zip.file('build.gradle.kts') ?? zip.file('build.gradle'))?.async('string');
    const sourceVersion = gradle?.match(/\bversionName\s*(?:=\s*)?["']([^"']+)["']/)?.[1]
      ?? manifest?.match(/\bandroid:versionName=["']([^"']+)["']/)?.[1];
    const sourceThemeId = gradle?.match(/\bapplicationId\s*(?:=\s*)?["']([^"']+)["']/)?.[1]
      ?? manifest?.match(/\bpackage=["']([^"']+)["']/)?.[1]
      ?? gradle?.match(/\bnamespace\s*(?:=\s*)?["']([^"']+)["']/)?.[1];
    if (title) project.meta.name = title;
    if (sourceVersion) project.meta.version = sourceVersion;
    if (sourceThemeId) project.meta.themeId = sourceThemeId;
  }

  mirrorSemanticResources(project, 'android');
  mirrorSemanticColors(project, 'android', importedColors);
  return project;
}

export async function importAndroidSourceZip(
  source: Buffer,
  suggestedName: string,
) {
  const imported = await importAndroidArchive(source, suggestedName, 'source');
  return finishAndroidImport(imported);
}

export async function importAndroidThemeArchive(
  source: Buffer,
  suggestedName: string,
  compiledMetadata?: AndroidCompiledMetadata,
) {
  const imported = await importAndroidArchive(source, suggestedName, 'apk', compiledMetadata);
  const project = await finishAndroidImport(imported);
  if (imported.images.failedResources.length) {
    const details = imported.images.failedResources.map(({ resourceKey, referencedPaths, errors }) =>
      `${resourceKey} [${referencedPaths.join(', ')}]${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    throw new Error(`Android APK 이미지 리소스를 읽지 못했습니다: ${details.join('; ')}`);
  }
  if (imported.images.mappedIds.size === 0) {
    const hasCompiledThemeColor = Object.keys(compiledMetadata?.colors ?? {})
      .some((name) => name in ANDROID_SAMPLE_COLORS);
    if (hasCompiledThemeColor) {
      throw new Error('Android APK에서 테마 색상은 읽었지만 이미지 리소스를 복원하지 못했습니다. 원본 APK를 확인해 주세요.');
    }
    throw new Error('카카오톡 Android 테마 리소스를 찾지 못했습니다. APK 또는 Android 테마 소스 ZIP을 확인해 주세요.');
  }
  return project;
}
