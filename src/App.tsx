import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BubbleStates } from './components/BubbleStates';
import { ExportSheet } from './components/ExportSheet';
import { FontSettings } from './components/FontSettings';
import { Inspector } from './components/Inspector';
import { NinePatchEditor } from './components/NinePatchEditor';
import { PhonePreview } from './components/PhonePreview';
import { ScreenRail } from './components/ScreenRail';
import { ScreenshotStudio } from './components/ScreenshotStudio';
import { ThemeSettings } from './components/ThemeSettings';
import { createDefaultTheme, serializeThemeProject, type EditableElementId, type Platform, type ScreenId } from './domain/theme';
import { updateBubbleGuides, type BubbleVariant } from './domain/bubbleGuideUpdate';
import { resolveBubbleGuides } from './manifest/bubbleGuideResolver';
import { resolveResourceAsset, resolveResourceUrl } from './manifest/resourceResolver';
import { resolveAssetScale } from './preview/imagePlacement';
import { rendererOperationErrorText } from './application/errors/rendererOperationErrorText';
import { themeStudioClient } from './app/themeStudioClient';
import { useProjectHistory } from './app/useProjectHistory';

const PREVIEW_ZOOM_STEP = 5;
const FILE_NOTICE_DURATION = { status: 3_000, error: 5_000 } as const;

function isEditableSpaceTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    'input, textarea, select, button, [contenteditable="true"], [role="button"], [role="textbox"]',
  ));
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
  const [platform, setPlatform] = useState<Platform>('ios');
  const [screen, setScreen] = useState<ScreenId>('chatroom');
  const [area, setArea] = useState<'theme-info' | 'font' | 'screens'>('screens');
  const [selected, setSelected] = useState<EditableElementId>('screen-background');
  const [patchTarget, setPatchTarget] = useState<{ side: 'me' | 'you'; variant: BubbleVariant; resourceId: string } | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showScreenshots, setShowScreenshots] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [fileNotice, setFileNotice] = useState<{ kind: 'status' | 'error'; text: string } | null>(null);
  const [spacePanReady, setSpacePanReady] = useState(false);
  const [previewPanning, setPreviewPanning] = useState(false);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const spacePanReadyRef = useRef(false);
  const panSessionRef = useRef<{
    stage: HTMLDivElement;
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const isMac = window.themeStudio?.platform === 'darwin';
  const selectedSide = selected === 'bubble-you' ? 'you' : 'me';
  const selectedBubble = patchTarget ? project.chat.bubbles[patchTarget.side][patchTarget.variant] : project.chat.bubbles[selectedSide].normal;
  const changePreviewZoom = (delta: number) => setPreviewZoom((current) => Math.max(50, Math.min(200, current + delta)));

  const stopPreviewPanning = useCallback((releaseCapture = true) => {
    const session = panSessionRef.current;
    if (!session) return;
    panSessionRef.current = null;
    if (releaseCapture) {
      try { session.stage.releasePointerCapture?.(session.pointerId); } catch { /* capture was already released */ }
    }
    setPreviewPanning(false);
  }, []);
  const stopSpacePanMode = useCallback(() => {
    spacePanReadyRef.current = false;
    setSpacePanReady(false);
    stopPreviewPanning();
  }, [stopPreviewPanning]);
  const startPreviewPanning = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!spacePanReadyRef.current || event.button !== 0) return;
    event.preventDefault();
    const stage = event.currentTarget;
    panSessionRef.current = {
      stage,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop,
    };
    stage.setPointerCapture?.(event.pointerId);
    setPreviewPanning(true);
  }, []);
  const handlePreviewLostPointerCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (panSessionRef.current?.pointerId !== event.pointerId) return;
    stopPreviewPanning(false);
  }, [stopPreviewPanning]);

  useEffect(() => {
    if (!project.font || !('FontFace' in window)) return;
    const font = new FontFace(project.font.family, `url(${project.font.dataUrl})`);
    font.load().then((loaded) => document.fonts.add(loaded)).catch(() => undefined);
  }, [project.font]);
  useEffect(() => {
    if (platform === 'ios' && screen === 'splash') {
      setScreen('chatroom');
      setSelected('screen-background');
    }
  }, [platform, screen]);
  useEffect(() => {
    const stage = previewStageRef.current;
    if (!stage) return undefined;
    const handleWheel = (event: WheelEvent) => {
      if (!event.deltaY || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const next = Math.max(50, Math.min(200, previewZoom + (event.deltaY < 0 ? PREVIEW_ZOOM_STEP : -PREVIEW_ZOOM_STEP)));
      if (next === previewZoom) return;
      event.preventDefault();
      setPreviewZoom(next);
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, [area, previewZoom]);
  useEffect(() => {
    if (!fileNotice) return undefined;
    const timer = window.setTimeout(
      () => setFileNotice(null),
      FILE_NOTICE_DURATION[fileNotice.kind],
    );
    return () => window.clearTimeout(timer);
  }, [fileNotice]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!previewStageRef.current || (event.key !== ' ' && event.code !== 'Space') || isEditableSpaceTarget(event.target)) return;
      event.preventDefault();
      if (spacePanReadyRef.current) return;
      spacePanReadyRef.current = true;
      setSpacePanReady(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.code !== 'Space') return;
      if (!spacePanReadyRef.current && !panSessionRef.current) return;
      event.preventDefault();
      stopSpacePanMode();
    };
    const handlePointerMove = (event: PointerEvent) => {
      const session = panSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      event.preventDefault();
      session.stage.scrollLeft = session.scrollLeft - (event.clientX - session.startX);
      session.stage.scrollTop = session.scrollTop - (event.clientY - session.startY);
    };
    const handlePointerEnd = (event: PointerEvent) => {
      if (panSessionRef.current?.pointerId !== event.pointerId) return;
      stopPreviewPanning();
    };
    const handleBlur = () => stopSpacePanMode();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('blur', handleBlur);
      const session = panSessionRef.current;
      panSessionRef.current = null;
      spacePanReadyRef.current = false;
      if (session) {
        try { session.stage.releasePointerCapture?.(session.pointerId); } catch { /* capture was already released */ }
      }
    };
  }, [stopPreviewPanning, stopSpacePanMode]);

  const projectStyle = useMemo(() => project.font
    ? ({ '--theme-font': `'${project.font.family}'` }) as React.CSSProperties
    : {}, [project.font]);

  const updatePatch = (guides: typeof selectedBubble.stretch) => {
    const side = patchTarget?.side ?? (selected === 'bubble-you' ? 'you' : 'me');
    const variant = patchTarget?.variant ?? 'normal';
    setProject(updateBubbleGuides(project, side, variant, platform, guides));
  };
  const patchAsset = patchTarget ? resolveResourceAsset(project, platform, patchTarget.resourceId) : undefined;
  const patchImage = patchTarget ? resolveResourceUrl(project, platform, patchTarget.resourceId) : undefined;
  const patchImageScale = platform === 'ios'
    ? resolveAssetScale(patchAsset ?? { fileName: patchImage ?? '', sourceScale: undefined }, 'ios')
    : 1;

  const openTheme = async () => {
    if (!window.themeStudio) return;
    setFileNotice(null);
    try {
      const result = await window.themeStudio.importTheme();
      if (!result) return;
      replaceProject(result.project);
      setFileNotice({ kind: 'status', text: '테마와 프로젝트 내용을 불러왔습니다.' });
    } catch (error) {
      setFileNotice({ kind: 'error', text: rendererOperationErrorText(error, '불러오지 못했습니다.', '파일을 확인해 주세요.') });
    }
  };

  const saveProject = async () => {
    if (!window.themeStudio) return;
    setFileNotice(null);
    try {
      const path = await window.themeStudio.saveProject(serializeThemeProject(project), project.meta.name);
      if (path) setFileNotice({ kind: 'status', text: '프로젝트를 저장했습니다.' });
    } catch (error) {
      setFileNotice({ kind: 'error', text: rendererOperationErrorText(error, '저장하지 못했습니다.', '저장 위치를 확인해 주세요.') });
    }
  };

  useEffect(() => window.themeStudio?.onFileCommand?.((command) => {
    if (command === 'import-theme') void openTheme();
    else if (command === 'save-project') void saveProject();
    else setShowExport(true);
  }), [project]);

  return (
    <div className="app-background" style={projectStyle}>
      <div className="window-shell">
        <header className={`app-toolbar ${isMac ? 'is-mac' : ''}`}><div className="document-title"><input className="document-name-input" aria-label="상단 테마 이름" value={project.meta.name} onChange={(event) => setProject({ ...project, meta: { ...project.meta, name: event.target.value } })} /></div><div className="toolbar-center"><button className="toolbar-history" type="button" onClick={undo} disabled={!canUndo}>실행 취소</button><button className="toolbar-history" type="button" onClick={redo} disabled={!canRedo}>다시 실행</button></div><div className="toolbar-actions"><button className="ghost-button" onClick={openTheme}>불러오기</button><button className="ghost-button" onClick={saveProject}>프로젝트 저장</button><button className="primary-button" onClick={() => setShowExport(true)}>테마 완성하기</button></div></header>
        <div className={`editor-layout${area === 'screens' ? '' : ' is-settings-layout'}`}>
          <ScreenRail current={screen} platform={platform} area={area} onThemeInfo={() => setArea('theme-info')} onFont={() => setArea('font')} onChange={(next) => { setArea('screens'); setScreen(next); setSelected('screen-background'); }} onScreenshots={() => setShowScreenshots(true)} />
          {area === 'theme-info' ? <ThemeSettings project={project} platform={platform} onProject={setProject} /> : area === 'font' ? <FontSettings project={project} onProject={setProject} /> : <><main className="preview-workspace"><div className="workspace-toolbar"><div className="platform-control"><button data-active={platform === 'ios'} onClick={() => setPlatform('ios')}>iPhone</button><button data-active={platform === 'android'} onClick={() => setPlatform('android')}>Android</button></div><span className="workspace-help">바꾸고 싶은 부분을 화면에서 선택하세요</span></div><div ref={previewStageRef} className={`preview-stage${spacePanReady ? ' is-space-pan-ready' : ''}${previewPanning ? ' is-panning' : ''}`} data-testid="preview-stage" onPointerDown={startPreviewPanning} onLostPointerCapture={handlePreviewLostPointerCapture}><div className="preview-zoom-surface" data-testid="preview-zoom-surface" data-zoom={previewZoom / 100} style={{ zoom: previewZoom / 100 }}><PhonePreview project={project} platform={platform} screen={screen} selected={selected} onSelect={setSelected} onNavigateScreen={(next) => { setArea('screens'); setScreen(next); setSelected('tabbar'); }} />{(selected === 'bubble-me' || selected === 'bubble-you') && <BubbleStates project={project} platform={platform} side={selectedSide} />}</div></div><div className="preview-zoom-controls" aria-label="미리보기 배율" title="휠로 확대·축소 · Shift+휠로 이동"><button type="button" aria-label="미리보기 축소" disabled={previewZoom === 50} onClick={() => changePreviewZoom(-PREVIEW_ZOOM_STEP)}>−</button><output aria-live="polite">{previewZoom}%</output><button type="button" aria-label="미리보기 확대" disabled={previewZoom === 200} onClick={() => changePreviewZoom(PREVIEW_ZOOM_STEP)}>+</button></div></main>
          <Inspector project={project} platform={platform} screen={screen} selected={selected} onProject={setProject} onNinePatch={(variant, resourceId) => setPatchTarget({ side: selected === 'bubble-you' ? 'you' : 'me', variant, resourceId })} /></>}
        </div>
      </div>
      {fileNotice && <div className="file-operation-notice" data-kind={fileNotice.kind} role={fileNotice.kind === 'error' ? 'alert' : 'status'} aria-label={fileNotice.kind === 'status' ? '파일 작업 결과' : undefined}>{fileNotice.text}</div>}
      {patchTarget && <NinePatchEditor platform={platform} guides={resolveBubbleGuides(project, platform, patchTarget.resourceId).guides} color={selectedBubble.color} image={patchImage} imageScale={patchImageScale} imageIsNinePatch={platform === 'android' && (patchAsset?.fileName.endsWith('.9.png') || !patchAsset)} onChange={updatePatch} onClose={() => setPatchTarget(null)} />}
      {showExport && <ExportSheet project={project} onClose={() => setShowExport(false)} />}
      {showScreenshots && <ScreenshotStudio project={project} platform={platform} onClose={() => setShowScreenshots(false)} />}
    </div>
  );
}
