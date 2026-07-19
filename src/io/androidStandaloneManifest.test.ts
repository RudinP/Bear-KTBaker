import { describe, expect, it } from 'vitest';
import { prepareStandaloneAndroidManifest } from './androidStandaloneManifest';

describe('standalone Android manifest codec', () => {
  it('normalizes the official source manifest for direct AAPT2 linking', () => {
    const manifest = prepareStandaloneAndroidManifest(
      `<?xml version="1.0" encoding="utf-8"?>
      <manifest xmlns:android="http://schemas.android.com/apk/res/android"
        xmlns:tools="http://schemas.android.com/tools" package="com.kakao.talk.theme.apeach">
        <application tools:ignore="AllowBackup">
          <activity android:name=".MainActivity" />
        </application>
      </manifest>`,
    );

    expect(manifest).not.toContain('xmlns:tools');
    expect(manifest).not.toContain('tools:ignore');
    expect(manifest).toContain(
      'android:name="com.kakao.talk.theme.apeach.MainActivity"',
    );
  });

  it('removes all tools attributes regardless of quote style', () => {
    const manifest = prepareStandaloneAndroidManifest(
      `<manifest xmlns:tools='urn:tools'>
        <application tools:ignore='AllowBackup' tools:replace="android:label" />
      </manifest>`,
    );

    expect(manifest).toBe(`<manifest>
        <application />
      </manifest>`);
  });
});
