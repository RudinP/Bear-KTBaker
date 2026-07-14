import { useEffect, useRef, useState } from 'react';
import { moveGuide, type NinePatchGuides } from '../domain/ninePatch';
import { copyNinePatchGuides, hasNinePatchClipboard, pasteNinePatchGuides, type NinePatchClipboardScope } from '../domain/ninePatchClipboard';

type SourceSize = { width: number; height: number };

export function NinePatchEditor({ platform, guides, color, image, imageSize, imageScale, imageIsNinePatch = false, onChange, onClose }: {
  platform: 'ios' | 'android';
  guides: NinePatchGuides;
  color: string;
  image?: string;
  imageSize?: SourceSize;
  imageScale?: number;
  imageIsNinePatch?: boolean;
  onChange: (guides: NinePatchGuides) => void;
  onClose: () => void;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [sourceSize, setSourceSize] = useState<SourceSize>(imageSize ?? { width: 100, height: 100 });
  const [renderImage, setRenderImage] = useState(image);
  const [dragGuides, setDragGuides] = useState<NinePatchGuides | null>(null);
  const [, setClipboardRevision] = useState(0);
  const activeGuides = dragGuides ?? guides;
  const inferredImageScale = Number(image?.match(/@(\d+)x(?=\.[^./]+(?:$|[?#]))/i)?.[1] ?? 1);
  const iosScale = platform === 'ios' ? Math.max(1, imageScale ?? inferredImageScale) : 1;

  useEffect(() => setDragGuides(null), [guides]);

  useEffect(() => {
    if (imageSize) {
      setSourceSize(imageSize);
      return;
    }
    if (!image) return;
    const source = new Image();
    source.onload = () => {
      const width = Math.max(1, source.naturalWidth - (imageIsNinePatch ? 2 : 0));
      const height = Math.max(1, source.naturalHeight - (imageIsNinePatch ? 2 : 0));
      setSourceSize({ width, height });
      if (!imageIsNinePatch) {
        setRenderImage(image);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(source, 1, 1, width, height, 0, 0, width, height);
      setRenderImage(canvas.toDataURL('image/png'));
    };
    source.src = image;
  }, [image, imageIsNinePatch, imageSize]);

  const coordinateChange = (base: NinePatchGuides, axis: 'x' | 'y', index: 0 | 1, pixels: number) => {
    const length = axis === 'x' ? sourceSize.width : sourceSize.height;
    return {
      ...base,
      stretch: { ...base.stretch, [axis]: moveGuide(base.stretch[axis], index, pixels / length, 1 / length) },
    };
  };
  const iosStretchPointChange = (base: NinePatchGuides, axis: 'x' | 'y', logicalPixels: number) => {
    const length = axis === 'x' ? sourceSize.width : sourceSize.height;
    const stretchWidth = Math.min(length, iosScale);
    const sourceStart = Math.max(0, Math.min(length - stretchWidth, Math.round(logicalPixels * iosScale)));
    return {
      ...base,
      stretch: {
        ...base.stretch,
        [axis]: [sourceStart / length, (sourceStart + stretchWidth) / length] as [number, number],
      },
    };
  };
  const contentChange = (base: NinePatchGuides, edge: keyof NinePatchGuides['content'], pixels: number) => {
    const axis = edge === 'left' || edge === 'right' ? 'x' : 'y';
    const length = axis === 'x' ? sourceSize.width : sourceSize.height;
    const minimumGap = 1 / length;
    const value = Math.max(0, Math.min(1, pixels / length));
    const content = { ...base.content };
    if (edge === 'left') content.left = Math.min(value, content.right - minimumGap);
    if (edge === 'right') content.right = Math.max(value, content.left + minimumGap);
    if (edge === 'top') content.top = Math.min(value, content.bottom - minimumGap);
    if (edge === 'bottom') content.bottom = Math.max(value, content.top + minimumGap);
    return { ...base, content };
  };
  const updateCoordinate = (axis: 'x' | 'y', index: 0 | 1, pixels: number) => onChange(coordinateChange(activeGuides, axis, index, pixels));
  const updateContent = (edge: keyof NinePatchGuides['content'], pixels: number) => onChange(contentChange(activeGuides, edge, pixels));
  const updateIosStretchPoint = (axis: 'x' | 'y', logicalPixels: number) => onChange(iosStretchPointChange(activeGuides, axis, logicalPixels));
  const updateIosInset = (edge: keyof NinePatchGuides['content'], logicalPixels: number) => {
    const length = edge === 'left' || edge === 'right' ? sourceSize.width : sourceSize.height;
    const sourceInset = logicalPixels * iosScale;
    const coordinate = edge === 'right' || edge === 'bottom' ? length - sourceInset : sourceInset;
    onChange(contentChange(activeGuides, edge, coordinate));
  };
  const drag = (axis: 'x' | 'y', index: 0 | 1, event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    let latest = activeGuides;
    let moved = false;
    const move = (next: PointerEvent) => {
      const rect = area.current!.getBoundingClientRect();
      const value = axis === 'x' ? (next.clientX - rect.left) / rect.width : (next.clientY - rect.top) / rect.height;
      const length = axis === 'x' ? sourceSize.width : sourceSize.height;
      latest = coordinateChange(latest, axis, index, Math.round(value * length));
      moved = true;
      setDragGuides(latest);
    };
    const up = () => {
      cleanup();
      if (moved) onChange(latest);
    };
    const cancel = () => { cleanup(); setDragGuides(null); };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };
  const dragIosStretchPoint = (axis: 'x' | 'y', event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    let latest = activeGuides;
    let moved = false;
    const move = (next: PointerEvent) => {
      const rect = area.current!.getBoundingClientRect();
      const value = axis === 'x' ? (next.clientX - rect.left) / rect.width : (next.clientY - rect.top) / rect.height;
      const length = axis === 'x' ? sourceSize.width : sourceSize.height;
      latest = iosStretchPointChange(latest, axis, Math.round((value * length) / iosScale));
      moved = true;
      setDragGuides(latest);
    };
    const up = () => {
      cleanup();
      if (moved) onChange(latest);
    };
    const cancel = () => { cleanup(); setDragGuides(null); };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };
  const dragContent = (edge: keyof NinePatchGuides['content'], event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const axis = edge === 'left' || edge === 'right' ? 'x' : 'y';
    let latest = activeGuides;
    let moved = false;
    const move = (next: PointerEvent) => {
      const rect = area.current!.getBoundingClientRect();
      const value = axis === 'x' ? (next.clientX - rect.left) / rect.width : (next.clientY - rect.top) / rect.height;
      const length = axis === 'x' ? sourceSize.width : sourceSize.height;
      latest = contentChange(latest, edge, Math.round(value * length));
      moved = true;
      setDragGuides(latest);
    };
    const up = () => {
      cleanup();
      if (moved) onChange(latest);
    };
    const cancel = () => { cleanup(); setDragGuides(null); };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };
  const pixel = (axis: 'x' | 'y', value: number) => Math.round(value * (axis === 'x' ? sourceSize.width : sourceSize.height));
  const iosStretchSourceRange = (axis: 'x' | 'y') => {
    const length = axis === 'x' ? sourceSize.width : sourceSize.height;
    const start = pixel(axis, activeGuides.stretch[axis][0]);
    return [start, Math.min(length, start + iosScale)] as [number, number];
  };
  const iosStretchLogicalPixel = (axis: 'x' | 'y') => Math.floor(iosStretchSourceRange(axis)[0] / iosScale);
  const iosInsetPixel = (edge: keyof NinePatchGuides['content']) => {
    const axis = edge === 'left' || edge === 'right' ? 'x' : 'y';
    const coordinate = activeGuides.content[edge];
    const sourceInset = pixel(axis, edge === 'right' || edge === 'bottom' ? 1 - coordinate : coordinate);
    return Math.round(sourceInset / iosScale);
  };
  const copyCoordinates = (scope: NinePatchClipboardScope) => {
    copyNinePatchGuides(platform, scope, activeGuides, sourceSize);
    setClipboardRevision((revision) => revision + 1);
  };
  const pasteCoordinates = (scope: NinePatchClipboardScope) => {
    const next = pasteNinePatchGuides(platform, scope, activeGuides, sourceSize);
    if (next) onChange(next);
  };
  const actions = (scope: NinePatchClipboardScope, label: string) => <div className="patch-copy-actions">
    <button type="button" aria-label={`${label} 복사`} onClick={() => copyCoordinates(scope)}>복사</button>
    <button type="button" aria-label={`${label} 붙여넣기`} disabled={!hasNinePatchClipboard(platform, scope)} onClick={() => pasteCoordinates(scope)}>붙여넣기</button>
  </div>;
  const boundedCanvasWidth = Math.min(520, (340 * sourceSize.width) / sourceSize.height);
  const markerRange = (edge: 'top' | 'left' | 'bottom' | 'right') => {
    if (edge === 'top') return { axis: 'x' as const, range: activeGuides.stretch.x, kind: 'stretch' as const };
    if (edge === 'left') return { axis: 'y' as const, range: activeGuides.stretch.y, kind: 'stretch' as const };
    if (edge === 'bottom') return { axis: 'x' as const, range: [activeGuides.content.left, activeGuides.content.right] as [number, number], kind: 'content' as const };
    return { axis: 'y' as const, range: [activeGuides.content.top, activeGuides.content.bottom] as [number, number], kind: 'content' as const };
  };
  const androidMarker = (edge: 'top' | 'left' | 'bottom' | 'right') => {
    const { axis, range, kind } = markerRange(edge);
    const horizontal = axis === 'x';
    const edgeName = { top: '상단', left: '왼쪽', bottom: '하단', right: '오른쪽' }[edge];
    return <div
      key={edge}
      className={`nine-patch-marker ${edge} ${kind}`}
      data-nine-patch-edge={edge}
      style={horizontal
        ? { left: `${range[0] * 100}%`, width: `${(range[1] - range[0]) * 100}%` }
        : { top: `${range[0] * 100}%`, height: `${(range[1] - range[0]) * 100}%` }}
    >
      {range.map((value, index) => <button
        key={index}
        type="button"
        aria-label={`${edgeName} ${kind === 'stretch' ? '늘림' : '내용'} ${index === 0 ? '시작' : '끝'} 마커`}
        className={`nine-patch-marker-handle ${index === 0 ? 'start' : 'end'}`}
        data-nine-patch-marker-handle="true"
        data-px={`${pixel(axis, value)}px`}
        onPointerDown={(event) => {
          if (kind === 'stretch') drag(axis, index as 0 | 1, event);
          else dragContent((edge === 'bottom' ? (index === 0 ? 'left' : 'right') : (index === 0 ? 'top' : 'bottom')), event);
        }}
      />)}
    </div>;
  };
  const dialogLabel = platform === 'android' ? 'Android 9-patch 영역 조정' : 'iOS Inset 영역 조정';
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dialogLabel}>
    <div className="nine-modal">
      <div className="modal-title"><div><span className="panel-kicker">{platform === 'android' ? 'Android 말풍선 · .9.png' : 'iPhone 말풍선 · CSS inset'}</span><h2>{platform === 'android' ? '9-patch 영역 조정' : 'Inset 영역 조정'}</h2><p>{sourceSize.width} × {sourceSize.height}px 원본{platform === 'ios' ? ` · @${iosScale}x 기준` : ' 기준'}</p></div><button type="button" className="close-button" onClick={onClose}>완료</button></div>
      <div className="patch-stage" data-editor-mode={platform === 'android' ? 'android-nine-patch' : 'ios-inset'}>
        <div className="patch-canvas" ref={area} style={{
          width: `${boundedCanvasWidth}px`,
          maxWidth: '62vw',
          backgroundColor: renderImage ? 'transparent' : color,
          backgroundImage: renderImage ? `url(${renderImage})` : undefined,
          backgroundSize: '100% 100%',
          aspectRatio: `${sourceSize.width} / ${sourceSize.height}`,
        }}>
          {platform === 'android' ? <>
            <div className="nine-patch-stretch-preview" style={{ left: `${activeGuides.stretch.x[0] * 100}%`, width: `${(activeGuides.stretch.x[1] - activeGuides.stretch.x[0]) * 100}%`, top: `${activeGuides.stretch.y[0] * 100}%`, height: `${(activeGuides.stretch.y[1] - activeGuides.stretch.y[0]) * 100}%` }} />
            <div className="nine-patch-content-preview" style={{ left: `${activeGuides.content.left * 100}%`, right: `${(1 - activeGuides.content.right) * 100}%`, top: `${activeGuides.content.top * 100}%`, bottom: `${(1 - activeGuides.content.bottom) * 100}%` }} />
            {(['top', 'left', 'bottom', 'right'] as const).map(androidMarker)}
          </> : <>
            {(['x', 'y'] as const).flatMap((axis) => {
              const [start, end] = iosStretchSourceRange(axis);
              const length = axis === 'x' ? sourceSize.width : sourceSize.height;
              const orientation = axis === 'x' ? 'vertical' : 'horizontal';
              const position = axis === 'x' ? { left: `${(start / length) * 100}%` } : { top: `${(start / length) * 100}%` };
              const derivedPosition = axis === 'x' ? { left: `${(end / length) * 100}%` } : { top: `${(end / length) * 100}%` };
              return [
                <button key={`${axis}-start`} aria-label={`늘림 기준 ${axis.toUpperCase()} 가이드`} className={`guide ${orientation}`} data-guide-kind="stretch" data-ios-inset-guide={`stretch-${axis}-start`} data-source-px={start} data-label-side={axis === 'x' ? 'above' : 'left'} data-label-lane="0" data-px={`${iosStretchLogicalPixel(axis)}px · 원본 ${start}px`} style={position} onPointerDown={(event) => dragIosStretchPoint(axis, event)} />,
                <span key={`${axis}-end`} aria-hidden="true" className={`guide ${orientation} derived`} data-guide-kind="stretch" data-ios-inset-guide={`stretch-${axis}-end`} data-source-px={end} data-label-side={axis === 'x' ? 'above' : 'left'} data-label-lane="1" data-px={`원본 ${end}px`} style={derivedPosition} />,
              ];
            })}
            {(['left', 'right'] as const).map((edge, index) => <button key={edge} aria-label={`글자 ${edge === 'left' ? '왼쪽' : '오른쪽'} 가이드`} className="guide content vertical" data-guide-kind="content" data-ios-inset-guide={`content-${edge}`} data-label-side="above" data-label-lane={String(index + 2)} data-px={`${iosInsetPixel(edge)}px · 원본 ${pixel('x', activeGuides.content[edge])}px`} style={{ left: `${activeGuides.content[edge] * 100}%` }} onPointerDown={(event) => dragContent(edge, event)} />)}
            {(['top', 'bottom'] as const).map((edge, index) => <button key={edge} aria-label={`글자 ${edge === 'top' ? '위' : '아래'} 가이드`} className="guide content horizontal" data-guide-kind="content" data-ios-inset-guide={`content-${edge}`} data-label-side="left" data-label-lane={String(index + 2)} data-px={`${iosInsetPixel(edge)}px · 원본 ${pixel('y', activeGuides.content[edge])}px`} style={{ top: `${activeGuides.content[edge] * 100}%` }} onPointerDown={(event) => dragContent(edge, event)} />)}
          </>}
        </div>
        <div className="patch-coordinate-panel">
          <div className="patch-coordinate-toolbar"><b>좌표 설정</b>{actions('all', '전체')}</div>
          <div className="patch-coordinate-row">
            <div className={`patch-coordinate-fields ${platform === 'ios' ? 'is-ios-stretch' : ''}`}>{platform === 'android' ? (['x', 'y'] as const).flatMap((axis) => activeGuides.stretch[axis].map((value, index) => {
              const name = `${axis === 'x' ? '가로' : '세로'} 늘림 ${index === 0 ? '시작' : '끝'} (px)`;
              return <label key={`${axis}${index}`}><span>{name}</span><input aria-label={name} type="number" min="0" max={axis === 'x' ? sourceSize.width : sourceSize.height} value={pixel(axis, value)} onChange={(event) => updateCoordinate(axis, index as 0 | 1, Number(event.target.value))} /></label>;
            })) : (['x', 'y'] as const).map((axis) => {
              const name = `늘림 기준 ${axis.toUpperCase()} (CSS px)`;
              const [start, end] = iosStretchSourceRange(axis);
              return <label key={axis}><span>{name}</span><input aria-label={name} type="number" min="0" max={Math.floor(((axis === 'x' ? sourceSize.width : sourceSize.height) - iosScale) / iosScale)} value={iosStretchLogicalPixel(axis)} onChange={(event) => updateIosStretchPoint(axis, Number(event.target.value))} /><small className="patch-source-pixel-note">원본 {start}–{end}px</small></label>;
            })}</div>
            {actions('stretch', '늘어나는 영역')}
          </div>
          <div className="patch-coordinate-row">
            <div className="patch-coordinate-fields">{(platform === 'android' ? ([
              ['left', '내용 왼쪽 경계 (px)', 'x'],
              ['top', '내용 위 경계 (px)', 'y'],
              ['right', '내용 오른쪽 경계 (px)', 'x'],
              ['bottom', '내용 아래 경계 (px)', 'y'],
            ] as const) : ([
              ['top', '글자 위 여백 (CSS px)', 'y'],
              ['left', '글자 왼쪽 여백 (CSS px)', 'x'],
              ['bottom', '글자 아래 여백 (CSS px)', 'y'],
              ['right', '글자 오른쪽 여백 (CSS px)', 'x'],
            ] as const)).map(([edge, name, axis]) => <label key={edge}><span>{name}</span><input aria-label={name} type="number" min="0" max={Math.floor((axis === 'x' ? sourceSize.width : sourceSize.height) / (platform === 'ios' ? iosScale : 1))} value={platform === 'android' ? pixel(axis, activeGuides.content[edge]) : iosInsetPixel(edge)} onChange={(event) => platform === 'android' ? updateContent(edge, Number(event.target.value)) : updateIosInset(edge, Number(event.target.value))} />{platform === 'ios' && <small className="patch-source-pixel-note">원본 기준선 {pixel(axis, activeGuides.content[edge])}px</small>}</label>)}</div>
            {actions('content', '글자 영역')}
          </div>
        </div>
        <div className="patch-legend">{platform === 'android' ? <><span><i className="stretch-swatch" />상·좌 마커: 늘어나는 영역</span><span><i className="content-swatch" />하·우 마커: 내용 영역</span></> : <><span><i className="stretch-swatch" />1pt 늘림 띠 · 끝선 자동 계산</span><span><i className="content-swatch" />CSS 글자 여백</span></>}</div>
      </div>
    </div>
  </div>;
}
