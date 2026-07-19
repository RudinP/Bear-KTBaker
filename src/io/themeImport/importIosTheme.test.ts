import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  ThemeImportFailure,
  type ThemeImportFailureKind,
} from '../themeImport';
import { importIosKtheme } from './importIosTheme';

const templates = path.join(process.cwd(), 'resources/templates');

function classifiedFailure(kind: ThemeImportFailureKind) {
  return { name: 'ThemeImportFailure', kind };
}

describe('iOS theme import coordinator', () => {
  it('imports CSS metadata, renamed images, colors, guides, and semantic mirrors', async () => {
    const zip = await JSZip.loadAsync(
      await readFile(path.join(templates, 'ios-base.ktheme')),
    );
    const css = await zip.file('KakaoTalkTheme.css')!.async('string');
    const sentBubble2x = await zip
      .file('Images/chatroomBubbleSend01@2x.png')!
      .async('nodebuffer');
    const sentBubble3x = await zip
      .file('Images/chatroomBubbleSend01@3x.png')!
      .async('nodebuffer');
    zip.remove('Images/chatroomBubbleSend01@2x.png');
    zip.remove('Images/chatroomBubbleSend01@3x.png');
    zip.file('Images/mySentBubble@2x.png', sentBubble2x);
    zip.file('Images/mySentBubble@3x.png', sentBubble3x);
    zip.file(
      'KakaoTalkTheme.css',
      css
        .replace(
          "-ios-background-image: 'chatroomBubbleSend01.png' 17px 17px;",
          "-ios-background-image: 'mySentBubble.png' 17px 17px;",
        )
        .replace('-ios-text-color: #664242;', '-ios-text-color: #123ABC;')
        .replace(
          '-ios-normal-background-color: #F66C6C;',
          '-ios-normal-background-color: #ABCDEF;',
        ),
    );

    const project = await importIosKtheme(
      await zip.generateAsync({ type: 'uint8array' }),
      'renamed.ktheme',
    );

    expect(project.meta.name).toBe('Apeach');
    expect(
      project.platformResources.ios['chat.bubble.me.first.normal']?.fileName,
    ).toBe('mySentBubble@3x.png');
    expect(
      project.chat.bubbles.me.normal.stretch.stretch.x[0],
    ).toBeCloseTo(51 / 120, 5);
    expect(project.platformResources.android['main.background']?.dataUrl).toBe(
      project.platformResources.ios['main.background']?.dataUrl,
    );
    expect(project.colorValues.android.theme_header_color).toBe('#123ABC');
    expect(project.colorValues.android.theme_body_cell_color).toBe('#00ABCDEF');
  });

  it('uses legacy Piccoma tab icons as Now fallbacks', async () => {
    const zip = await JSZip.loadAsync(
      await readFile(path.join(templates, 'ios-base.ktheme')),
    );
    const replacement2x = await zip
      .file('Images/maintabIcoFriends@2x.png')!
      .async('nodebuffer');
    const replacement3x = await zip
      .file('Images/maintabIcoFriends@3x.png')!
      .async('nodebuffer');
    const selected2x = await zip
      .file('Images/maintabIcoFriendsSelected@2x.png')!
      .async('nodebuffer');
    const selected3x = await zip
      .file('Images/maintabIcoFriendsSelected@3x.png')!
      .async('nodebuffer');
    for (const suffix of ['@2x.png', '@3x.png']) {
      zip.remove(`Images/maintabIcoNow${suffix}`);
    }
    for (const suffix of ['Selected@2x.png', 'Selected@3x.png']) {
      zip.remove(`Images/maintabIcoNow${suffix}`);
    }
    zip.file('Images/maintabIcoPiccoma@2x.png', replacement2x);
    zip.file('Images/maintabIcoPiccoma@3x.png', replacement3x);
    zip.file('Images/maintabIcoPiccomaSelected@2x.png', selected2x);
    zip.file('Images/maintabIcoPiccomaSelected@3x.png', selected3x);

    const project = await importIosKtheme(
      await zip.generateAsync({ type: 'uint8array' }),
      'legacy.ktheme',
    );

    expect(
      project.platformResources.ios['main.tab.now.normal']?.fileName,
    ).toBe('maintabIcoPiccoma@3x.png');
    expect(
      project.platformResources.ios['main.tab.now.selected']?.fileName,
    ).toBe('maintabIcoPiccomaSelected@3x.png');
  });

  it('classifies invalid archives and missing CSS without losing the Korean message', async () => {
    await expect(importIosKtheme(new Uint8Array([1, 2, 3]), 'broken.ktheme'))
      .rejects.toMatchObject(classifiedFailure('ios-archive'));

    const missingCss = await new JSZip()
      .file('Images/empty.png', new Uint8Array())
      .generateAsync({ type: 'uint8array' });
    const failure = await importIosKtheme(missingCss, 'missing.ktheme').catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(ThemeImportFailure);
    expect(failure).toMatchObject({
      kind: 'ios-css',
      message: 'KakaoTalkTheme.css가 없는 iPhone 테마입니다.',
    });
  });
});
