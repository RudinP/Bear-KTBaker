import type { ThemeProject, ScreenId } from '../../domain/theme/model';
import { ANDROID_SAMPLE_COLORS } from '../../manifest/kakaoColors';
import type { AndroidCompiledMetadata } from '../androidCompiledMetadata';

export interface AndroidSourceDocuments {
  manifest?: string;
  colors?: string;
  strings?: string;
  gradle?: string;
}

export interface DecodedAndroidThemeData {
  metadata: Partial<ThemeProject['meta']>;
  colorValues: Record<string, string>;
  importedColorBindings: ReadonlySet<string>;
  themeColors: Partial<ThemeProject['colors']>;
  screenColors: Partial<Record<ScreenId, string>>;
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

function decodeColors(values: Record<string, string>): Omit<DecodedAndroidThemeData, 'metadata'> {
  const colorValues: Record<string, string> = {};
  const importedColorBindings = new Set<string>();
  for (const [name, value] of Object.entries(values)) {
    if (name in ANDROID_SAMPLE_COLORS) {
      colorValues[name] = value;
      importedColorBindings.add(name);
    }
  }
  const main = values.theme_background_color;
  const chat = values.theme_chatroom_background_color;
  const passcode = values.theme_passcode_background_color;
  const screenColors: Partial<Record<ScreenId, string>> = {};
  if (main) for (const screen of ['friends', 'chats', 'now', 'more'] as const) screenColors[screen] = main;
  if (chat) {
    screenColors.chatroom = chat;
    screenColors.notification = chat;
  }
  if (passcode) screenColors.passcode = passcode;
  return {
    colorValues,
    importedColorBindings,
    themeColors: {
      header: values.theme_header_color,
      primaryText: values.theme_title_color,
      secondaryText: values.theme_description_color,
      inputBar: values.theme_chatroom_input_bar_background_color,
      accent: values.theme_chatroom_input_bar_send_button_color,
      notificationBackground: values.theme_notification_background_color,
      notificationTitle: values.theme_notification_color,
      notificationMessage: values.theme_notification_color,
    },
    screenColors,
  };
}

export function decodeAndroidSourceDocuments(documents: AndroidSourceDocuments): DecodedAndroidThemeData {
  const values: Record<string, string> = {};
  if (documents.colors) {
    for (const name of Object.keys(ANDROID_SAMPLE_COLORS)) {
      const parsed = xmlColor(documents.colors, name);
      if (parsed) values[name] = parsed;
    }
  }
  const manifest = documents.manifest;
  const gradle = documents.gradle;
  const name = decodeXmlText(documents.strings?.match(/<string\s+name=["']theme_title["']>([^<]+)</)?.[1]);
  const version = gradle?.match(/\bversionName\s*(?:=\s*)?["']([^"']+)["']/)?.[1]
    ?? manifest?.match(/\bandroid:versionName=["']([^"']+)["']/)?.[1];
  const themeId = gradle?.match(/\bapplicationId\s*(?:=\s*)?["']([^"']+)["']/)?.[1]
    ?? manifest?.match(/\bpackage=["']([^"']+)["']/)?.[1]
    ?? gradle?.match(/\bnamespace\s*(?:=\s*)?["']([^"']+)["']/)?.[1];
  return {
    metadata: {
      ...(name ? { name } : {}),
      ...(version ? { version } : {}),
      ...(themeId ? { themeId } : {}),
      appearance: manifest
        && /<meta-data\b(?=[^>]*android:name=["']com\.kakao\.talk\.theme_style["'])(?=[^>]*android:value=["']dark["'])[^>]*\/>/i.test(manifest)
        ? 'dark'
        : 'light',
    },
    ...decodeColors(values),
  };
}

export function decodeAndroidCompiledTheme(metadata: AndroidCompiledMetadata): DecodedAndroidThemeData {
  return {
    metadata: {
      ...(metadata.name ? { name: metadata.name } : {}),
      ...(metadata.version ? { version: metadata.version } : {}),
      ...(metadata.themeId ? { themeId: metadata.themeId } : {}),
      ...(metadata.appearance ? { appearance: metadata.appearance } : {}),
    },
    ...decodeColors(metadata.colors ?? {}),
  };
}
