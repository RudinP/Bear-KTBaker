export function prepareStandaloneAndroidManifest(
  template: string,
) {
  return template
    .replace(/\s+xmlns:tools=["'][^"']+["']/i, '')
    .replace(/\s+tools:[\w.-]+=["'][^"']*["']/gi, '')
    .replace(
      /android:name=["']\.MainActivity["']/i,
      'android:name="com.kakao.talk.theme.apeach.MainActivity"',
    );
}
