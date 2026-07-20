import { useEffect, useMemo, useState } from 'react';
import { themeStudioClient } from './app/themeStudioClient';
import { useProjectHistory } from './app/useProjectHistory';
import { usePreviewViewport } from './app/usePreviewViewport';
import { useThemeFileCommands } from './app/useThemeFileCommands';
import { AppHeader } from './components/AppHeader';
import { AppWorkspace, type AppArea } from './components/AppWorkspace';
import { ExportSheet } from './components/ExportSheet';
import { NinePatchEditor } from './components/NinePatchEditor';
import { ScreenshotStudio } from './components/ScreenshotStudio';
import { createDefaultTheme } from './domain/theme/defaults';
import {
  updateBubbleGuides,
  type BubbleVariant,
} from './domain/bubbleGuideUpdate';
import type {
  EditableElementId,
  Platform,
  ScreenId,
} from './domain/theme/model';
import { resolveBubbleGuides } from './manifest/bubbleGuideResolver';
import {
  resolveResourceAsset,
  resolveResourceUrl,
} from './manifest/resourceResolver';
import { resolveAssetScale } from './preview/imagePlacement';

interface PatchTarget {
  side: 'me' | 'you';
  variant: BubbleVariant;
  resourceId: string;
}

export default function App() {
  const {
    project,
    setProject,
    replaceProject,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useProjectHistory({
    initialProject: createDefaultTheme,
    commands: themeStudioClient,
    limit: 100,
  });
  const {
    fileNotice,
    showExport,
    openTheme,
    saveProject: saveProjectFile,
    finishTheme,
    closeExport,
  } = useThemeFileCommands({
    project,
    replaceProject,
    client: themeStudioClient,
  });
  const [platform, setPlatform] = useState<Platform>('ios');
  const [screen, setScreen] = useState<ScreenId>('chatroom');
  const [area, setArea] = useState<AppArea>('screens');
  const [selected, setSelected] = useState<EditableElementId>(
    'screen-background',
  );
  const [patchTarget, setPatchTarget] = useState<PatchTarget | null>(null);
  const [showScreenshots, setShowScreenshots] = useState(false);
  const viewport = usePreviewViewport(area === 'screens');
  const selectedSide = selected === 'bubble-you' ? 'you' : 'me';
  const selectedBubble = patchTarget
    ? project.chat.bubbles[patchTarget.side][patchTarget.variant]
    : project.chat.bubbles[selectedSide].normal;

  useEffect(() => {
    if (!project.font || !('FontFace' in window)) return;
    const font = new FontFace(
      project.font.family,
      `url(${project.font.dataUrl})`,
    );
    void font
      .load()
      .then((loaded) => document.fonts.add(loaded))
      .catch(() => undefined);
  }, [project.font]);

  useEffect(() => {
    if (platform !== 'ios' || screen !== 'splash') return;
    setScreen('chatroom');
    setSelected('screen-background');
  }, [platform, screen]);

  const projectStyle = useMemo(
    () => project.font
      ? ({ '--theme-font': `'${project.font.family}'` } as React.CSSProperties)
      : {},
    [project.font],
  );

  const updatePatch = (guides: typeof selectedBubble.stretch) => {
    const side = patchTarget?.side ?? selectedSide;
    const variant = patchTarget?.variant ?? 'normal';
    setProject((current) =>
      updateBubbleGuides(current, side, variant, platform, guides),
    );
  };
  const patchAsset = patchTarget
    ? resolveResourceAsset(project, platform, patchTarget.resourceId)
    : undefined;
  const patchImage = patchTarget
    ? resolveResourceUrl(project, platform, patchTarget.resourceId)
    : undefined;
  const patchImageScale = platform === 'ios'
    ? resolveAssetScale(
        patchAsset ?? {
          fileName: patchImage ?? '',
          sourceScale: undefined,
        },
        'ios',
      )
    : 1;

  return (
    <div className="app-background" style={projectStyle}>
      <div className="window-shell">
        <AppHeader
          documentName={project.meta.name}
          isMac={themeStudioClient.platform === 'darwin'}
          canUndo={canUndo}
          canRedo={canRedo}
          onNameChange={(name) =>
            setProject(
              (current) => ({
                ...current,
                meta: { ...current.meta, name },
              }),
              { mergeKey: 'project-name' },
            )
          }
          onUndo={undo}
          onRedo={redo}
          onOpen={openTheme}
          onSave={saveProjectFile}
          onFinish={finishTheme}
        />
        <AppWorkspace
          project={project}
          platform={platform}
          screen={screen}
          selected={selected}
          area={area}
          viewport={viewport}
          onProject={setProject}
          onAreaChange={setArea}
          onPlatformChange={setPlatform}
          onScreenChange={setScreen}
          onSelectedChange={setSelected}
          onShowScreenshots={() => setShowScreenshots(true)}
          onOpenPatch={(variant, resourceId) =>
            setPatchTarget({
              side: selected === 'bubble-you' ? 'you' : 'me',
              variant,
              resourceId,
            })
          }
        />
      </div>
      {fileNotice && (
        <div
          className="file-operation-notice"
          data-kind={fileNotice.kind}
          role={fileNotice.kind === 'error' ? 'alert' : 'status'}
          aria-label={
            fileNotice.kind === 'status'
              ? '파일 작업 결과'
              : undefined
          }
        >
          {fileNotice.text}
        </div>
      )}
      {patchTarget && (
        <NinePatchEditor
          platform={platform}
          guides={resolveBubbleGuides(
            project,
            platform,
            patchTarget.resourceId,
          ).guides}
          color={selectedBubble.color}
          image={patchImage}
          imageScale={patchImageScale}
          imageIsNinePatch={platform === 'android' && (
            patchAsset?.fileName.endsWith('.9.png') || !patchAsset
          )}
          onChange={updatePatch}
          onClose={() => setPatchTarget(null)}
        />
      )}
      {showExport && (
        <ExportSheet
          project={project}
          onClose={closeExport}
          client={themeStudioClient}
        />
      )}
      {showScreenshots && (
        <ScreenshotStudio
          project={project}
          platform={platform}
          onClose={() => setShowScreenshots(false)}
          client={themeStudioClient}
        />
      )}
    </div>
  );
}
