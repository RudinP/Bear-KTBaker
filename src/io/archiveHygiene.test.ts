import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { generateCleanIosThemeArchive, isMacosArchiveJunk } from './archiveHygiene';

describe('iOS theme archive hygiene', () => {
  it('rebuilds a synthetic archive without Finder, AppleDouble, or quarantine metadata', async () => {
    const dirty = new JSZip();
    dirty.file('KakaoTalkTheme.css', 'ManifestStyle {}', {
      comment: 'com.apple.quarantine',
    });
    dirty.file('Images/theme.png', Buffer.from([1, 2, 3]));
    dirty.file('Images/.DS_Store', 'finder');
    dirty.file('__MACOSX/Images/._theme.png', 'apple-double');
    dirty.file('Images/._theme.png', 'apple-double');
    dirty.file('.com.apple.quarantine', 'safari');
    dirty.file('Images/com.apple.metadata:kMDItemWhereFroms', 'safari');

    const cleanBuffer = await generateCleanIosThemeArchive(dirty);
    const clean = await JSZip.loadAsync(cleanBuffer);

    expect(Object.keys(clean.files).filter(isMacosArchiveJunk)).toEqual([]);
    expect(await clean.file('KakaoTalkTheme.css')?.async('string')).toBe('ManifestStyle {}');
    expect(await clean.file('Images/theme.png')?.async('uint8array')).toEqual(new Uint8Array([1, 2, 3]));
    expect(clean.file('KakaoTalkTheme.css')?.comment).toBeNull();
  });

  it('keeps the tracked iOS template free of macOS archive junk', async () => {
    const template = await JSZip.loadAsync(await readFile(path.join(process.cwd(), 'resources/templates/ios-base.ktheme')));

    expect(Object.keys(template.files).filter(isMacosArchiveJunk)).toEqual([]);
    expect(template.file('KakaoTalkTheme.css')).not.toBeNull();
    expect(template.file('Images/chatroomBubbleSend01@3x.png')).not.toBeNull();
  });
});
