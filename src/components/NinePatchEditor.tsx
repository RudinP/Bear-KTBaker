import { useEffect, useRef, useState } from 'react';
import { moveGuide, type NinePatchGuides } from '../domain/ninePatch';
import { copyNinePatchGuides, hasNinePatchClipboard, pasteNinePatchGuides, type NinePatchClipboardScope } from '../domain/ninePatchClipboard';

type SourceSize = { width: number; height: number };

export function NinePatchEditor({ platform, guides, color, image, imageSize, imageIsNinePatch = false, onChange, onClose }: {
  platform: 'ios' | 'android';
  guides: NinePatchGuides;
  color: string;
  image?: string;
  imageSize?: SourceSize;
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
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="늘어나는 부분 조정">
    <div className="nine-modal">
      <div className="modal-title"><div><span className="panel-kicker">말풍선 편집</span><h2>영역 조정</h2><p>{sourceSize.width} × {sourceSize.height}px 원본 기준</p></div><button className="close-button" onClick={onClose}>완료</button></div>
      <div className="patch-stage">
        <div className="patch-canvas" ref={area} style={{
          width: `${boundedCanvasWidth}px`,
          maxWidth: '62vw',
          backgroundColor: renderImage ? 'transparent' : color,
          backgroundImage: renderImage ? `url(${renderImage})` : undefined,
          backgroundSize: '100% 100%',
          aspectRatio: `${sourceSize.width} / ${sourceSize.height}`,
        }}>
          {activeGuides.stretch.x.map((value, index) => <button key={`x${index}`} aria-label={`세로 가이드 ${index + 1}`} className="guide vertical" data-guide-kind="stretch" data-px={`${pixel('x', value)}px`} style={{ left: `${value * 100}%` }} onPointerDown={(event) => drag('x', index as 0 | 1, event)} />)}
          {activeGuides.stretch.y.map((value, index) => <button key={`y${index}`} aria-label={`가로 가이드 ${index + 1}`} className="guide horizontal" data-guide-kind="stretch" data-px={`${pixel('y', value)}px`} style={{ top: `${value * 100}%` }} onPointerDown={(event) => drag('y', index as 0 | 1, event)} />)}
          {(['left', 'right'] as const).map((edge) => <button key={edge} aria-label={`글자 ${edge === 'left' ? '왼쪽' : '오른쪽'} 가이드`} className="guide content vertical" data-guide-kind="content" data-px={`${pixel('x', activeGuides.content[edge])}px`} style={{ left: `${activeGuides.content[edge] * 100}%` }} onPointerDown={(event) => dragContent(edge, event)} />)}
          {(['top', 'bottom'] as const).map((edge) => <button key={edge} aria-label={`글자 ${edge === 'top' ? '위' : '아래'} 가이드`} className="guide content horizontal" data-guide-kind="content" data-px={`${pixel('y', activeGuides.content[edge])}px`} style={{ top: `${activeGuides.content[edge] * 100}%` }} onPointerDown={(event) => dragContent(edge, event)} />)}
        </div>
        <div className="patch-coordinate-panel">
          <div className="patch-coordinate-toolbar"><b>좌표 설정</b>{actions('all', '전체')}</div>
          <div className="patch-coordinate-row">
            <div className="patch-coordinate-fields">{(['x', 'y'] as const).flatMap((axis) => activeGuides.stretch[axis].map((value, index) => {
              const name = `${axis.toUpperCase()} ${index === 0 ? '시작' : '끝'} (px)`;
              return <label key={`${axis}${index}`}><span>{name}</span><input aria-label={name} type="number" min="0" max={axis === 'x' ? sourceSize.width : sourceSize.height} value={pixel(axis, value)} onChange={(event) => updateCoordinate(axis, index as 0 | 1, Number(event.target.value))} /></label>;
            }))}</div>
            {actions('stretch', '늘어나는 영역')}
          </div>
          <div className="patch-coordinate-row">
            <div className="patch-coordinate-fields">{([
              ['left', '글자 왼쪽 (px)', 'x'],
              ['top', '글자 위 (px)', 'y'],
              ['right', '글자 오른쪽 (px)', 'x'],
              ['bottom', '글자 아래 (px)', 'y'],
            ] as const).map(([edge, name, axis]) => <label key={edge}><span>{name}</span><input aria-label={name} type="number" min="0" max={axis === 'x' ? sourceSize.width : sourceSize.height} value={pixel(axis, activeGuides.content[edge])} onChange={(event) => updateContent(edge, Number(event.target.value))} /></label>)}</div>
            {actions('content', '글자 영역')}
          </div>
        </div>
        <div className="patch-legend"><span><i className="stretch-swatch" />늘어나는 영역</span><span><i className="content-swatch" />글자 영역</span></div>
      </div>
    </div>
  </div>;
}
