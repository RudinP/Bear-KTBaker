import { describe, expect, it } from 'vitest';
import { createDefaultTheme } from '../domain/theme';
import { setColorSlot } from '../manifest/colorResolver';
import { buildAndroidColorsXml, buildAndroidManifest, buildAndroidStringsXml } from './androidTheme';
import { buildIosCss } from './iosTheme';

describe('platform exporters', () => {
  it('writes project metadata, colors, and bubble metrics into iOS CSS', () => {
    const project = createDefaultTheme('여름 편지');
    project.meta.author = '테마 작가';
    project.colorValues.ios['HeaderStyle-Main|-ios-text-color'] = '#112233';
    project.chat.bubbles.me.normal.color = '#ABCDEF';
    const template = `
ManifestStyle { -kakaotalk-theme-name: 'Apeach'; -kakaotalk-author-name: 'Kakao'; -kakaotalk-theme-id: 'old.id'; }
HeaderStyle-Main { -ios-text-color: #000000; }
MessageCellStyle-Send { -ios-background-image: 'chatroomBubbleSend01.png' 17px 17px; -ios-title-edgeinsets: 10px 11px 7px 17px; -ios-text-color: #FFFFFF; }
`;

    const css = buildIosCss(project, template);

    expect(css).toContain("-kakaotalk-theme-name: '여름 편지'");
    expect(css).toContain("-kakaotalk-author-name: '테마 작가'");
    expect(css).toContain('-ios-text-color: #112233');
    expect(css).toContain('/* studio-bubble-me: #ABCDEF */');
  });

  it('writes first, grouped, normal, and pressed iOS bubble metrics independently', () => {
    const project = createDefaultTheme();
    project.chat.bubbles.me.normal.stretch.stretch.x[0] = 0.3;
    project.chat.bubbles.me.pressed.stretch.stretch.x[0] = 0.35;
    project.chat.bubbles.me.grouped.stretch.stretch.x[0] = 0.4;
    project.chat.bubbles.me.groupedPressed.stretch.stretch.x[0] = 0.45;
    const template = `MessageCellStyle-Send {
      -ios-background-image: 'chatroomBubbleSend01.png' 17px 17px;
      -ios-selected-background-image: 'chatroomBubbleSend01Selected.png' 17px 17px;
      -ios-group-background-image: 'chatroomBubbleSend02.png' 17px 17px;
      -ios-group-selected-background-image: 'chatroomBubbleSend02Selected.png' 17px 17px;
      -ios-title-edgeinsets: 10px 11px 7px 17px;
      -ios-group-title-edgeinsets: 10px 11px 7px 17px;
    }`;

    const css = buildIosCss(project, template);
    expect(css).toContain("-ios-background-image: 'chatroomBubbleSend01.png' 12px");
    expect(css).toContain("-ios-selected-background-image: 'chatroomBubbleSend01Selected.png' 14px");
    expect(css).toContain("-ios-group-background-image: 'chatroomBubbleSend02.png' 16px");
    expect(css).toContain("-ios-group-selected-background-image: 'chatroomBubbleSend02Selected.png' 18px");
  });

  it('calculates the iOS pressed receive stretch point from its official 121px source width', () => {
    const project = createDefaultTheme();
    project.chat.bubbles.you.pressed.stretch.stretch.x[0] = 66 / 121;
    const template = `MessageCellStyle-Receive {
      -ios-background-image: 'chatroomBubbleReceive01.png' 22px 17px;
      -ios-selected-background-image: 'chatroomBubbleReceive01Selected.png' 22px 17px;
      -ios-group-background-image: 'chatroomBubbleReceive02.png' 22px 17px;
      -ios-group-selected-background-image: 'chatroomBubbleReceive02Selected.png' 22px 17px;
      -ios-title-edgeinsets: 10px 17px 7px 11px;
      -ios-group-title-edgeinsets: 10px 17px 7px 11px;
    }`;

    expect(buildIosCss(project, template)).toContain("-ios-selected-background-image: 'chatroomBubbleReceive01Selected.png' 22px");
  });

  it('preserves arbitrary iOS bubble dimensions and their independent first/group insets', () => {
    const project = createDefaultTheme();
    const firstGuides = {
      stretch: { x: [99 / 300, 102 / 300] as [number, number], y: [174 / 240, 177 / 240] as [number, number] },
      content: { left: 90 / 300, top: 171 / 240, right: 111 / 300, bottom: 183 / 240 },
    };
    const groupedGuides = {
      stretch: { x: [99 / 300, 102 / 300] as [number, number], y: [51 / 135, 54 / 135] as [number, number] },
      content: { left: 90 / 300, top: 66 / 135, right: 111 / 300, bottom: 78 / 135 },
    };
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: firstGuides };
    project.chat.bubbles.me.pressed.stretchByPlatform = { ios: firstGuides };
    project.chat.bubbles.me.grouped.stretchByPlatform = { ios: groupedGuides };
    project.chat.bubbles.me.groupedPressed.stretchByPlatform = { ios: groupedGuides };
    for (const state of ['first.normal', 'first.pressed'] as const) {
      project.platformResources.ios[`chat.bubble.me.${state}`] = { fileName: 'chatroomBubbleSend01@3x.png', dataUrl: 'data:image/png;base64,AA==', width: 300, height: 240, sourceScale: 3 };
    }
    for (const state of ['grouped.normal', 'grouped.pressed'] as const) {
      project.platformResources.ios[`chat.bubble.me.${state}`] = { fileName: 'chatroomBubbleSend02@3x.png', dataUrl: 'data:image/png;base64,AA==', width: 300, height: 135, sourceScale: 3 };
    }
    const template = `MessageCellStyle-Send {
      -ios-background-image: 'chatroomBubbleSend01.png' 17px 17px;
      -ios-selected-background-image: 'chatroomBubbleSend01Selected.png' 17px 17px;
      -ios-group-background-image: 'chatroomBubbleSend02.png' 17px 17px;
      -ios-group-selected-background-image: 'chatroomBubbleSend02Selected.png' 17px 17px;
      -ios-title-edgeinsets: 10px 11px 7px 17px;
      -ios-group-title-edgeinsets: 10px 11px 7px 17px;
    }`;

    const css = buildIosCss(project, template);
    expect(css).toContain("-ios-background-image: 'chatroomBubbleSend01.png' 33px 58px");
    expect(css).toContain("-ios-group-background-image: 'chatroomBubbleSend02.png' 33px 17px");
    expect(css).toContain('-ios-title-edgeinsets: 57px 30px 19px 63px');
    expect(css).toContain('-ios-group-title-edgeinsets: 22px 30px 19px 63px');
  });

  it('adds 26.5 guide declarations that are absent from the older 25.8 iOS sample', () => {
    const css = buildIosCss(createDefaultTheme(), `
      TabBarStyle-Main { background-color: ; }
      MainViewStyle-Secondary { background-color: #FFDEDE; }
    `);

    expect(css).toMatch(/TabBarStyle-Main\s*\{[^}]*background-color:\s*#FFFFFF/s);
    expect(css).toMatch(/MainViewStyle-Secondary\s*\{[^}]*-ios-text-color:\s*#664242/s);
  });

  it('writes only the registered iOS default profiles in slot order', () => {
    const project = createDefaultTheme();
    project.platformResources.ios['main.profile.02'] = { fileName: 'second.png', dataUrl: 'data:image/png;base64,AA==' };
    project.platformResources.ios['main.profile.03'] = { fileName: 'third.png', dataUrl: 'data:image/png;base64,AA==' };
    const css = buildIosCss(project, `DefaultProfileStyle {
      -ios-profile-images: 'profileImg01.png';
    }`);

    expect(css).toContain("-ios-profile-images: 'profileImg01.png''profileImg02.png''profileImg03.png';");
  });

  it('does not invent optional iOS profile files when slots two and three are empty', () => {
    const css = buildIosCss(createDefaultTheme(), `DefaultProfileStyle {
      -ios-profile-images: 'profileImg01.png';
    }`);
    expect(css).toContain("-ios-profile-images: 'profileImg01.png';");
    expect(css).not.toContain('profileImg02.png');
    expect(css).not.toContain('profileImg03.png');
  });

  it('adds and removes the official iOS dark theme declaration', () => {
    const project = createDefaultTheme();
    const template = `ManifestStyle {
      -kakaotalk-theme-name: 'Apeach';
    }`;
    project.meta.appearance = 'dark';
    const dark = buildIosCss(project, template);
    expect(dark).toMatch(/ManifestStyle\s*\{[^}]*-kakaotalk-theme-style:\s*'dark';/s);

    project.meta.appearance = 'light';
    expect(buildIosCss(project, dark)).not.toContain('-kakaotalk-theme-style');
  });

  it('adds and removes the official Android dark theme meta-data', () => {
    const project = createDefaultTheme();
    const template = `<?xml version="1.0" encoding="utf-8"?>
      <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application android:label="@string/app_name">
          <meta-data android:name="android.max_aspect" android:value="2.1" />
        </application>
      </manifest>`;
    project.meta.appearance = 'dark';
    const dark = buildAndroidManifest(project, template);
    expect(dark).toContain('android:name="com.kakao.talk.theme_style"');
    expect(dark).toContain('android:value="dark"');

    project.meta.appearance = 'light';
    expect(buildAndroidManifest(project, dark)).not.toContain('com.kakao.talk.theme_style');
  });

  it('updates known Android theme colors without changing resource names', () => {
    const project = createDefaultTheme();
    project.colorValues.android.theme_header_color = '#123456';
    project.colorValues.android.theme_chatroom_bubble_you_color = '#654321';
    const xml = `<resources>
      <color name="theme_header_color">#000000</color>
      <color name="theme_chatroom_bubble_you_color">#FFFFFF</color>
    </resources>`;

    const result = buildAndroidColorsXml(project, xml);

    expect(result).toContain('<color name="theme_header_color">#123456</color>');
    expect(result).toContain('<color name="theme_chatroom_bubble_you_color">#654321</color>');
  });

  it('exports a corresponding color edit to both iOS CSS and Android XML', () => {
    const original = createDefaultTheme();
    const iosEdited = setColorSlot(original, 'ios', 'main.header.foreground', '#112233');
    const androidXml = buildAndroidColorsXml(iosEdited, `<resources>
      <color name="theme_header_color">#000000</color>
    </resources>`);

    expect(buildIosCss(iosEdited, 'HeaderStyle-Main { -ios-text-color: #000000; }'))
      .toContain('-ios-text-color: #112233');
    expect(androidXml).toContain('<color name="theme_header_color">#112233</color>');

    const androidEdited = setColorSlot(original, 'android', 'main.header.foreground', '#445566');
    const iosCss = buildIosCss(androidEdited, 'HeaderStyle-Main { -ios-text-color: #000000; }');

    expect(buildAndroidColorsXml(androidEdited, '<resources><color name="theme_header_color">#000000</color></resources>'))
      .toContain('<color name="theme_header_color">#445566</color>');
    expect(iosCss).toContain('-ios-text-color: #445566');
  });

  it('exports canonical platform colors instead of conflicting legacy shared fields', () => {
    const project = createDefaultTheme();
    project.colorValues.ios['HeaderStyle-Main|-ios-text-color'] = '#112233';
    project.colorValues.android.theme_header_color = '#445566';
    project.colors.header = '#AABBCC';

    expect(buildIosCss(project, 'HeaderStyle-Main { -ios-text-color: #000000; }'))
      .toContain('-ios-text-color: #112233');
    expect(buildAndroidColorsXml(project, '<resources><color name="theme_header_color">#000000</color></resources>'))
      .toContain('<color name="theme_header_color">#445566</color>');
  });

  it('escapes a user theme name in Android strings XML', () => {
    const project = createDefaultTheme('나 & 너 <여름>');
    const result = buildAndroidStringsXml(project);

    expect(result).toContain('나 &amp; 너 &lt;여름&gt;');
  });
});
