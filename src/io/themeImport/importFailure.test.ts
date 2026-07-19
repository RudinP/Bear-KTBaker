import { describe, expect, it } from 'vitest';
import { ThemeImportFailure } from './importFailure';

describe('ThemeImportFailure', () => {
  it('retains its cause and copies only safe context keys', () => {
    const cause = new Error('archive could not be read');
    const failure = new ThemeImportFailure({
      kind: 'android-archive',
      message: 'Android archive failed',
      safeContext: {
        archiveKind: 'apk',
        resourceId: 'chat.bubble.me.first.normal',
        resourceKey: 'theme_chatroom_bubble_me_01_image',
        path: '/private/theme.apk',
        archiveBytes: 'secret archive content',
        dataUrl: 'data:image/png;base64,secret',
        project: 'private project content',
      } as Record<string, string>,
      cause,
    });

    expect(failure).toMatchObject({
      name: 'ThemeImportFailure',
      kind: 'android-archive',
      safeContext: {
        archiveKind: 'apk',
        resourceId: 'chat.bubble.me.first.normal',
        resourceKey: 'theme_chatroom_bubble_me_01_image',
      },
    });
    expect(failure.cause).toBe(cause);
    expect(failure.safeContext).not.toHaveProperty('path');
    expect(failure.safeContext).not.toHaveProperty('archiveBytes');
    expect(failure.safeContext).not.toHaveProperty('dataUrl');
    expect(failure.safeContext).not.toHaveProperty('project');
  });

  it('omits empty safe context', () => {
    expect(new ThemeImportFailure({ kind: 'ios-css', message: 'Missing CSS' }).safeContext)
      .toBeUndefined();
  });
});
