import { useEffect, useState } from 'react';
import type { BubbleAppearance, EditableElementId, Platform, ScreenId, ThemeProject } from '../../domain/theme/model';
import { resolveResourceAsset, resolveResourceUrl } from '../../manifest/resourceResolver';
import { colorValue, cssColor } from '../../manifest/colorResolver';
import { resolveBubbleGuides } from '../../manifest/bubbleGuideResolver';
import { getColorSlot } from '../../manifest/kakaoColors';
import { getResourceSlot } from '../../manifest/kakaoResources';
import { getHostLayout } from '../../preview/layout';
import { iosInsetGeometry } from '../../preview/ninePatchStyle';
import { contentInsetsPx } from '../../preview/nineSlice';
import { calculateImagePlacement, placementBackgroundStyle, resolveAssetScale } from '../../preview/imagePlacement';
import { IosBubbleArtwork } from '../IosBubbleArtwork';
import { IosBubbleLabel } from '../IosBubbleLabel';
import { NineSliceImage } from '../NineSliceImage';
import { type PreviewProps, PROFILE_RESOURCE_IDS, type ProfileResourceId } from './PreviewTypes';

export function colorAtAlpha(value: string, alpha: number) {
  const match = /^#([0-9a-f]{6})/i.exec(cssColor(value));
  if (!match) return value;
  const alphaHex = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `#${match[1]}${alphaHex}`;
}

function screenResourceId(screen: ScreenId) {
  if (screen === 'chatroom' || screen === 'notification') return 'chat.background';
  if (screen === 'passcode') return 'passcode.background';
  if (screen === 'splash') return 'splash.image';
  return 'main.background';
}

function screenColorSlot(screen: ScreenId) {
  if (screen === 'chatroom' || screen === 'notification') return 'chat.background';
  if (screen === 'passcode') return 'passcode.background';
  if (screen === 'splash') return undefined;
  if (screen === 'now') return 'main.secondary.background';
  return 'main.background';
}

export function screenStyle(project: ThemeProject, platform: Platform, screen: ScreenId): React.CSSProperties {
  const fill = project.screens[screen].background;
  const slotId = screenColorSlot(screen);
  const backgroundColor = slotId ? cssColor(colorValue(project, platform, slotId)) : fill.color;
  return { backgroundColor };
}

export function ThemeBackground({ project, platform, screen }: Pick<PreviewProps, 'project' | 'platform' | 'screen'>) {
  const host = getHostLayout(platform, screen);
  const fill = project.screens[screen].background;
  const resourceId = screenResourceId(screen);
  const resourceSlot = getResourceSlot(resourceId);
  const binding = resourceSlot[platform];
  const colorSlot = screenColorSlot(screen);
  const resource = resolveResourceUrl(project, platform, resourceId);
  const asset = resolveResourceAsset(project, platform, resourceId);
  const surface = screen === 'passcode' && host.passcode ? host.passcode.imageSurface : host.themeSurface;
  const { x: left, y: top, width, height } = surface;
  const sourceSize = asset?.width && asset?.height
    ? { width: asset.width, height: asset.height }
    : !asset && binding?.samplePixelSize
      ? { width: binding.samplePixelSize[0], height: binding.samplePixelSize[1] }
      : undefined;
  const sourceScale = resolveAssetScale({
    fileName: asset?.fileName ?? binding?.files[0] ?? '',
    sourceScale: asset?.sourceScale,
  }, platform);
  const renderMode = resourceSlot.render.mode === 'top-center-crop'
    ? 'top-center-cover'
    : resourceSlot.render.mode;
  const placement = resource && sourceSize
    ? calculateImagePlacement({ ...sourceSize, scale: sourceScale }, { width, height }, renderMode)
    : undefined;
  const repeatsFromTop = resourceSlot.render.mode === 'top-center-crop';
  return <span className="kt-theme-background" data-resource-id={resourceId} data-surface={`${width}x${height}`} aria-hidden="true" style={{
    top,
    left,
    width,
    height,
    backgroundColor: colorSlot ? cssColor(colorValue(project, platform, colorSlot)) : fill.color,
    backgroundImage: resource ? `url(${resource})` : undefined,
    ...(placement ? placementBackgroundStyle(placement) : {
      backgroundPosition: screen === 'passcode' || screen === 'splash' ? 'center' : 'center top',
      backgroundSize: renderMode === 'contain' ? 'contain' : renderMode === 'stretch' ? '100% 100%' : 'cover',
    }),
    backgroundRepeat: repeatsFromTop ? 'repeat-y' : 'no-repeat',
  }} />;
}

