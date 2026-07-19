import { useCallback, useEffect, useRef, useState, type PointerEventHandler, type RefObject } from 'react';

const PREVIEW_ZOOM_MIN = 50;
const PREVIEW_ZOOM_MAX = 200;
const PREVIEW_ZOOM_STEP = 5;

export interface PreviewViewportController {
  stageRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  scale: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  spacePanReady: boolean;
  panning: boolean;
  zoomIn(): void;
  zoomOut(): void;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onLostPointerCapture: PointerEventHandler<HTMLDivElement>;
}

function isEditableSpaceTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    'input, textarea, select, button, [contenteditable="true"], [role="button"], [role="textbox"]',
  ));
}

export function usePreviewViewport(active: boolean): PreviewViewportController {
  const [zoom, setZoom] = useState(100);
  const [spacePanReady, setSpacePanReady] = useState(false);
  const [panning, setPanning] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const spacePanReadyRef = useRef(false);
  const panSessionRef = useRef<{
    stage: HTMLDivElement;
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const changeZoom = useCallback((delta: number) => {
    setZoom((current) => Math.max(PREVIEW_ZOOM_MIN, Math.min(PREVIEW_ZOOM_MAX, current + delta)));
  }, []);
  const stopPanning = useCallback((releaseCapture = true) => {
    const session = panSessionRef.current;
    if (!session) return;
    panSessionRef.current = null;
    if (releaseCapture) {
      try { session.stage.releasePointerCapture?.(session.pointerId); } catch { /* capture was already released */ }
    }
    setPanning(false);
  }, []);
  const stopSpacePanMode = useCallback(() => {
    spacePanReadyRef.current = false;
    setSpacePanReady(false);
    stopPanning();
  }, [stopPanning]);
  const onPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
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
    setPanning(true);
  }, []);
  const onLostPointerCapture = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    if (panSessionRef.current?.pointerId !== event.pointerId) return;
    stopPanning(false);
  }, [stopPanning]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!active || !stage) return undefined;
    const handleWheel = (event: WheelEvent) => {
      if (!event.deltaY || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const next = Math.max(PREVIEW_ZOOM_MIN, Math.min(PREVIEW_ZOOM_MAX, zoom + (event.deltaY < 0 ? PREVIEW_ZOOM_STEP : -PREVIEW_ZOOM_STEP)));
      if (next === zoom) return;
      event.preventDefault();
      setZoom(next);
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, [active, zoom]);

  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!stageRef.current || (event.key !== ' ' && event.code !== 'Space') || isEditableSpaceTarget(event.target)) return;
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
      stopPanning();
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
      setSpacePanReady(false);
      setPanning(false);
    };
  }, [active, stopPanning, stopSpacePanMode]);

  return {
    stageRef,
    zoom,
    scale: zoom / 100,
    canZoomIn: zoom < PREVIEW_ZOOM_MAX,
    canZoomOut: zoom > PREVIEW_ZOOM_MIN,
    spacePanReady,
    panning,
    zoomIn: () => changeZoom(PREVIEW_ZOOM_STEP),
    zoomOut: () => changeZoom(-PREVIEW_ZOOM_STEP),
    onPointerDown,
    onLostPointerCapture,
  };
}
