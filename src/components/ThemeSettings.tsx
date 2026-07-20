import { readImageAsset } from '../app/browserAssets';
import type { ProjectChangeHandler } from '../app/projectChange';
import type { ImageAsset, Platform, ThemeProject } from '../domain/theme/model';
import { resolveResourceUrl } from '../manifest/resourceResolver';

export function ThemeSettings({ project, platform, onProject }: {
  project: ThemeProject;
  platform: Platform;
  onProject: ProjectChangeHandler;
}) {
  const setPlatformResource = (resourceId: string, asset: ImageAsset) => {
    onProject((current) => {
      const resources = {
        ios: current.platformResources?.ios ?? {},
        android: current.platformResources?.android ?? {},
      };
      return {
        ...current,
        platformResources: {
          ios: { ...resources.ios },
          android: { ...resources.android },
          [platform]: { ...resources[platform], [resourceId]: asset },
        },
      };
    });
  };
  const updateMeta = (key: keyof ThemeProject['meta'], value: string) => onProject(
    (current) => ({
      ...current,
      meta: { ...current.meta, [key]: value },
    }),
    { mergeKey: `meta:${key}` },
  );
  const iconPicker = (resourceId: string, label: string) => {
    const resources = project.platformResources?.[platform] ?? {};
    const icon = resources[resourceId]?.dataUrl
      ?? resolveResourceUrl(project, platform, resourceId);
    return <label className="app-icon-picker" key={resourceId}>
      <input type="file" aria-label={`${label} 이미지`} accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        void readImageAsset(file, platform, resourceId)
          .then((asset) => setPlatformResource(resourceId, asset));
      }} />
      <span className="app-icon-preview" style={icon ? { backgroundImage: `url(${icon})` } : undefined} />
      <b>{label}</b>
      <small>이미지를 눌러 변경</small>
    </label>;
  };

  return <main className="theme-settings-workspace">
    <div className="settings-heading">
      <span className="panel-kicker">GENERAL</span>
      <h2>테마 정보</h2>
    </div>
    <div className="settings-card">
      <section className="settings-icon-column">
        {platform === 'ios'
          ? iconPicker('common.theme-icon', 'iPhone 테마 목록 아이콘')
          : iconPicker('common.theme-icon', 'Android 기본 앱 아이콘')}
      </section>
      <section className="settings-form" aria-label="테마 메타데이터">
        <label><span>테마 이름</span><input value={project.meta.name} onChange={(event) => updateMeta('name', event.target.value)} /></label>
        <label><span>제작자</span><input value={project.meta.author} placeholder="이름 또는 닉네임" onChange={(event) => updateMeta('author', event.target.value)} /></label>
        <label><span>버전</span><input aria-label="버전" value={project.meta.version} inputMode="decimal" onChange={(event) => updateMeta('version', event.target.value)} /></label>
        <label><span>테마 식별자</span><input aria-label="테마 식별자" value={project.meta.themeId} spellCheck={false} onChange={(event) => updateMeta('themeId', event.target.value)} /></label>
      </section>
      {platform === 'android' && <section className="adaptive-icon-settings" role="group" aria-label="Android 8 이상 적응형 앱 아이콘">
        <div className="adaptive-icon-copy">
          <b>Android 8 이상 적응형 앱 아이콘</b>
          <small>전경과 배경 두 레이어가 함께 표시됩니다.</small>
        </div>
        <div className="adaptive-icon-layers">
          {iconPicker('common.app-icon.foreground', 'Android 적응형 전경')}
          {iconPicker('common.app-icon.background', 'Android 적응형 배경')}
        </div>
      </section>}
    </div>
    <div className="settings-card appearance-card">
      <div><b>테마 표시 모드</b><small>이 설정은 iPhone과 Android 모두에 적용됩니다.</small></div>
      <label className="appearance-switch">
        <span><b>다크 모드 테마로 인식</b><small>켜면 카카오톡이 이 테마를 다크 모드용으로 인식합니다.</small></span>
        <input aria-label="다크 모드 테마로 인식" type="checkbox" checked={project.meta.appearance === 'dark'}
          onChange={(event) => updateMeta('appearance', event.target.checked ? 'dark' : 'light')} />
        <i aria-hidden="true" />
      </label>
    </div>
  </main>;
}