export function profileImage(project: ThemeProject, platform: Platform, resourceId: ProfileResourceId = PROFILE_RESOURCE_IDS[0]) {
  return resolveResourceUrl(project, platform, resourceId)
    ?? (resourceId === PROFILE_RESOURCE_IDS[0] ? undefined : resolveResourceUrl(project, platform, PROFILE_RESOURCE_IDS[0]));
}

export function Editable({ id, selected, label, children, className = '', style, platformBubble, contentMode, onSelect, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave }: {
  id: EditableElementId;
  selected: EditableElementId;
  label: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  platformBubble?: Platform;
  contentMode?: 'single-line' | 'wrap';
  onSelect: (id: EditableElementId) => void;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLButtonElement>;
}) {
  return (
    <button type="button" className={`editable ${className}`} data-selected={selected === id}
      data-platform-bubble={platformBubble} data-content-mode={contentMode}
      data-testid={id} style={style} aria-label={`${label} 꾸미기`}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onPointerLeave={onPointerLeave}
      onClick={(event) => { event.stopPropagation(); onSelect(id); }}>
      {children}<span className="edit-hint">{label}</span>
    </button>
  );
}

export function ProfileHotspot({ project, platform, selected, onSelect, className = '', resourceId = PROFILE_RESOURCE_IDS[0] }: Pick<PreviewProps, 'project' | 'platform' | 'selected' | 'onSelect'> & { className?: string; resourceId?: ProfileResourceId }) {
  const image = profileImage(project, platform, resourceId);
  const selectProfile = () => onSelect('profile');
  return <span role="button" tabIndex={0} className={`editable ${className}`} data-selected={selected === 'profile'}
    data-resource-id={resourceId} aria-label="기본 프로필 꾸미기"
    onClick={(event) => { event.stopPropagation(); selectProfile(); }}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); selectProfile(); } }}>
    {image && <img src={image} alt="" />}<span className="edit-hint">기본 프로필</span>
  </span>;
}

interface BubbleRendererProps {
  project: ThemeProject;
  side: 'me' | 'you';
  grouped: boolean;
  appearance: BubbleAppearance;
  selected: EditableElementId;
  onSelect: (id: EditableElementId) => void;
  children: React.ReactNode;
}

