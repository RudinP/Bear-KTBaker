import { describe, expect, it } from 'vitest';
import { createDefaultTheme } from '../domain/theme';
import { getMappedResourceWrites } from './resourceWrites';

describe('manifest-driven resource writes', () => {
  it('never writes a legacy shared image into both OS packages', () => {
    const project = createDefaultTheme();
    project.resources['main.background'] = { fileName: 'legacy.png', dataUrl: 'data:image/png;base64,AA==' };

    expect(getMappedResourceWrites(project, 'ios')).toEqual([]);
    expect(getMappedResourceWrites(project, 'android')).toEqual([]);
  });

  it('maps theme icons and Android adaptive layers to their distinct official files', () => {
    const project = createDefaultTheme();
    project.platformResources.android['common.theme-icon'] = { fileName: 'icon.png', dataUrl: 'data:image/png;base64,AA==' };
    project.platformResources.ios['common.theme-icon'] = { fileName: 'icon.png', dataUrl: 'data:image/png;base64,AA==' };
    project.platformResources.android['common.app-icon.foreground'] = { fileName: 'foreground.png', dataUrl: 'data:image/png;base64,AA==' };
    project.platformResources.android['common.app-icon.background'] = { fileName: 'background.png', dataUrl: 'data:image/png;base64,AA==' };
    const android = getMappedResourceWrites(project, 'android').filter((write) => write.resourceId === 'common.theme-icon');
    const foreground = getMappedResourceWrites(project, 'android').filter((write) => write.resourceId === 'common.app-icon.foreground');
    const background = getMappedResourceWrites(project, 'android').filter((write) => write.resourceId === 'common.app-icon.background');
    const ios = getMappedResourceWrites(project, 'ios').filter((write) => write.resourceId === 'common.theme-icon');

    expect(android.some((write) => write.path.endsWith('mipmap-mdpi/ic_launcher.png'))).toBe(true);
    expect(android.some((write) => write.path.endsWith('src/main/ic_launcher-web.png'))).toBe(true);
    expect(foreground.some((write) => write.path.endsWith('mipmap-xxxhdpi/ic_launcher_foreground.png'))).toBe(true);
    expect(background.some((write) => write.path.endsWith('mipmap-mdpi/ic_launcher_background.png'))).toBe(true);
    expect(ios.map((write) => write.path)).toContain('Images/commonIcoTheme.png');
  });

  it('fans one user tab icon out to each official platform density path', () => {
    const project = createDefaultTheme();
    project.platformResources.ios['main.tab.friends.selected'] = { fileName: 'selected.png', dataUrl: 'data:image/png;base64,aWNvbg==' };
    project.platformResources.android['main.tab.friends.selected'] = { fileName: 'selected.png', dataUrl: 'data:image/png;base64,aWNvbg==' };

    expect(getMappedResourceWrites(project, 'ios').map((write) => write.path)).toEqual([
      'Images/maintabIcoFriendsSelected@2x.png', 'Images/maintabIcoFriendsSelected@3x.png',
    ]);
    expect(getMappedResourceWrites(project, 'android').map((write) => write.path)).toEqual([
      'src/main/theme/drawable-xxhdpi/theme_maintab_ico_friends_focused_image.png',
      'src/main/theme/drawable-sw600dp/theme_maintab_ico_friends_focused_image.png',
    ]);
  });

  it('marks only Android nine-patch targets for border generation', () => {
    const project = createDefaultTheme();
    project.platformResources.ios['chat.bubble.me.first.normal'] = { fileName: 'bubble.png', dataUrl: 'data:image/png;base64,YnViYmxl' };
    project.platformResources.android['chat.bubble.me.first.normal'] = { fileName: 'bubble.png', dataUrl: 'data:image/png;base64,YnViYmxl' };

    expect(getMappedResourceWrites(project, 'ios')).toHaveLength(2);
    expect(getMappedResourceWrites(project, 'ios').every((write) => !write.ninePatch)).toBe(true);
    expect(getMappedResourceWrites(project, 'android')).toMatchObject([
      { resourceId: 'chat.bubble.me.first.normal', ninePatch: true, path: 'src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png' },
    ]);
  });

  it('does not write an old automatic iOS bubble mirror into an Android package', () => {
    const project = createDefaultTheme('예전 iOS import', false);
    const id = 'chat.bubble.me.first.normal';
    const asset = { fileName: 'chatroomBubbleSend01@3x.png', dataUrl: 'data:image/png;base64,aW9z', width: 120, height: 105, sourceScale: 3 };
    const guides = {
      stretch: { x: [51 / 120, 54 / 120] as [number, number], y: [51 / 105, 54 / 105] as [number, number] },
      content: { left: 33 / 120, top: 30 / 105, right: 69 / 120, bottom: 84 / 105 },
    };
    project.resources[id] = { ...asset };
    project.platformResources.ios[id] = { ...asset };
    project.platformResources.android[id] = { ...asset };
    project.chat.bubbles.me.normal.stretch = structuredClone(guides);
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: structuredClone(guides), android: structuredClone(guides) };

    expect(getMappedResourceWrites(project, 'ios').filter((write) => write.resourceId === id)).toHaveLength(2);
    expect(getMappedResourceWrites(project, 'android').filter((write) => write.resourceId === id)).toEqual([]);
    expect(project.platformResources.android[id]).toEqual(asset);

    project.platformResources.android[id] = { ...asset, userSelected: true };
    expect(getMappedResourceWrites(project, 'android').filter((write) => write.resourceId === id)).toHaveLength(1);
  });

  it('does not expose the untouched Android mirror when only the iOS source is edited', () => {
    const project = createDefaultTheme('예전 iOS import', false);
    const id = 'chat.bubble.me.first.normal';
    const imported = { fileName: 'myBubble@3x.png', dataUrl: 'data:image/png;base64,aW9z', width: 120, height: 105, sourceScale: 3 };
    const original = {
      stretch: { x: [51 / 120, 54 / 120] as [number, number], y: [51 / 105, 54 / 105] as [number, number] },
      content: { left: 33 / 120, top: 30 / 105, right: 69 / 120, bottom: 84 / 105 },
    };
    const edited = structuredClone(original);
    edited.content.left = 0.2;
    project.resources[id] = { ...imported };
    project.platformResources.ios[id] = { fileName: 'edited@3x.png', dataUrl: 'data:image/png;base64,ZWRpdGVk', width: 120, height: 105, sourceScale: 3 };
    project.platformResources.android[id] = { ...imported };
    project.chat.bubbles.me.normal.stretch = structuredClone(edited);
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: structuredClone(edited), android: structuredClone(original) };

    expect(getMappedResourceWrites(project, 'ios').filter((write) => write.resourceId === id)).toHaveLength(2);
    expect(getMappedResourceWrites(project, 'android').filter((write) => write.resourceId === id)).toEqual([]);
  });
});
