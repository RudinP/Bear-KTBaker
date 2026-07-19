import JSZip from 'jszip';
import { createDefaultTheme } from '../../domain/theme/defaults';
import { migrateLegacyNowTabAssets } from '../../domain/theme/migrations/legacyNowTabAssets';
import type { ThemeProject } from '../../domain/theme/model';
import type { NinePatchGuides } from '../../domain/ninePatch';
import {
  decodeIosCss,
  resolveIosBubbleGuides,
  type DecodedIosCss,
} from './iosCssDecoder';
import {
  importMappedImages,
  type RecoveredMappedImage,
} from './mappedImageImporter';
import { ThemeImportFailure } from './importFailure';
import { mirrorSemanticColors, mirrorSemanticResources } from './semanticMirror';

function setBubbleGuides(
  project: ThemeProject,
  resourceId: string,
  guides: NinePatchGuides,
) {
  const match = resourceId.match(
    /^chat\.bubble\.(me|you)\.(first|grouped)\.(normal|pressed)$/,
  );
  if (!match) return;
  const [, side, sequence, state] = match as [
    string,
    'me' | 'you',
    'first' | 'grouped',
    'normal' | 'pressed',
  ];
  const key: keyof ThemeProject['chat']['bubbles']['me'] =
    sequence === 'grouped'
      ? state === 'pressed'
        ? 'groupedPressed'
        : 'grouped'
      : state;
  const appearance = project.chat.bubbles[side][key];
  appearance.stretch = guides;
  appearance.stretchByPlatform = {
    ...appearance.stretchByPlatform,
    ios: guides,
  };
}

function applyIosCss(project: ThemeProject, decoded: DecodedIosCss) {
  project.meta.name = decoded.metadata.name ?? project.meta.name;
  project.meta.author = decoded.metadata.author ?? '';
  project.meta.version = decoded.metadata.version ?? project.meta.version;
  project.meta.themeId = decoded.metadata.themeId ?? project.meta.themeId;
  project.meta.appearance = decoded.metadata.appearance;
  Object.assign(project.colorValues.ios, decoded.colorValues);
  Object.assign(
    project.colors,
    Object.fromEntries(
      Object.entries(decoded.themeColors).filter(
        ([, value]) => value !== undefined,
      ),
    ),
  );
  for (const [screen, color] of Object.entries(decoded.screenColors)) {
    if (color) {
      project.screens[screen as keyof ThemeProject['screens']].background = {
        kind: 'color',
        color,
      };
    }
  }
  if (decoded.bubbleTextColors.me) {
    project.chat.bubbles.me.normal.textColor = decoded.bubbleTextColors.me;
  }
  if (decoded.bubbleTextColors.you) {
    project.chat.bubbles.you.normal.textColor = decoded.bubbleTextColors.you;
  }
  if (decoded.unreadColor) project.chat.unreadColor = decoded.unreadColor;
}

function applyRecoveredImages(
  project: ThemeProject,
  images: readonly RecoveredMappedImage[],
) {
  for (const { resourceId, asset, guides } of images) {
    if (guides) setBubbleGuides(project, resourceId, guides);
    project.resources[resourceId] = asset;
    project.platformResources.ios[resourceId] = asset;
  }
}

function applyBubbleGuides(project: ThemeProject, decoded: DecodedIosCss) {
  for (const declaration of decoded.bubbleGuides) {
    const asset = project.resources[declaration.resourceId];
    const guides = asset && resolveIosBubbleGuides(declaration, asset);
    if (guides) setBubbleGuides(project, declaration.resourceId, guides);
  }
}

async function loadIosArchive(source: Uint8Array) {
  try {
    return await JSZip.loadAsync(source);
  } catch (error) {
    if (error instanceof ThemeImportFailure) throw error;
    throw new ThemeImportFailure({
      kind: 'ios-archive',
      message: 'iPhone 테마 압축 파일을 읽지 못했습니다.',
      cause: error,
    });
  }
}

async function decodeArchiveCss(zip: JSZip) {
  try {
    const css = await zip.file('KakaoTalkTheme.css')?.async('string');
    if (!css?.trim()) {
      throw new ThemeImportFailure({
        kind: 'ios-css',
        message: 'KakaoTalkTheme.css가 없는 iPhone 테마입니다.',
      });
    }
    return decodeIosCss(css);
  } catch (error) {
    if (error instanceof ThemeImportFailure) throw error;
    throw new ThemeImportFailure({
      kind: 'ios-css',
      message: 'iPhone 테마 CSS를 읽지 못했습니다.',
      cause: error,
    });
  }
}

export async function importIosKtheme(
  source: Uint8Array,
  suggestedName: string,
): Promise<ThemeProject> {
  const zip = await loadIosArchive(source);
  const decoded = await decodeArchiveCss(zip);
  const project = createDefaultTheme(
    suggestedName.replace(/\.ktheme$/i, ''),
    false,
  );
  applyIosCss(project, decoded);
  const importedImages = await importMappedImages({
    platform: 'ios',
    archiveKind: 'ios',
    zip,
    referencedFiles: decoded.referencedFiles,
  });
  applyRecoveredImages(project, importedImages.images);
  migrateLegacyNowTabAssets(project);
  applyBubbleGuides(project, decoded);
  mirrorSemanticResources(project, 'ios');
  mirrorSemanticColors(project, 'ios', new Set(decoded.importedColorBindings));
  return project;
}