export function IosInsetBubble({ project, side, grouped, appearance, selected, onSelect, children }: BubbleRendererProps) {
  const platform = 'ios' as const;
  const sequence = grouped ? 'grouped' : 'first';
  const resourceId = `chat.bubble.${side}.${sequence}.normal`;
  const source = resolveResourceUrl(project, platform, resourceId);
  const asset = resolveResourceAsset(project, platform, resourceId);
  const sampleSize = getResourceSlot(resourceId).ios?.sampleContentSize ?? getResourceSlot(resourceId).ios?.samplePixelSize ?? [120, 105];
  const fallback = { width: sampleSize[0], height: sampleSize[1] };
  const [renderSize, setRenderSize] = useState({ width: asset?.width ?? fallback.width, height: asset?.height ?? fallback.height });
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!source) return;
    const image = new Image();
    image.onload = () => setRenderSize({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = source;
  }, [source]);

  const guides = resolveBubbleGuides(project, 'ios', resourceId).guides;
  const sourceScale = asset?.sourceScale ?? resolveAssetScale({ fileName: asset?.fileName ?? source ?? '' }, 'ios');
  const geometry = iosInsetGeometry(guides, renderSize, sourceScale);
  const insets = contentInsetsPx(geometry.guides, renderSize, geometry.scale);
  const textColor = cssColor(colorValue(project, 'ios', `chat.bubble.${side}.text${pressed ? '.pressed' : ''}`));
  const style: React.CSSProperties = source ? {
    backgroundColor: 'transparent', color: textColor,
    paddingTop: insets.top, paddingRight: insets.right, paddingBottom: insets.bottom, paddingLeft: insets.left,
  } : { backgroundColor: appearance.color, color: textColor };
  return <Editable id={side === 'me' ? 'bubble-me' : 'bubble-you'} label={`${side === 'me' ? '보낸' : '받은'} ${grouped ? '연속' : '첫'} 말풍선`} selected={selected} onSelect={onSelect} className={`kt-bubble ${side === 'me' ? 'sent' : 'received'}-${grouped ? 'group' : 'first'}`} style={style}
    platformBubble="ios" contentMode="single-line"
    onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerCancel={() => setPressed(false)} onPointerLeave={() => setPressed(false)}>
    {source && <IosBubbleArtwork image={source} guides={guides} sourceSize={renderSize} sourceScale={sourceScale} />}
    {source
      ? <IosBubbleLabel className="kt-bubble-copy">{children}</IosBubbleLabel>
      : <span className="kt-bubble-copy" data-content-mode="single-line">{children}</span>}
  </Editable>;
}

