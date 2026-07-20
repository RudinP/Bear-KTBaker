import type { ProjectChangeHandler } from '../app/projectChange';
import type { PreviewViewportController } from '../app/usePreviewViewport';
import type {
  EditableElementId,
  Platform,
  ThemeProject,
  ScreenId,
} from '../domain/theme/model';
import type { BubbleVariant } from '../domain/bubbleGuideUpdate';
import { BubbleStates } from './BubbleStates';
import { FontSettings } from './FontSettings';
import { Inspector } from './Inspector';
import { PhonePreview } from './preview/PhonePreview';
import { ScreenRail } from './ScreenRail';
import { ThemeSettings } from './ThemeSettings';

export type AppArea = 'screens' | 'theme-info' | 'font';

export interface AppWorkspaceProps {
  project: ThemeProject;
  platform: Platform;
  screen: ScreenId;
  selected: EditableElementId;
  area: AppArea;
  viewport: PreviewViewportController;
  onProject: ProjectChangeHandler;
  onAreaChange(area: AppArea): void;
  onPlatformChange(platform: Platform): void;
  onScreenChange(screen: ScreenId): void;
  onSelectedChange(selected: EditableElementId): void;
  onShowScreenshots(): void;
  onOpenPatch(
    variant: BubbleVariant,
    resourceId: string,
  ): void;
}

export function AppWorkspace({
  project,
  platform,
  screen,
  selected,
  area,
  viewport,
  onProject,
  onAreaChange,
  onPlatformChange,
  onScreenChange,
  onSelectedChange,
  onShowScreenshots,
  onOpenPatch,
}: AppWorkspaceProps) {
  const selectedSide = selected === 'bubble-you' ? 'you' : 'me';

  const selectScreen = (
    nextScreen: ScreenId,
    nextSelection: EditableElementId,
  ) => {
    onAreaChange('screens');
    onScreenChange(nextScreen);
    onSelectedChange(nextSelection);
  };

  return (
    <div
      className={`editor-layout${area === 'screens' ? '' : ' is-settings-layout'}`}
    >
      <ScreenRail
        current={screen}
        platform={platform}
        area={area}
        onThemeInfo={() => onAreaChange('theme-info')}
        onFont={() => onAreaChange('font')}
        onChange={(next) => selectScreen(next, 'screen-background')}
        onScreenshots={onShowScreenshots}
      />
      {area === 'theme-info' ? (
        <ThemeSettings
          project={project}
          platform={platform}
          onProject={onProject}
        />
      ) : area === 'font' ? (
        <FontSettings project={project} onProject={onProject} />
      ) : (
        <>
          <main className="preview-workspace">
            <div className="workspace-toolbar">
              <div className="platform-control">
                <button
                  data-active={platform === 'ios'}
                  onClick={() => onPlatformChange('ios')}
                >
                  iPhone
                </button>
                <button
                  data-active={platform === 'android'}
                  onClick={() => onPlatformChange('android')}
                >
                  Android
                </button>
              </div>
              <span className="workspace-help">
                바꾸고 싶은 화면 요소를 클릭하세요
              </span>
            </div>
            <div
              ref={viewport.stageRef}
              className={`preview-stage${viewport.spacePanReady ? ' is-space-pan-ready' : ''}${viewport.panning ? ' is-panning' : ''}`}
              data-testid="preview-stage"
              onPointerDown={viewport.onPointerDown}
              onLostPointerCapture={viewport.onLostPointerCapture}
            >
              <div
                className="preview-zoom-surface"
                data-testid="preview-zoom-surface"
                data-zoom={viewport.scale}
                style={{ transform: `scale(${viewport.scale})` }}
              >
                <PhonePreview
                  project={project}
                  platform={platform}
                  screen={screen}
                  selected={selected}
                  onSelect={onSelectedChange}
                  onNavigateScreen={(next) =>
                    selectScreen(next, 'tabbar')
                  }
                />
                {(selected === 'bubble-me' ||
                  selected === 'bubble-you') && (
                  <BubbleStates
                    project={project}
                    platform={platform}
                    side={selectedSide}
                  />
                )}
              </div>
            </div>
            <div
              className="preview-zoom-controls"
              aria-label="미리보기 확대/축소"
            >
              <button
                type="button"
                aria-label="미리보기 축소"
                disabled={!viewport.canZoomOut}
                onClick={viewport.zoomOut}
              >
                −
              </button>
              <output aria-live="polite">{viewport.zoom}%</output>
              <button
                type="button"
                aria-label="미리보기 확대"
                disabled={!viewport.canZoomIn}
                onClick={viewport.zoomIn}
              >
                +
              </button>
            </div>
          </main>
          <Inspector
            project={project}
            platform={platform}
            screen={screen}
            selected={selected}
            onProject={onProject}
            onNinePatch={onOpenPatch}
          />
        </>
      )}
    </div>
  );
}
