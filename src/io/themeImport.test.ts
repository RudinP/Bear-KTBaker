import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { KAKAO_RESOURCE_SLOTS } from '../manifest/kakaoResources';
import { resolveBubbleGuides } from '../manifest/bubbleGuideResolver';
import { resolveResourceAsset } from '../manifest/resourceResolver';
import { buildIosCss } from './iosTheme';
import { buildNinePatchPng } from './ninePatchPng';
import { getMappedResourceWrites } from './resourceWrites';
import { flexibleBubbleTargetSize } from './resourceGeometry';
import { detectThemeImportKind, importAndroidSourceZip, importAndroidThemeArchive, importIosKtheme, inspectCompiledAndroidApk } from './themeImport';

const templates = path.join(process.cwd(), 'resources/templates');

function solidPng(red: number, green: number, blue: number, width = 1, height = 1) {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data.set([red, green, blue, 255], offset);
  }
  return PNG.sync.write(png);
}

describe('manifest-driven theme import', () => {
  it('detects supported theme and project extensions without depending on filename case', () => {
    expect(detectThemeImportKind('MY THEME.KTHEME')).toBe('ios');
    expect(detectThemeImportKind('MY THEME.APK')).toBe('android-apk');
    expect(detectThemeImportKind('MY SOURCE.ZIP')).toBe('android-source');
    expect(detectThemeImportKind('MY PROJECT.KTSTUDIO')).toBe('project');
    expect(() => detectThemeImportKind('notes.txt')).toThrow('지원하지 않는 파일');
  });

  it('rejects an arbitrary APK or ZIP instead of reporting a false theme-import success', async () => {
    const unrelatedArchive = await new JSZip()
      .file('assets/readme.txt', '카카오톡 테마 파일이 아닙니다.')
      .generateAsync({ type: 'nodebuffer' });

    await expect(importAndroidThemeArchive(unrelatedArchive, 'unrelated.apk'))
      .rejects.toThrow('카카오톡 Android 테마');
  });

  it('imports every available iOS slot and restores CSS stretch/inset values', async () => {
    const source = await readFile(path.join(templates, 'ios-base.ktheme'));
    const zip = await JSZip.loadAsync(source);
    const project = await importIosKtheme(source, 'sample.ktheme');
    const expected = KAKAO_RESOURCE_SLOTS.filter((slot) => slot.ios?.files.some((file) => zip.file(file))).length;

    expect(Object.keys(project.resources)).toHaveLength(expected);
    expect(project.meta.name).toBe('Apeach');
    expect(project.resources['main.background'].fileName).toBe('mainBgImage@3x.png');
    expect(project.resources['main.background'].sourceScale).toBe(3);
    expect(project.resources['chat.bubble.me.first.normal'].sourceScale).toBe(3);
    expect(project.chat.bubbles.me.normal.stretch.stretch.x[0]).toBeCloseTo(51 / 120, 5);
    expect(project.chat.bubbles.me.normal.stretch.stretch.x[1]).toBeCloseTo(54 / 120, 5);
    expect(project.chat.bubbles.me.normal.stretch.content).toEqual({
      left: 33 / 120, top: 30 / 105, right: 69 / 120, bottom: 84 / 105,
    });
  });

  it('round-trips suffixless 1x iOS bubble metrics without coercing them to 3x', async () => {
    const zip = await JSZip.loadAsync(await readFile(path.join(templates, 'ios-base.ktheme')));
    const templateCss = await zip.file('KakaoTalkTheme.css')!.async('string');
    zip.remove('Images/chatroomBubbleSend01@2x.png');
    zip.remove('Images/chatroomBubbleSend01@3x.png');
    zip.file('Images/chatroomBubbleSend01.png', solidPng(255, 127, 127, 40, 35));

    const project = await importIosKtheme(await zip.generateAsync({ type: 'nodebuffer' }), 'one-x.ktheme');
    const asset = project.platformResources.ios['chat.bubble.me.first.normal'];
    const androidAsset = project.platformResources.android['chat.bubble.me.first.normal'];
    const send = buildIosCss(project, templateCss).match(/MessageCellStyle-Send\s*\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(asset).toMatchObject({ fileName: 'chatroomBubbleSend01.png', width: 40, height: 35, sourceScale: 1 });
    expect(androidAsset).toMatchObject({ width: 40, height: 35, sourceScale: 1, mirroredFromPlatform: 'ios' });
    expect(flexibleBubbleTargetSize('android', 'theme_chatroom_bubble_me_01_image.9.png', {
      width: androidAsset!.width!, height: androidAsset!.height!,
    }, androidAsset!.sourceScale!, false, androidAsset!.mirroredFromPlatform)).toEqual({ width: 120, height: 105 });
    expect(send).toContain("-ios-background-image: 'chatroomBubbleSend01.png' 17px 17px;");
    expect(send).toContain('-ios-title-edgeinsets: 10px 11px 7px 17px;');
  });

  it('normalizes an @2x-only KTheme bubble to Android xxhdpi output dimensions', async () => {
    const zip = await JSZip.loadAsync(await readFile(path.join(templates, 'ios-base.ktheme')));
    zip.remove('Images/chatroomBubbleSend01@3x.png');

    const project = await importIosKtheme(await zip.generateAsync({ type: 'nodebuffer' }), 'two-x.ktheme');
    const asset = project.platformResources.android['chat.bubble.me.first.normal'];

    expect(asset).toMatchObject({ width: 80, height: 70, sourceScale: 2, mirroredFromPlatform: 'ios' });
    expect(flexibleBubbleTargetSize('android', 'theme_chatroom_bubble_me_01_image.9.png', {
      width: asset!.width!, height: asset!.height!,
    }, asset!.sourceScale!, false, asset!.mirroredFromPlatform)).toEqual({ width: 120, height: 105 });
  });

  it('uses legacy iOS Piccoma tab icons as Now fallbacks without replacing current Now icons', async () => {
    const source = await readFile(path.join(templates, 'ios-base.ktheme'));
    const legacyZip = await JSZip.loadAsync(source);
    const replacement2x = await legacyZip.file('Images/maintabIcoFriends@2x.png')!.async('nodebuffer');
    const replacement3x = await legacyZip.file('Images/maintabIcoFriends@3x.png')!.async('nodebuffer');
    const replacementSelected2x = await legacyZip.file('Images/maintabIcoFriendsSelected@2x.png')!.async('nodebuffer');
    const replacementSelected3x = await legacyZip.file('Images/maintabIcoFriendsSelected@3x.png')!.async('nodebuffer');
    for (const suffix of ['@2x.png', '@3x.png']) legacyZip.remove(`Images/maintabIcoNow${suffix}`);
    for (const suffix of ['Selected@2x.png', 'Selected@3x.png']) legacyZip.remove(`Images/maintabIcoNow${suffix}`);
    legacyZip.file('Images/maintabIcoPiccoma@2x.png', replacement2x);
    legacyZip.file('Images/maintabIcoPiccoma@3x.png', replacement3x);
    legacyZip.file('Images/maintabIcoPiccomaSelected@2x.png', replacementSelected2x);
    legacyZip.file('Images/maintabIcoPiccomaSelected@3x.png', replacementSelected3x);

    const legacy = await importIosKtheme(await legacyZip.generateAsync({ type: 'nodebuffer' }), 'legacy.ktheme');
    expect(legacy.platformResources.ios['main.tab.now.normal']?.fileName).toBe('maintabIcoPiccoma@3x.png');
    expect(legacy.platformResources.ios['main.tab.now.selected']?.fileName).toBe('maintabIcoPiccomaSelected@3x.png');
    expect(legacy.platformResources.android['main.tab.now.normal']?.dataUrl)
      .toBe(legacy.platformResources.ios['main.tab.now.normal']?.dataUrl);

    const currentZip = await JSZip.loadAsync(source);
    currentZip.file('Images/maintabIcoPiccoma@3x.png', replacement3x);
    currentZip.file('Images/maintabIcoPiccomaSelected@3x.png', replacementSelected3x);
    const current = await importIosKtheme(await currentZip.generateAsync({ type: 'nodebuffer' }), 'current.ktheme');
    expect(current.platformResources.ios['main.tab.now.normal']?.fileName).toBe('maintabIcoNow@3x.png');
    expect(current.platformResources.ios['main.tab.now.selected']?.fileName).toBe('maintabIcoNowSelected@3x.png');
  });

  it('restores the iOS dark-theme declaration while importing an existing theme', async () => {
    const zip = await JSZip.loadAsync(await readFile(path.join(templates, 'ios-base.ktheme')));
    const css = await zip.file('KakaoTalkTheme.css')!.async('string');
    zip.file('KakaoTalkTheme.css', css.replace('ManifestStyle\n{', "ManifestStyle\n{\n    -kakaotalk-theme-style: 'dark';"));
    const project = await importIosKtheme(await zip.generateAsync({ type: 'nodebuffer' }), 'dark.ktheme');
    expect(project.meta.appearance).toBe('dark');
  });

  it('follows CSS image references when an iOS theme uses custom asset file names', async () => {
    const zip = await JSZip.loadAsync(await readFile(path.join(templates, 'ios-base.ktheme')));
    const css = await zip.file('KakaoTalkTheme.css')!.async('string');
    const chatBackground = await zip.file('Images/chatroomBgImage@3x.png')!.async('nodebuffer');
    const sentBubble2x = await zip.file('Images/chatroomBubbleSend01@2x.png')!.async('nodebuffer');
    const sentBubble3x = await zip.file('Images/chatroomBubbleSend01@3x.png')!.async('nodebuffer');
    const profile = await zip.file('Images/profileImg01@3x.png')!.async('nodebuffer');

    zip.remove('Images/chatroomBgImage@3x.png');
    zip.remove('Images/chatroomBubbleSend01@2x.png');
    zip.remove('Images/chatroomBubbleSend01@3x.png');
    zip.remove('Images/profileImg01@3x.png');
    zip.file('Images/myChatCanvas@3x.png', chatBackground);
    zip.file('Images/mySentBubble@2x.png', sentBubble2x);
    zip.file('Images/mySentBubble@3x.png', sentBubble3x);
    zip.file('Images/myProfile@3x.png', profile);
    zip.file('KakaoTalkTheme.css', css
      .replace("-ios-background-image: 'chatroomBgImage.png';", "-ios-background-image: 'myChatCanvas.png';")
      .replace("-ios-background-image: 'chatroomBubbleSend01.png' 17px 17px;", "-ios-background-image: 'mySentBubble.png' 17px 17px;")
      .replace("-ios-profile-images: 'profileImg01.png';", "-ios-profile-images: 'myProfile.png';"));

    const project = await importIosKtheme(await zip.generateAsync({ type: 'nodebuffer' }), 'renamed.ktheme');

    expect(project.platformResources.ios['chat.background']?.fileName).toBe('myChatCanvas@3x.png');
    expect(project.platformResources.ios['chat.bubble.me.first.normal']?.fileName).toBe('mySentBubble@3x.png');
    expect(project.platformResources.ios['main.profile.01']?.fileName).toBe('myProfile@3x.png');
    expect(project.chat.bubbles.me.normal.stretch.stretch.x[0]).toBeCloseTo(51 / 120, 5);
  });

  it('maps imported iOS images to Android slots without reusing iOS bubble geometry', async () => {
    const zip = await JSZip.loadAsync(await readFile(path.join(templates, 'ios-base.ktheme')));
    const css = await zip.file('KakaoTalkTheme.css')!.async('string');
    zip.file('KakaoTalkTheme.css', css
      .replace('-ios-text-color: #664242;', '-ios-text-color: #123ABC;')
      .replace('-ios-normal-background-color: #F66C6C;', '-ios-normal-background-color: #ABCDEF;'));

    const project = await importIosKtheme(await zip.generateAsync({ type: 'nodebuffer' }), 'ios-only.ktheme');

    expect(project.platformResources.android['main.background']?.dataUrl)
      .toBe(project.platformResources.ios['main.background']?.dataUrl);
    expect(resolveResourceAsset(project, 'android', 'main.background')?.dataUrl)
      .toBe(project.platformResources.ios['main.background']?.dataUrl);
    expect(project.platformResources.android['chat.bubble.me.first.normal']).toMatchObject({
      dataUrl: project.platformResources.ios['chat.bubble.me.first.normal']?.dataUrl,
      mirroredFromPlatform: 'ios',
    });
    expect(project.platformResources.android['chat.bubble.me.first.normal']?.userSelected).toBeUndefined();
    expect(resolveResourceAsset(project, 'android', 'chat.bubble.me.first.normal')).toBeDefined();
    expect(project.platformResources.android['passcode.keypad.pressed']).toBeUndefined();
    expect(project.chat.bubbles.me.normal.stretchByPlatform?.android).toBeUndefined();
    expect(resolveBubbleGuides(project, 'android', 'chat.bubble.me.first.normal')).toMatchObject({ source: 'official-sample' });
    expect(resolveBubbleGuides(project, 'android', 'chat.bubble.me.first.normal').guides)
      .not.toEqual(resolveBubbleGuides(project, 'ios', 'chat.bubble.me.first.normal').guides);
    expect(getMappedResourceWrites(project, 'android')).toEqual(expect.arrayContaining([
      expect.objectContaining({ resourceId: 'chat.bubble.me.first.normal', ninePatch: true }),
    ]));
    expect(project.colorValues.android.theme_header_color).toBe('#123ABC');
    expect(project.colorValues.android.theme_body_cell_color).toBe('#00ABCDEF');
    expect(project.colorValues.ios['MainViewStyle-Primary|-ios-normal-background-alpha']).toBe('0.0');
  });

  it('strips Android marker borders for preview and restores their guides', async () => {
    const project = await importAndroidSourceZip(await readFile(path.join(templates, 'android-source.zip')), 'sample.zip');
    const asset = project.resources['chat.bubble.me.first.normal'];
    const png = PNG.sync.read(Buffer.from(asset.dataUrl.split(',')[1], 'base64'));

    expect([png.width, png.height]).toEqual([122, 112]);
    expect(asset.fileName).toBe('theme_chatroom_bubble_me_01_image.png');
    expect(asset.sourceScale).toBe(3);
    expect(asset.rawNinePatch).toBe(false);
    expect(project.resources['main.background'].sourceScale).toBe(4);
    expect(project.resources['main.tab.background'].sourceScale).toBe(4);
    expect(project.chat.bubbles.me.normal.stretch.stretch.x[0]).toBeCloseTo(54 / 122, 5);
    expect(project.chat.bubbles.me.normal.stretch.content.right).toBeCloseTo(92 / 122, 5);
  });

  it('normalizes a mixed-case source nine-patch to one borderless import representation', async () => {
    const interior = solidPng(12, 34, 56, 7, 5);
    const ninePatch = buildNinePatchPng(interior, {
      stretch: { x: [1 / 7, 6 / 7], y: [1 / 5, 4 / 5] },
      content: { left: 1 / 7, top: 1 / 5, right: 6 / 7, bottom: 4 / 5 },
    });
    const source = new JSZip();
    source.file(
      'src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.PNG',
      ninePatch,
    );

    const project = await importAndroidSourceZip(
      await source.generateAsync({ type: 'nodebuffer' }),
      'mixed-case-nine-patch.zip',
    );
    const asset = project.platformResources.android['chat.bubble.me.first.normal']!;
    const preview = PNG.sync.read(Buffer.from(asset.dataUrl.split(',')[1], 'base64'));
    const expected = PNG.sync.read(interior);

    expect(asset).toMatchObject({
      fileName: 'theme_chatroom_bubble_me_01_image.png',
      width: 7,
      height: 5,
      rawNinePatch: false,
    });
    expect([preview.width, preview.height]).toEqual([7, 5]);
    expect(Buffer.from(preview.data)).toEqual(Buffer.from(expected.data));
  });

  it('uses legacy Android source Piccoma tab icons as Now fallbacks while current Now icons win', async () => {
    const source = await readFile(path.join(templates, 'android-source.zip'));
    const legacyZip = await JSZip.loadAsync(source);
    for (const directory of ['drawable-xxhdpi', 'drawable-sw600dp']) {
      legacyZip.remove(`src/main/theme/${directory}/theme_maintab_ico_now_image.png`);
      legacyZip.remove(`src/main/theme/${directory}/theme_maintab_ico_now_focused_image.png`);
    }
    const legacy = await importAndroidSourceZip(await legacyZip.generateAsync({ type: 'nodebuffer' }), 'legacy.zip');
    expect(legacy.platformResources.android['main.tab.now.normal']?.fileName).toBe('theme_maintab_ico_piccoma_image.png');
    expect(legacy.platformResources.android['main.tab.now.selected']?.fileName).toBe('theme_maintab_ico_piccoma_focused_image.png');

    const current = await importAndroidSourceZip(source, 'current.zip');
    expect(current.platformResources.android['main.tab.now.normal']?.fileName).toBe('theme_maintab_ico_now_image.png');
    expect(current.platformResources.android['main.tab.now.selected']?.fileName).toBe('theme_maintab_ico_now_focused_image.png');
  });

  it('uses legacy Piccoma tab icons from a compiled APK when Now resources are absent', async () => {
    const source = await JSZip.loadAsync(await readFile(path.join(templates, 'android-source.zip')));
    const apk = new JSZip();
    for (const state of ['', '_focused']) {
      apk.file(
        `res/drawable-xxhdpi-v4/theme_maintab_ico_piccoma${state}_image.png`,
        await source.file(`src/main/theme/drawable-xxhdpi/theme_maintab_ico_piccoma${state}_image.png`)!.async('nodebuffer'),
      );
    }

    const project = await importAndroidThemeArchive(
      await apk.generateAsync({ type: 'nodebuffer' }),
      'legacy.apk',
      { resourceFiles: {
        'drawable/theme_maintab_ico_piccoma_image': [
          'res/drawable-xxhdpi-v4/theme_maintab_ico_piccoma_image.png',
        ],
        'drawable/theme_maintab_ico_piccoma_focused_image': [
          'res/drawable-xxhdpi-v4/theme_maintab_ico_piccoma_focused_image.png',
        ],
      } },
    );
    expect(project.platformResources.android['main.tab.now.normal']?.fileName).toBe('theme_maintab_ico_piccoma_image.png');
    expect(project.platformResources.android['main.tab.now.selected']?.fileName).toBe('theme_maintab_ico_piccoma_focused_image.png');
  });

  it('restores the Android dark-theme meta-data while importing source', async () => {
    const zip = await JSZip.loadAsync(await readFile(path.join(templates, 'android-source.zip')));
    const manifest = await zip.file('src/main/AndroidManifest.xml')!.async('string');
    zip.file('src/main/AndroidManifest.xml', manifest.replace('</application>', '  <meta-data android:name="com.kakao.talk.theme_style" android:value="dark" />\n    </application>'));
    const project = await importAndroidSourceZip(await zip.generateAsync({ type: 'nodebuffer' }), 'dark.zip');
    expect(project.meta.appearance).toBe('dark');
  });

  it('restores Android source identity, version, and XML-escaped theme name', async () => {
    const zip = await JSZip.loadAsync(await readFile(path.join(templates, 'android-source.zip')));
    const gradle = await zip.file('build.gradle.kts')!.async('string');
    const strings = await zip.file('src/main/theme/values/strings.xml')!.async('string');
    zip.file('build.gradle.kts', gradle
      .replace('applicationId = "com.kakao.talk.theme.template"', 'applicationId = "com.example.peach.post"')
      .replace('versionName = "1.0.0"', 'versionName = "3.7.12"'));
    zip.file('src/main/theme/values/strings.xml', strings.replace('Apeach', '복숭아 &amp; 우체국'));

    const project = await importAndroidSourceZip(
      await zip.generateAsync({ type: 'nodebuffer' }),
      'source.zip',
    );

    expect(project.meta.themeId).toBe('com.example.peach.post');
    expect(project.meta.version).toBe('3.7.12');
    expect(project.meta.name).toBe('복숭아 & 우체국');
  });

  it('maps imported Android images to iOS slots without reusing Android bubble geometry', async () => {
    const zip = await JSZip.loadAsync(await readFile(path.join(templates, 'android-source.zip')));
    const colors = await zip.file('src/main/theme/values/colors.xml')!.async('string');
    zip.file('src/main/theme/values/colors.xml', colors
      .replace('<color name="theme_header_color">#664242</color>', '<color name="theme_header_color">#123ABC</color>')
      .replace('<color name="theme_body_cell_color">#00FFDEDE</color>', '<color name="theme_body_cell_color">#7F112233</color>'));

    const project = await importAndroidSourceZip(await zip.generateAsync({ type: 'nodebuffer' }), 'android-only.zip');

    expect(project.platformResources.ios['main.background']?.dataUrl)
      .toBe(project.platformResources.android['main.background']?.dataUrl);
    expect(resolveResourceAsset(project, 'ios', 'main.background')?.dataUrl)
      .toBe(project.platformResources.android['main.background']?.dataUrl);
    expect(project.platformResources.ios['chat.bubble.me.first.normal']).toMatchObject({
      dataUrl: project.platformResources.android['chat.bubble.me.first.normal']?.dataUrl,
      mirroredFromPlatform: 'android',
    });
    expect(resolveResourceAsset(project, 'ios', 'chat.bubble.me.first.normal')).toBeDefined();
    expect(project.platformResources.ios['splash.image']).toBeUndefined();
    expect(project.chat.bubbles.me.normal.stretchByPlatform?.ios).toBeUndefined();
    expect(resolveBubbleGuides(project, 'ios', 'chat.bubble.me.first.normal')).toMatchObject({ source: 'official-sample' });
    expect(resolveBubbleGuides(project, 'ios', 'chat.bubble.me.first.normal').guides)
      .not.toEqual(resolveBubbleGuides(project, 'android', 'chat.bubble.me.first.normal').guides);
    expect(project.colorValues.ios['HeaderStyle-Main|-ios-text-color']).toBe('#123ABC');
    expect(project.colorValues.ios['MainViewStyle-Primary|-ios-normal-background-color']).toBe('#112233');
    expect(project.colorValues.ios['MainViewStyle-Primary|-ios-normal-background-alpha']).toBe('0.0');
  });

  it('uses resources.arsc paths across qualifier, case, and separator differences', async () => {
    const image = solidPng(12, 34, 56, 4, 8);
    const apk = new JSZip();
    apk.file('RES\\DRAWABLE-XXHDPI-V31\\THEME_BACKGROUND_IMAGE.PNG', image);
    const project = await importAndroidThemeArchive(
      await apk.generateAsync({ type: 'nodebuffer' }),
      'variant.apk',
      {
        colors: { theme_background_color: '#123456' },
        resourceFiles: {
          'drawable/theme_background_image': [
            'res/drawable/theme_background_image.xml',
            'res/drawable-xxhdpi-v31/theme_background_image.png',
          ],
        },
      },
    );
    expect(project.platformResources.android['main.background']?.dataUrl)
      .toBe(`data:image/png;base64,${image.toString('base64')}`);
  });

  it('tries every referenced PNG after XML, missing, and corrupt candidates', async () => {
    const image = solidPng(12, 34, 56, 4, 8);
    const apk = new JSZip();
    apk.file('res/drawable-xxhdpi-v31/theme_background_image.png', Buffer.from('not a png'));
    apk.file('res/drawable-sw600dp-v31/theme_background_image.png', image);
    const project = await importAndroidThemeArchive(
      await apk.generateAsync({ type: 'nodebuffer' }),
      'candidate-exhaustion.apk',
      { resourceFiles: { 'drawable/theme_background_image': [
        'res/drawable/theme_background_image.xml',
        'res/drawable-xhdpi-v4/theme_background_image.png',
        'res/drawable-xxhdpi-v31/theme_background_image.png',
        'res/drawable-sw600dp-v31/theme_background_image.png',
      ] } },
    );
    expect(project.platformResources.android['main.background']?.dataUrl)
      .toBe(`data:image/png;base64,${image.toString('base64')}`);
  });

  it('names the advertised resource after every APK candidate fails', async () => {
    const apk = new JSZip();
    apk.file('res/drawable-xxhdpi-v31/theme_background_image.png', Buffer.from('broken'));
    await expect(importAndroidThemeArchive(
      await apk.generateAsync({ type: 'nodebuffer' }),
      'broken.apk',
      { resourceFiles: { 'drawable/theme_background_image': [
        'res/drawable-xxhdpi-v31/theme_background_image.png',
      ] } },
    )).rejects.toThrow('drawable/theme_background_image');
  });

  it('does not report an XML-only compiled reference as a failed PNG', async () => {
    const image = solidPng(12, 34, 56, 4, 8);
    const apk = new JSZip();
    apk.file('res/drawable-xxhdpi-v31/theme_background_image.png', image);
    await expect(importAndroidThemeArchive(
      await apk.generateAsync({ type: 'nodebuffer' }),
      'xml-wrapper.apk',
      { resourceFiles: {
        'drawable/theme_background_image': ['res/drawable-xxhdpi-v31/theme_background_image.png'],
        'mipmap/ic_launcher_foreground': ['res/mipmap-anydpi-v26/ic_launcher_foreground.xml'],
      } },
    )).resolves.toMatchObject({ meta: { name: 'xml-wrapper' } });
  });

  it('imports source images below exactly one common wrapper directory', async () => {
    const image = solidPng(12, 34, 56, 4, 8);
    const source = new JSZip();
    source.file('theme-project/src/main/theme/drawable-xxhdpi/theme_background_image.png', image);
    const project = await importAndroidSourceZip(
      await source.generateAsync({ type: 'nodebuffer' }),
      'wrapped.zip',
    );
    expect(project.platformResources.android['main.background']?.dataUrl)
      .toBe(`data:image/png;base64,${image.toString('base64')}`);
  });

  it('loads colors from a case-varied color-only source below one wrapper directory', async () => {
    const source = new JSZip();
    source.file(
      'Theme-Project/SRC/MAIN/THEME/VALUES/COLORS.XML',
      '<resources><color name="theme_header_color">#102030</color><color name="theme_background_color">#203040</color></resources>',
    );

    const project = await importAndroidSourceZip(
      await source.generateAsync({ type: 'nodebuffer' }),
      'wrapped-colors.zip',
    );

    expect(project.colorValues.android.theme_header_color).toBe('#102030');
    expect(project.colors.header).toBe('#102030');
    expect(project.screens.friends.background).toEqual({ kind: 'color', color: '#203040' });
  });

  it('loads case-varied metadata and images through one wrapped source index', async () => {
    const image = solidPng(12, 34, 56, 4, 8);
    const source = new JSZip();
    source.file('Wrapped-Theme/SRC/MAIN/ANDROIDMANIFEST.XML', `
      <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application>
          <meta-data android:name="com.kakao.talk.theme_style" android:value="dark" />
        </application>
      </manifest>
    `);
    source.file(
      'Wrapped-Theme/SRC/MAIN/THEME/VALUES/STRINGS.XML',
      '<resources><string name="theme_title">감싼 &amp; 테마</string></resources>',
    );
    source.file(
      'Wrapped-Theme/SRC/MAIN/THEME/VALUES/COLORS.XML',
      '<resources><color name="theme_header_color">#314159</color><color name="theme_background_color">#271828</color></resources>',
    );
    source.file('Wrapped-Theme/BUILD.GRADLE.KTS', `
      android {
        namespace = "com.example.wrapped.namespace"
        defaultConfig {
          applicationId = "com.example.wrapped.theme"
          versionName = "4.5.6"
        }
      }
    `);
    source.file(
      'Wrapped-Theme/SRC/MAIN/THEME/DRAWABLE-XXHDPI/THEME_BACKGROUND_IMAGE.PNG',
      image,
    );

    const project = await importAndroidSourceZip(
      await source.generateAsync({ type: 'nodebuffer' }),
      'wrapped-metadata.zip',
    );

    expect(project.meta).toMatchObject({
      appearance: 'dark',
      name: '감싼 & 테마',
      version: '4.5.6',
      themeId: 'com.example.wrapped.theme',
    });
    expect(project.colorValues.android.theme_header_color).toBe('#314159');
    expect(project.screens.friends.background).toEqual({ kind: 'color', color: '#271828' });
    expect(project.platformResources.android['main.background']?.dataUrl)
      .toBe(`data:image/png;base64,${image.toString('base64')}`);
  });

  it('rejects an APK when colors load but no image can be restored', async () => {
    const apk = await new JSZip().generateAsync({ type: 'nodebuffer' });
    await expect(importAndroidThemeArchive(apk, 'colors-only.apk', {
      colors: { theme_background_color: '#123456' },
    })).rejects.toThrow('색상은 읽었지만 이미지 리소스를 복원하지 못했습니다');
  });

  it('keeps color-only Android source ZIP support', async () => {
    const source = new JSZip();
    source.file('src/main/theme/values/colors.xml', '<resources><color name="theme_background_color">#123456</color></resources>');
    await expect(importAndroidSourceZip(
      await source.generateAsync({ type: 'nodebuffer' }),
      'colors-only.zip',
    )).resolves.toMatchObject({ screens: { friends: { background: { color: '#123456' } } } });
  });

  it('imports images from compiled APK resource paths instead of treating an APK like a source zip', async () => {
    const source = await JSZip.loadAsync(await readFile(path.join(templates, 'android-source.zip')));
    const apk = new JSZip();
    apk.file(
      'res/drawable-xxhdpi-v4/theme_background_image.png',
      await source.file('src/main/theme/drawable-xxhdpi/theme_background_image.png')!.async('nodebuffer'),
    );
    apk.file(
      'res/drawable-xxhdpi-v4/theme_profile_01_image.png',
      await source.file('src/main/theme/drawable-xxhdpi/theme_profile_01_image.png')!.async('nodebuffer'),
    );

    const project = await importAndroidThemeArchive(
      await apk.generateAsync({ type: 'nodebuffer' }),
      'sample.apk',
      { resourceFiles: {
        'drawable/theme_background_image': [
          'res/drawable-xxhdpi-v4/theme_background_image.png',
        ],
        'drawable/theme_profile_01_image': [
          'res/drawable-xxhdpi-v4/theme_profile_01_image.png',
        ],
      } },
    );

    expect(project.resources['main.background'].fileName).toBe('theme_background_image.png');
    expect(project.resources['main.profile.01'].fileName).toBe('theme_profile_01_image.png');
  });

  it('prefers xxhdpi adaptive icon layers in Android source ZIP and compiled APK imports', async () => {
    const mdpi = solidPng(255, 0, 0);
    const xxhdpi = solidPng(0, 255, 0);
    const source = new JSZip();
    source.file('src/main/res/mipmap-mdpi/ic_launcher_foreground.png', mdpi);
    source.file('src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png', xxhdpi);
    source.file('src/main/res/mipmap-mdpi/ic_launcher_background.png', mdpi);
    source.file('src/main/res/mipmap-xxhdpi/ic_launcher_background.png', xxhdpi);

    const sourceProject = await importAndroidSourceZip(
      await source.generateAsync({ type: 'nodebuffer' }),
      'adaptive.zip',
    );
    expect(sourceProject.platformResources.android['common.app-icon.foreground']?.dataUrl)
      .toBe(`data:image/png;base64,${xxhdpi.toString('base64')}`);
    expect(sourceProject.platformResources.android['common.app-icon.background']?.dataUrl)
      .toBe(`data:image/png;base64,${xxhdpi.toString('base64')}`);

    const apk = new JSZip();
    apk.file('res/mipmap-mdpi-v4/ic_launcher_foreground.png', mdpi);
    apk.file('res/mipmap-xxhdpi-v4/ic_launcher_foreground.png', xxhdpi);
    apk.file('res/mipmap-mdpi-v4/ic_launcher_background.png', mdpi);
    apk.file('res/mipmap-xxhdpi-v4/ic_launcher_background.png', xxhdpi);
    const apkProject = await importAndroidThemeArchive(
      await apk.generateAsync({ type: 'nodebuffer' }),
      'adaptive.apk',
      { resourceFiles: {
        'mipmap/ic_launcher_foreground': [
          'res/mipmap-mdpi-v4/ic_launcher_foreground.png',
          'res/mipmap-xxhdpi-v4/ic_launcher_foreground.png',
        ],
        'mipmap/ic_launcher_background': [
          'res/mipmap-mdpi-v4/ic_launcher_background.png',
          'res/mipmap-xxhdpi-v4/ic_launcher_background.png',
        ],
      } },
    );
    expect(apkProject.platformResources.android['common.app-icon.foreground']?.dataUrl)
      .toBe(`data:image/png;base64,${xxhdpi.toString('base64')}`);
    expect(apkProject.platformResources.android['common.app-icon.background']?.dataUrl)
      .toBe(`data:image/png;base64,${xxhdpi.toString('base64')}`);
  });

  it('restores compiled APK dark-mode metadata supplied by the Android inspector', async () => {
    const image = solidPng(12, 34, 56, 4, 8);
    const apk = new JSZip();
    apk.file('res/drawable-xxhdpi-v31/theme_background_image.png', image);
    const resourceFiles = {
      'drawable/theme_background_image': [
        'res/drawable-xxhdpi-v31/theme_background_image.png',
      ],
    };
    const project = await importAndroidThemeArchive(
      await apk.generateAsync({ type: 'nodebuffer' }),
      'dark.apk',
      { appearance: 'dark', resourceFiles },
    );
    expect(project.meta.appearance).toBe('dark');
  });

  it('applies compiled APK colors to both canonical values and project background state', async () => {
    const image = solidPng(12, 34, 56, 4, 8);
    const apk = new JSZip();
    apk.file('res/drawable-xxhdpi-v31/theme_background_image.png', image);
    const resourceFiles = {
      'drawable/theme_background_image': [
        'res/drawable-xxhdpi-v31/theme_background_image.png',
      ],
    };
    const project = await importAndroidThemeArchive(
      await apk.generateAsync({ type: 'nodebuffer' }),
      'colors.apk',
      {
        resourceFiles,
        colors: {
          theme_header_color: '#102030',
          theme_background_color: '#203040',
          theme_chatroom_background_color: '#304050',
          theme_passcode_background_color: '#405060',
          theme_chatroom_input_bar_send_button_color: '#506070',
        },
      },
    );

    expect(project.colorValues.android.theme_header_color).toBe('#102030');
    expect(project.colors.header).toBe('#102030');
    expect(project.colors.accent).toBe('#506070');
    expect(project.screens.friends.background).toEqual({ kind: 'color', color: '#203040' });
    expect(project.screens.chatroom.background).toEqual({ kind: 'color', color: '#304050' });
    expect(project.screens.passcode.background).toEqual({ kind: 'color', color: '#405060' });
  });

  it('rejects an empty APK without compiled theme colors', async () => {
    await expect(importAndroidThemeArchive(
      await new JSZip().generateAsync({ type: 'nodebuffer' }),
      'empty.apk',
      {},
    )).rejects.toThrow('카카오톡 Android 테마 리소스를 찾지 못했습니다');
  });

  it('extracts compiled APK metadata and colors without Android SDK tools', async () => {
    const fixture = Buffer.from(
      (await readFile(path.join(process.cwd(), 'src/io/fixtures/compiled-theme-metadata.apk.b64'), 'utf8')).replace(/\s/g, ''),
      'base64',
    );

    const metadata = await inspectCompiledAndroidApk(fixture);

    expect(metadata.themeId).toBe('com.example.standalonefixture');
    expect(metadata.resourcePackage).toBe('com.example.standalonefixture');
    expect(metadata.version).toBe('7.8.9');
    expect(metadata.name).toBe('독립 테마');
    expect(metadata.appearance).toBe('dark');
    expect(metadata.colors).toMatchObject({
      theme_header_color: '#123456',
      theme_background_color: '#A1B2C3',
      theme_chatroom_background_color: '#B2C3D4',
      theme_passcode_background_color: '#C3D4E5',
      theme_chatroom_input_bar_send_button_color: '#D4E5F6',
    });
    expect(metadata.resourceFiles?.['drawable/theme_background_image']).toEqual(expect.arrayContaining([
      'res/drawable/theme_background_image.xml',
      'res/drawable-xxhdpi-v4/theme_background_image.png',
      'res/drawable-sw600dp-v13/theme_background_image.png',
    ]));
    expect(metadata.resourceFiles?.['mipmap/ic_launcher']).toEqual(expect.arrayContaining([
      'res/mipmap-anydpi-v26/ic_launcher.xml',
      'res/mipmap-xxhdpi-v4/ic_launcher.png',
    ]));
  });
});