export function AndroidNinePatchBubble({ project, side, grouped, appearance, selected, onSelect, children }: BubbleRendererProps) {
  const platform = 'android' as const;
  const sequence = grouped ? 'grouped' : 'first';
  const resourceId = `chat.bubble.${side}.${sequence}.normal`;
  const source = resolveResourceUrl(project, platform, resourceId);
  const asset = resolveResourceAsset(project, platform, resourceId);
  const rawNinePatch = Boolean(asset?.fileName.endsWith('.9.png') || (!asset && source?.includes('.9.png')));
  const sampleSize = getResourceSlot(resourceId).android?.sampleContentSize ?? [122, 112];
  const fallback = { width: sampleSize[0], height: sampleSize[1] };
  const initialWidth = asset?.width ? asset.width - (rawNinePatch ? 2 : 0) : fallback.width;
  const initialHeight = asset?.height ? asset.height - (rawNinePatch ? 2 : 0) : fallback.height;
  const [render, setRender] = useState({ source, width: initialWidth, height: initialHeight });

  useEffect(() => {
    if (!source) return;
    const image = new Image();
    image.onload = () => {
      if (!rawNinePatch) { setRender({ source, width: image.naturalWidth, height: image.naturalHeight }); return; }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, image.naturalWidth - 2);
      canvas.height = Math.max(1, image.naturalHeight - 2);
      canvas.getContext('2d')?.drawImage(image, 1, 1, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      setRender({ source: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
    };
    image.src = source;
  }, [rawNinePatch, source]);

  const guides = resolveBubbleGuides(project, 'android', resourceId).guides;
  const sourceScale = asset?.sourceScale ?? resolveAssetScale({ fileName: asset?.fileName ?? source ?? '' }, 'android');
  const insets = contentInsetsPx(guides, { width: render.width, height: render.height }, sourceScale, 'android');
  const hostInsets = getHostLayout('android', 'chatroom').chat!.bubbleContentInset;
  const textColor = cssColor(colorValue(project, 'android', `chat.bubble.${side}.text`));
  const style: React.CSSProperties = render.source ? {
    backgroundColor: 'transparent',
    color: textColor,
    paddingTop: insets.top + hostInsets.top,
    paddingRight: insets.right + hostInsets.right,
    paddingBottom: insets.bottom + hostInsets.bottom,
    paddingLeft: insets.left + hostInsets.left,
  } : { backgroundColor: appearance.color, color: textColor };
  return <Editable id={side === 'me' ? 'bubble-me' : 'bubble-you'} label={`${side === 'me' ? '보낸' : '받은'} ${grouped ? '연속' : '첫'} 말풍선`} selected={selected} onSelect={onSelect} className={`kt-bubble ${side === 'me' ? 'sent' : 'received'}-${grouped ? 'group' : 'first'}`} style={style}
    platformBubble="android" contentMode="single-line">
    {render.source && <NineSliceImage image={render.source} guides={guides} sourceSize={{ width: render.width, height: render.height }} sourceScale={sourceScale} renderer="android-nine-patch" />}
    <span className="kt-bubble-copy">{children}</span>
  </Editable>;
}

const TIGHT_OFFICIAL_VIEWBOXES: Record<Platform, Record<string, string>> = {
  ios: {
    '0 0 85 120': '23 47 32 60',
    '0 0 350 135': '24 52 297 60',
    '0 0 100 120': '32 32 40 39',
    '0 0 110 120': '34 37 34 33',
    '0 0 105 120': '34 33 40 38',
  },
  android: {
    '0 0 105 125': '22 68 54 50',
    '0 0 350 135': '24 68 297 60',
    '0 0 105 115': '31 25 39 38',
    '0 0 110 115': '30 29 34 33',
  },
};

export function OfficialVector({ viewBox, path, platform, name }: { viewBox: string; path: string; platform: Platform; name?: string }) {
  const tightViewBox = name === 'voice' && platform === 'ios' ? '30 30 44 43'
    : name === 'hash' && platform === 'android' ? '33 24 40 39'
      : TIGHT_OFFICIAL_VIEWBOXES[platform][viewBox] ?? viewBox;
  return <svg data-source={`${platform}-guide-26.5`} viewBox={tightViewBox} fill="currentColor" aria-hidden="true"><path d={path} fillRule="evenodd" /></svg>;
}

export function ColorHotspot({ slotId, selected, onSelect, className = '', children, onActivate, style, dataMoreChip }: {
  slotId: string;
  selected: EditableElementId;
  onSelect: (id: EditableElementId) => void;
  className?: string;
  children: React.ReactNode;
  onActivate?: () => void;
  style?: React.CSSProperties;
  dataMoreChip?: string;
}) {
  const id = `color:${slotId}` as EditableElementId;
  const label = getColorSlot(slotId).label;
  return <span role="button" tabIndex={0} className={`color-hotspot ${className}`} data-selected={selected === id} data-more-chip={dataMoreChip} aria-label={`${label} 색상 편집`} style={style}
    onClick={(event) => { event.stopPropagation(); onSelect(id); onActivate?.(); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { onSelect(id); onActivate?.(); } }}>
    {children}<span className="edit-hint">{label}</span>
  </span>;
}

export function ElementHotspot({ id, label, selected, onSelect, className = '', children, style, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave }: {
  id: EditableElementId;
  label: string;
  selected: EditableElementId;
  onSelect: (id: EditableElementId) => void;
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  onPointerDown?: React.PointerEventHandler<HTMLSpanElement>;
  onPointerUp?: React.PointerEventHandler<HTMLSpanElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLSpanElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLSpanElement>;
}) {
  return <span role="button" tabIndex={0} className={`color-hotspot ${className}`} data-selected={selected === id}
    aria-label={`${label} 꾸미기`} style={style}
    onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onPointerLeave={onPointerLeave}
    onClick={(event) => { event.stopPropagation(); onSelect(id); }}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(id); }}>
    {children}<span className="edit-hint">{label}</span>
  </span>;
}

export function BorderlessNinePatchImage({ source, strip, logicalSize }: { source: string; strip: boolean; logicalSize: { width: number; height: number } }) {
  const [renderSource, setRenderSource] = useState(source);
  useEffect(() => {
    if (!strip) {
      setRenderSource(source);
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, image.naturalWidth - 2);
      canvas.height = Math.max(1, image.naturalHeight - 2);
      canvas.getContext('2d')?.drawImage(image, 1, 1, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      setRenderSource(canvas.toDataURL('image/png'));
    };
    image.src = source;
  }, [source, strip]);
  return <img src={renderSource} alt="" data-nine-patch="true" data-logical-size={`${logicalSize.width}x${logicalSize.height}`} style={{ width: logicalSize.width, height: logicalSize.height }} />;
}
