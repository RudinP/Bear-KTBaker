import type { ThemeProject } from '../domain/theme/model';

const xmlEscape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function buildAndroidStringsXml(project: ThemeProject) {
  const name = xmlEscape(project.meta.name);
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="theme_title">${name}</string>\n    <string name="app_name">${name}</string>\n</resources>\n`;
}

export function buildAndroidManifest(project: ThemeProject, template: string) {
  const darkMeta = /\s*<meta-data\b(?=[^>]*android:name=["']com\.kakao\.talk\.theme_style["'])[^>]*\/>/i;
  const withoutDarkMeta = template.replace(darkMeta, '');
  if (project.meta.appearance !== 'dark') return withoutDarkMeta;
  const declaration = '\n        <meta-data\n            android:name="com.kakao.talk.theme_style"\n            android:value="dark" />';
  return withoutDarkMeta.replace(/(<application\b[^>]*>)/i, `$1${declaration}`);
}

export function buildAndroidColorsXml(project: ThemeProject, template: string) {
  const values: Record<string, string> = project.colorValues.android;
  return Object.entries(values).reduce((xml, [name, color]) => {
    const pattern = new RegExp(`(<color\\s+name=["']${name}["']\\s*>)([^<]*)(</color>)`);
    return xml.replace(pattern, `$1${color}$3`);
  }, template);
}
