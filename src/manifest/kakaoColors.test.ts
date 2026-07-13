import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  ANDROID_SAMPLE_COLORS, IOS_GUIDE_ONLY_COLORS, IOS_SAMPLE_ALPHAS, IOS_SAMPLE_COLORS, KAKAO_COLOR_SLOTS,
} from './kakaoColors';

function iosColors(css: string) {
  const result: Record<string, string> = {};
  for (const block of css.matchAll(/([A-Za-z][\w-]*)\s*(?:\/\*[\s\S]*?\*\/\s*)?\{([\s\S]*?)\}/g)) {
    for (const declaration of block[2].matchAll(/([\w-]+)\s*:\s*(#[0-9a-f]{6,8})\s*;/gi)) {
      result[`${block[1]}|${declaration[1]}`] = declaration[2];
    }
  }
  return result;
}

describe('official color resource manifest', () => {
  it('covers every Android colors.xml entry and every iOS CSS hex color declaration', async () => {
    const android = await JSZip.loadAsync(await readFile('resources/templates/android-source.zip'));
    const colorsPath = Object.keys(android.files).find((name) => name.endsWith('src/main/theme/values/colors.xml'))!;
    const xml = await android.file(colorsPath)!.async('string');
    const androidColors = Object.fromEntries([...xml.matchAll(/<color\s+name=["']([^"']+)["']\s*>(#[0-9a-f]+)<\/color>/gi)].map((match) => [match[1], match[2]]));
    const ios = await JSZip.loadAsync(await readFile('resources/templates/ios-base.ktheme'));
    const cssColors = iosColors(await ios.file('KakaoTalkTheme.css')!.async('string'));

    expect(ANDROID_SAMPLE_COLORS).toEqual(androidColors);
    expect(IOS_SAMPLE_COLORS).toEqual(cssColors);
    expect(KAKAO_COLOR_SLOTS.flatMap((slot) => slot.android)).toEqual(expect.arrayContaining(Object.keys(androidColors)));
    expect(KAKAO_COLOR_SLOTS.flatMap((slot) => slot.ios)).toEqual(expect.arrayContaining(Object.keys(cssColors)));
    expect(new Set(KAKAO_COLOR_SLOTS.flatMap((slot) => slot.android)).size).toBe(Object.keys(androidColors).length);
    expect(new Set(KAKAO_COLOR_SLOTS.flatMap((slot) => slot.ios)).size)
      .toBe(Object.keys(cssColors).length + Object.keys(IOS_GUIDE_ONLY_COLORS).length);
    expect(new Set(KAKAO_COLOR_SLOTS.map((slot) => slot.iosAlpha).filter(Boolean)))
      .toEqual(new Set(Object.keys(IOS_SAMPLE_ALPHAS)));
  });

  it('maps the guide header color key to both platform header foregrounds', () => {
    const header = KAKAO_COLOR_SLOTS.find((slot) => slot.id === 'main.header.foreground');
    expect(header?.android).toContain('theme_header_color');
    expect(header?.ios).toContain('HeaderStyle-Main|-ios-text-color');
  });

  it('exposes the shared header foreground without expanding the Android-only header background', () => {
    const foreground = KAKAO_COLOR_SLOTS.find((slot) => slot.id === 'main.header.foreground');
    const background = KAKAO_COLOR_SLOTS.find((slot) => slot.id === 'main.header.background');

    expect(foreground?.screens).toEqual([
      'friends', 'chats', 'now', 'more', 'chatroom', 'notification',
    ]);
    expect(background?.screens).toEqual(['friends', 'chats', 'now', 'more']);
    expect(background?.ios).toEqual([]);
  });

  it('exposes shared bubble text and unread colors in chatroom and notification previews', () => {
    const ids = [
      'chat.bubble.me.text',
      'chat.bubble.me.text.pressed',
      'chat.bubble.you.text',
      'chat.bubble.you.text.pressed',
      'chat.unread',
      'chat.unread.received',
    ];

    for (const id of ids) {
      expect(KAKAO_COLOR_SLOTS.find((slot) => slot.id === id)?.screens, id)
        .toEqual(['chatroom', 'notification']);
    }
  });

  it('keeps the two iOS unread number declarations independently editable', () => {
    const sent = KAKAO_COLOR_SLOTS.find((slot) => slot.id === 'chat.unread');
    const received = KAKAO_COLOR_SLOTS.find((slot) => slot.id === 'chat.unread.received');

    expect(sent?.ios).toEqual(['MessageCellStyle-Send|-ios-unread-text-color']);
    expect(sent?.android).toEqual(['theme_chatroom_unread_count_color']);
    expect(received?.ios).toEqual(['MessageCellStyle-Receive|-ios-unread-text-color']);
    expect(received?.android).toEqual([]);
  });

  it('keeps the 26.5 iOS keys that are newer than the bundled 25.8 sample', () => {
    expect(IOS_GUIDE_ONLY_COLORS).toHaveProperty('TabBarStyle-Main|background-color');
    expect(IOS_GUIDE_ONLY_COLORS).toHaveProperty('MainViewStyle-Secondary|-ios-text-color');
    expect(IOS_GUIDE_ONLY_COLORS).toHaveProperty('SectionTitleStyle-Main|-ios-description-text-color');
    expect(KAKAO_COLOR_SLOTS.flatMap((slot) => slot.ios)).toEqual(expect.arrayContaining(Object.keys(IOS_GUIDE_ONLY_COLORS)));
    expect(KAKAO_COLOR_SLOTS.find((slot) => slot.id === 'main.section.foreground')?.iosAlpha)
      .toBe('SectionTitleStyle-Main|-ios-text-alpha');
    expect(KAKAO_COLOR_SLOTS.find((slot) => slot.id === 'main.section.foreground')?.ios)
      .toEqual(expect.arrayContaining([
        'SectionTitleStyle-Main|-ios-text-color',
        'SectionTitleStyle-Main|-ios-description-text-color',
      ]));
  });
});
