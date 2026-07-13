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
});
