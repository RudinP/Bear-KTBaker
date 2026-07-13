import { guidesToIosMetrics } from '../domain/ninePatch';
import type { ThemeProject } from '../domain/theme';
import { getResourceSlot } from '../manifest/kakaoResources';
import { resolveResourceAsset } from '../manifest/resourceResolver';

function safeCssText(value: string) {
  return value.replace(/[\\']/g, '').replace(/[;{}]/g, '');
}

function replaceProperty(css: string, property: string, value: string) {
  const pattern = new RegExp(`(${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*)([^;]*)(;)`);
  if (pattern.test(css)) return css.replace(pattern, `$1${value}$3`);
  return `${css.trimEnd()}\n    ${property}: ${value};\n`;
}

function replaceInBlock(css: string, block: string, property: string, value: string) {
  const pattern = new RegExp(`(${block.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:\\/\\*[\\s\\S]*?\\*\\/\\s*)?\\{)([\\s\\S]*?)(\\})`);
  return css.replace(pattern, (_all, start: string, body: string, end: string) =>
    `${start}${replaceProperty(body, property, value)}${end}`,
  );
}

function removeFromBlock(css: string, block: string, property: string) {
  const blockPattern = new RegExp(`(${block.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:\\/\\*[\\s\\S]*?\\*\\/\\s*)?\\{)([\\s\\S]*?)(\\})`);
  const propertyPattern = new RegExp(`\\s*${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*[^;]*;`);
  return css.replace(blockPattern, (_all, start: string, body: string, end: string) => `${start}${body.replace(propertyPattern, '')}${end}`);
}

export function buildIosCss(project: ThemeProject, template: string) {
  let css = template;
  css = replaceProperty(css, '-kakaotalk-theme-name', `'${safeCssText(project.meta.name)}'`);
  css = replaceProperty(css, '-kakaotalk-theme-version', `'${safeCssText(project.meta.version)}'`);
  css = replaceProperty(css, '-kakaotalk-author-name', `'${safeCssText(project.meta.author || 'Theme Studio')}'`);
  css = replaceProperty(css, '-kakaotalk-theme-id', `'${safeCssText(project.meta.themeId)}'`);
  css = project.meta.appearance === 'dark'
    ? replaceInBlock(css, 'ManifestStyle', '-kakaotalk-theme-style', "'dark'")
    : removeFromBlock(css, 'ManifestStyle', '-kakaotalk-theme-style');
  for (const [binding, value] of Object.entries(project.colorValues.ios)) {
    const separator = binding.indexOf('|');
    if (separator < 0) continue;
    css = replaceInBlock(css, binding.slice(0, separator), binding.slice(separator + 1), value);
  }
  const profiles = [1, 2, 3].filter((index) => (
    Boolean(project.platformResources.ios[`main.profile.0${index}`])
    || (index === 1 && project.baseSample === 'apeach')
  ));
  if (profiles.length) {
    css = replaceInBlock(css, 'DefaultProfileStyle', '-ios-profile-images', profiles.map((index) => `'profileImg0${index}.png'`).join(''));
  }

  const updateBubbles = (side: 'me' | 'you', block: 'MessageCellStyle-Send' | 'MessageCellStyle-Receive', direction: 'Send' | 'Receive') => {
    const set = project.chat.bubbles[side];
    const metricsFor = (resourceId: string, appearance: typeof set.normal) => {
      const asset = resolveResourceAsset(project, 'ios', resourceId);
      const binding = getResourceSlot(resourceId).ios;
      const sampleSize = binding?.sampleContentSize ?? binding?.samplePixelSize ?? [120, 105];
      const width = asset?.width ?? sampleSize[0];
      const height = asset?.height ?? sampleSize[1];
      const suffixScale = asset?.fileName.match(/@(2|3)x(?=\.[^.]+$)/i)?.[1];
      const scale = (asset?.sourceScale === 2 || asset?.sourceScale === 3 ? asset.sourceScale : suffixScale ? Number(suffixScale) : 3) as 2 | 3;
      return guidesToIosMetrics(appearance.stretchByPlatform?.ios ?? appearance.stretch, width, height, scale);
    };
    const states = [
      ['-ios-background-image', `chatroomBubble${direction}01.png`, set.normal, `chat.bubble.${side}.first.normal`],
      ['-ios-selected-background-image', `chatroomBubble${direction}01Selected.png`, set.pressed, `chat.bubble.${side}.first.pressed`],
      ['-ios-group-background-image', `chatroomBubble${direction}02.png`, set.grouped, `chat.bubble.${side}.grouped.normal`],
      ['-ios-group-selected-background-image', `chatroomBubble${direction}02Selected.png`, set.groupedPressed, `chat.bubble.${side}.grouped.pressed`],
    ] as const;
    for (const [property, fileName, appearance, resourceId] of states) {
      const metrics = metricsFor(resourceId, appearance);
      css = replaceInBlock(css, block, property, `'${fileName}' ${metrics.stretchPoint[0]}px ${metrics.stretchPoint[1]}px`);
    }
    const first = metricsFor(`chat.bubble.${side}.first.normal`, set.normal);
    const grouped = metricsFor(`chat.bubble.${side}.grouped.normal`, set.grouped);
    css = replaceInBlock(css, block, '-ios-title-edgeinsets', `${first.edgeInsets.join('px ')}px`);
    css = replaceInBlock(css, block, '-ios-group-title-edgeinsets', `${grouped.edgeInsets.join('px ')}px`);
  };
  updateBubbles('me', 'MessageCellStyle-Send', 'Send');
  updateBubbles('you', 'MessageCellStyle-Receive', 'Receive');

  return `${css.trimEnd()}\n\n/* Generated by Bear KTBaker */\n/* studio-bubble-me: ${project.chat.bubbles.me.normal.color} */\n/* studio-bubble-you: ${project.chat.bubbles.you.normal.color} */\n`;
}
