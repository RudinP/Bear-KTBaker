import type { ImageAsset, Platform, ThemeProject } from '../domain/theme';
import { resolveResourceUrl } from '../manifest/resourceResolver';

function readImage(file: File, callback: (asset: ImageAsset) => void) {
  const reader = new FileReader();
  reader.onload = () => callback({ fileName: file.name, dataUrl: String(reader.result) });
  reader.readAsDataURL(file);
}

export function ThemeSettings({ project, platform, onProject }: {
  project: ThemeProject;
  platform: Platform;
  onProject: (project: ThemeProject) => void;
}) {
  const iconSettings = platform === 'ios'
    ? [['common.theme-icon', 'iPhone 테마 목록 아이콘'] as const]
    : [
      ['common.theme-icon', 'Android 앱 아이콘'] as const,
      ['common.app-icon.foreground', 'Android 적응형 전경'] as const,
      ['common.app-icon.background', 'Android 적응형 배경'] as const,
    ];
  const setPlatformResource = (resourceId: string, asset: ImageAsset) => onProject({
    ...project,
    platformResources: {
      ...project.platformResources,
      [platform]: { ...project.platformResources[platform], [resourceId]: asset },
    },
  });
  const updateMeta = (key: keyof ThemeProject['meta'], value: string) => onProject({
    ...project,
    meta: { ...project.meta, [key]: value },
  });

  return <main className="theme-settings-workspace">
    <div className="settings-heading">
      <span className="panel-kicker">GENERAL</span>
      <h2>테마 정보</h2>
    </div>
    <div className="settings-card">
      <section className="settings-icon-column">
        {iconSettings.map(([resourceId, label]) => {
          const icon = project.platformResources[platform][resourceId]?.dataUrl
            ?? resolveResourceUrl(project, platform, resourceId);
          return <label className="app-icon-picker" key={resourceId}>
            <input type="file" aria-label={`${label} 이미지`} accept="image/png,image/jpeg,image/webp" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readImage(file, (asset) => setPlatformResource(resourceId, asset));
            }} />
            <span className="app-icon-preview" style={icon ? { backgroundImage: `url(${icon})` } : undefined} />
            <b>{label}</b>
            <small>이미지를 눌러 변경</small>
          </label>;
        })}
      </section>
      <section className="settings-form" aria-label="테마 메타데이터">
        <label><span>테마 이름</span><input value={project.meta.name} onChange={(event) => updateMeta('name', event.target.value)} /></label>
        <label><span>제작자</span><input value={project.meta.author} placeholder="이름 또는 닉네임" onChange={(event) => updateMeta('author', event.target.value)} /></label>
        <label><span>버전</span><input aria-label="버전" value={project.meta.version} inputMode="decimal" onChange={(event) => updateMeta('version', event.target.value)} /></label>
        <label><span>테마 식별자</span><input aria-label="테마 식별자" value={project.meta.themeId} spellCheck={false} onChange={(event) => updateMeta('themeId', event.target.value)} /></label>
      </section>
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
