import { useEffect, useState } from 'react';
import type {
  BubbleAppearance, EditableElementId, Platform, ScreenId, ThemeProject,
} from '../domain/theme';
import { resolveResourceAsset, resolveResourceUrl } from '../manifest/resourceResolver';
import { colorValue, cssColor } from '../manifest/colorResolver';
import { resolveBubbleGuides } from '../manifest/bubbleGuideResolver';
import { getColorSlot } from '../manifest/kakaoColors';
import { getResourceSlot } from '../manifest/kakaoResources';
import { KAKAO_PREVIEW_VERSION, getScreenBlueprint } from '../preview/blueprints';
import { getHostLayout } from '../preview/layout';
import { previewFontFamily } from '../preview/fontFamily';
import { ANDROID_CHAT_ACTIONS_PATH, ANDROID_CHAT_ACTIONS_VIEWBOX, ANDROID_CHAT_SEND_VECTOR, IOS_CHAT_SEND_VECTOR, OFFICIAL_CHATROOM_VECTORS } from '../preview/officialUiVectors';
import { OFFICIAL_CHAT_FILTER_VECTORS, OFFICIAL_MAIN_ACTION_VECTORS, OFFICIAL_MORE_SERVICE_VECTORS } from '../preview/officialMainUiVectors';
import { iosInsetGeometry } from '../preview/ninePatchStyle';
import { contentInsetsPx } from '../preview/nineSlice';
import { calculateImagePlacement, placementBackgroundStyle, resolveAssetScale } from '../preview/imagePlacement';
import { NineSliceImage } from './NineSliceImage';
import { IosBubbleArtwork } from './IosBubbleArtwork';

interface PreviewProps {
  project: ThemeProject;
  platform: Platform;
  screen: ScreenId;
  selected: EditableElementId;
  onSelect: (id: EditableElementId) => void;
  onNavigateScreen?: (screen: ScreenId) => void;
  previewScale?: number;
}

function colorAtAlpha(value: string, alpha: number) {
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

function screenStyle(project: ThemeProject, platform: Platform, screen: ScreenId): React.CSSProperties {
  const fill = project.screens[screen].background;
  const slotId = screenColorSlot(screen);
  const backgroundColor = slotId ? cssColor(colorValue(project, platform, slotId)) : fill.color;
  return { backgroundColor };
}

function ThemeBackground({ project, platform, screen }: Pick<PreviewProps, 'project' | 'platform' | 'screen'>) {
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

const PROFILE_RESOURCE_IDS = ['main.profile.01', 'main.profile.02', 'main.profile.03'] as const;
type ProfileResourceId = typeof PROFILE_RESOURCE_IDS[number];

function profileImage(project: ThemeProject, platform: Platform, resourceId: ProfileResourceId = PROFILE_RESOURCE_IDS[0]) {
  return resolveResourceUrl(project, platform, resourceId)
    ?? (resourceId === PROFILE_RESOURCE_IDS[0] ? undefined : resolveResourceUrl(project, platform, PROFILE_RESOURCE_IDS[0]));
}

function Editable({ id, selected, label, children, className = '', style, platformBubble, contentMode, onSelect, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave }: {
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

function ProfileHotspot({ project, platform, selected, onSelect, className = '', resourceId = PROFILE_RESOURCE_IDS[0] }: Pick<PreviewProps, 'project' | 'platform' | 'selected' | 'onSelect'> & { className?: string; resourceId?: ProfileResourceId }) {
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

function IosInsetBubble({ project, side, grouped, appearance, selected, onSelect, children }: BubbleRendererProps) {
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
    <span className="kt-bubble-copy" data-content-mode="single-line">{children}</span>
  </Editable>;
}

function AndroidNinePatchBubble({ project, side, grouped, appearance, selected, onSelect, children }: BubbleRendererProps) {
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
  return <Editable id={side === 'me' ? 'bubble-me' : 'bubble-you'} label={`${side === 'me' ? '보낸' : '받은'} ${grouped ? '연속' : '첫'} 말풍선`} selected={selected} onSelect={onSelect} className={`kt-bubble ${side === 'me' ? 'sent' : 'received'}-${grouped ? 'group' : 'first'}`} style={style}>
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

function OfficialVector({ viewBox, path, platform, name }: { viewBox: string; path: string; platform: Platform; name?: string }) {
  const tightViewBox = name === 'voice' && platform === 'ios' ? '30 30 44 43'
    : name === 'hash' && platform === 'android' ? '33 24 40 39'
      : TIGHT_OFFICIAL_VIEWBOXES[platform][viewBox] ?? viewBox;
  return <svg data-source={`${platform}-guide-26.5`} viewBox={tightViewBox} fill="currentColor" aria-hidden="true"><path d={path} fillRule="evenodd" /></svg>;
}

function ColorHotspot({ slotId, selected, onSelect, className = '', children, onActivate, style, dataMoreChip }: {
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

function ElementHotspot({ id, label, selected, onSelect, className = '', children, style, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave }: {
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

const tabs = [
  ['friends', '친구', 'friends'], ['chats', '채팅', 'chats'], ['now', '지금', 'now'],
  ['shopping', '쇼핑', null], ['more', '더보기', 'more'],
] as const;

function tabIcon(project: ThemeProject, platform: Platform, key: string, active: boolean) {
  return resolveResourceUrl(project, platform, `main.tab.${key}.${active ? 'selected' : 'normal'}`);
}

function BorderlessNinePatchImage({ source, strip, logicalSize }: { source: string; strip: boolean; logicalSize: { width: number; height: number } }) {
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

function BottomTabs({ project, platform, active, selected, onSelect, onNavigateScreen }: Pick<PreviewProps, 'project' | 'platform' | 'selected' | 'onSelect' | 'onNavigateScreen'> & { active: ScreenId }) {
  const background = resolveResourceUrl(project, platform, 'main.tab.background');
  const backgroundAsset = resolveResourceAsset(project, platform, 'main.tab.background');
  const isNinePatch = platform === 'android';
  const stripNinePatch = isNinePatch && Boolean(backgroundAsset?.rawNinePatch || backgroundAsset?.fileName.endsWith('.9.png') || (!backgroundAsset && background?.includes('.9.png')));
  const host = getHostLayout(platform, active);
  const tabLayout = host.tabBar!;
  const [previewActive, setPreviewActive] = useState<string | null>(null);
  useEffect(() => setPreviewActive(null), [active]);
  const activeKey = previewActive ?? active;
  return (
    <div role="button" tabIndex={0} aria-label="하단 탭 꾸미기" className="editable kt-tabbar" data-selected={selected === 'tabbar'} data-testid="tabbar"
      data-frame={`${tabLayout.frame.x},${tabLayout.frame.y},${tabLayout.frame.width},${tabLayout.frame.height}`}
      style={{ top: tabLayout.frame.y, height: tabLayout.frame.height, backgroundColor: background ? 'transparent' : cssColor(colorValue(project, platform, 'main.tab.background')) }}
      onClick={(event) => { event.stopPropagation(); onSelect('tabbar'); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect('tabbar'); }}>
      {background && <span className={`kt-tabbar-background${isNinePatch ? ' is-nine-patch' : ''}`} aria-hidden="true">
        {isNinePatch ? <BorderlessNinePatchImage source={background} strip={stripNinePatch} logicalSize={tabLayout.backgroundLogicalSize} /> : <img src={background} alt="" data-nine-patch="false" data-logical-size={`${tabLayout.backgroundLogicalSize.width}x${tabLayout.backgroundLogicalSize.height}`} style={{ width: tabLayout.backgroundLogicalSize.width, height: tabLayout.backgroundLogicalSize.height }} />}
      </span>}
      {tabs.map(([key, title, screen]) => { const isActive = key === activeKey; const image = tabIcon(project, platform, key, isActive); return <button type="button" className="kt-tab-item" key={key} data-active={isActive} aria-label={`${title} 탭 보기`}
        onClick={(event) => { event.stopPropagation(); setPreviewActive(key); onSelect('tabbar'); if (screen) onNavigateScreen?.(screen); }}>
        {image ? <img src={image} alt="" /> : <i />}
      </button>; })}
      <span className="edit-hint">하단 탭</span>
    </div>
  );
}

function MainActions(props: Pick<PreviewProps, 'project' | 'platform' | 'screen' | 'selected' | 'onSelect'>) {
  const { platform, screen, selected, onSelect } = props;
  const actionSet = screen === 'friends' ? 'friends' : screen === 'more' ? 'more' : 'chats';
  const vector = platform === 'android' && actionSet === 'chats'
    ? { viewBox: ANDROID_CHAT_ACTIONS_VIEWBOX, path: ANDROID_CHAT_ACTIONS_PATH }
    : platform === 'ios'
      ? OFFICIAL_MAIN_ACTION_VECTORS.ios[actionSet]
      : OFFICIAL_MAIN_ACTION_VECTORS.android[actionSet === 'friends' ? 'friends' : 'more'];
  return <div className={`kt-main-actions actions-${actionSet}`} aria-hidden="true">
    <ColorHotspot slotId="main.header.foreground" selected={selected} onSelect={onSelect} className="header-icon-hotspot"><svg className="kt-official-actions" data-source={`${platform}-guide-26.5-${actionSet}`} viewBox={vector.viewBox}
      fill="currentColor" aria-hidden="true"><path d={vector.path} fillRule="evenodd" /></svg></ColorHotspot>
  </div>;
}

function MainHeader({ project, platform, screen, selected, onSelect }: Pick<PreviewProps, 'project' | 'platform' | 'screen' | 'selected' | 'onSelect'>) {
  const friends = screen === 'friends';
  const profile = profileImage(project, platform);
  return <div role="button" tabIndex={0} aria-label="위쪽 바 꾸미기" className="editable kt-main-header"
    data-selected={selected === 'header'} style={{
      color: cssColor(colorValue(project, platform, 'main.header.foreground')),
      backgroundColor: platform === 'android' ? cssColor(colorValue(project, platform, 'main.header.background')) : 'transparent',
    }}
    onClick={(event) => { event.stopPropagation(); onSelect('header'); }}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect('header'); }}>
    <h4>{friends && profile && <ProfileHotspot project={project} platform={platform} selected={selected} onSelect={onSelect} className="kt-header-profile" />}<ColorHotspot slotId="main.header.foreground" selected={selected} onSelect={onSelect}><span>{friends ? '어피치' : screen === 'now' ? '지금' : screen === 'more' ? '더보기' : '채팅'}</span></ColorHotspot></h4>
    <MainActions project={project} platform={platform} screen={screen} selected={selected} onSelect={onSelect} />
    <span className="edit-hint">위쪽 바</span>
  </div>;
}

function Chip({ selectedState, children, project, platform, selected, onSelect, moreKey }: Pick<PreviewProps, 'project' | 'platform' | 'selected' | 'onSelect'> & { selectedState: boolean; children: React.ReactNode; moreKey?: 'home' | 'wallet' }) {
  const slotId = platform === 'android' && moreKey
    ? (selectedState ? 'feature.browse.focused' : 'feature.browse.normal')
    : 'main.title.normal';
  const themeColor = cssColor(colorValue(project, platform, slotId));
  const selectedTextColor = cssColor(colorValue(project, platform, 'main.background'));
  const selectedTextLabel = getColorSlot('main.background').label;
  const moreWidth = moreKey ? (platform === 'ios' ? (moreKey === 'home' ? 50 : 64) : (moreKey === 'home' ? 46 : 58)) : undefined;
  return <ColorHotspot slotId={slotId} selected={selected} onSelect={onSelect} className={selectedState ? 'selected-chip' : ''}
    dataMoreChip={moreKey}
    style={selectedState ? { width: moreWidth, backgroundColor: themeColor, borderColor: themeColor } : { width: moreWidth, color: themeColor }}>{selectedState
      ? <span role="button" tabIndex={0} data-chip-selected-text aria-label={`${selectedTextLabel} 색상 편집`} style={{ color: selectedTextColor }}
          onClick={(event) => { event.stopPropagation(); onSelect('color:main.background'); }}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onSelect('color:main.background'); } }}>{children}</span>
      : <span style={{ color: themeColor }}>{children}</span>}</ColorHotspot>;
}

function ChipRow(props: Pick<PreviewProps, 'project' | 'platform' | 'screen' | 'selected' | 'onSelect'>) {
  const { project, platform, screen, selected, onSelect } = props;
  if (screen === 'friends') return <div className="kt-chip-row"><Chip {...props} selectedState>친구</Chip><Chip {...props} selectedState={false}>소식</Chip></div>;
  if (screen === 'now') return <div className="kt-chip-row"><Chip {...props} selectedState={false}>숏폼</Chip><Chip {...props} selectedState>오픈채팅 <em>N</em></Chip></div>;
  if (screen === 'more') return <div className="kt-chip-row"><Chip {...props} moreKey="home" selectedState>홈</Chip><Chip {...props} moreKey="wallet" selectedState={false}>지갑</Chip></div>;
  const filter = OFFICIAL_CHAT_FILTER_VECTORS[platform];
  return <div className="kt-chip-row"><Chip {...props} selectedState>전체</Chip><Chip {...props} selectedState={false}>안읽음 <em>40</em></Chip><Chip {...props} selectedState={false}>친구 <em>12</em></Chip>
    <ColorHotspot slotId="main.title.normal" selected={selected} onSelect={onSelect} className="kt-filter-chip" style={{ color: cssColor(colorValue(project, platform, 'main.title.normal')) }}>
      <svg className="kt-chat-filter-icon" data-source={`${platform}-guide-26.5-chat-filter`} viewBox={filter.viewBox} fill="currentColor" aria-hidden="true"><path d={filter.path} fillRule="evenodd" /></svg>
    </ColorHotspot>
  </div>;
}

function GuideBanner() {
  return <div className="kt-guide-banner"><div><b>오늘의 카카오가 궁금하다면?</b><small>카카오소식 보러가기</small></div></div>;
}

const chatRows = [
  ['어피치', '오늘의 정보기록', '오후 12:30', '2'],
  ['춘식이', '메시지 내용', '오후 12:30', '8'],
  ['탄천 러닝함께해요 34', '러닝이 최고죠', '오후 12:30', '10'],
  ['월간 독서 모임 3', '오늘 모임도 즐거웠어요', '어제', ''],
  ['동네 친구들 13', '사진 고마워!', '9월 12일', ''],
];

function Avatar({ project, platform, selected, onSelect, index, resourceId }: Pick<PreviewProps, 'project' | 'platform' | 'selected' | 'onSelect'> & { index: number; resourceId: ProfileResourceId }) {
  return <ProfileHotspot project={project} platform={platform} selected={selected} onSelect={onSelect} resourceId={resourceId} className={`kt-list-avatar avatar-${index}`} />;
}

function listRowStyle(project: ThemeProject, platform: Platform): React.CSSProperties {
  return {
    backgroundColor: cssColor(colorValue(project, platform, 'main.cell.normal')),
    '--kt-cell-pressed': cssColor(colorValue(project, platform, 'main.cell.pressed')),
    '--kt-title-pressed': cssColor(colorValue(project, platform, 'main.title.pressed')),
    '--kt-description-pressed': cssColor(colorValue(project, platform, 'main.description.pressed')),
    '--kt-paragraph-pressed': cssColor(colorValue(project, platform, 'main.paragraph.pressed')),
  } as React.CSSProperties;
}

function ContentHint() {
  return <span className="edit-hint">목록과 콘텐츠</span>;
}

function ChatList({ project, platform, selected, onSelect }: Pick<PreviewProps, 'project' | 'platform' | 'selected' | 'onSelect'>) {
  return <div className="editable kt-list kt-chat-list" role="button" tabIndex={0} aria-label="목록과 콘텐츠 꾸미기" data-selected={selected === 'content'} onClick={(event) => { event.stopPropagation(); onSelect('content'); }}>{chatRows.map((row, index) => <div className="kt-list-row" key={row[0]} style={listRowStyle(project, platform)}>
    <Avatar project={project} platform={platform} selected={selected} onSelect={onSelect} index={index} resourceId={PROFILE_RESOURCE_IDS[index % PROFILE_RESOURCE_IDS.length]} /><div className="kt-list-copy"><ColorHotspot slotId="main.title.normal" selected={selected} onSelect={onSelect}><b style={{ color: cssColor(colorValue(project, platform, 'main.title.normal')) }}>{row[0]}</b></ColorHotspot><ColorHotspot slotId="main.paragraph.normal" selected={selected} onSelect={onSelect}><p style={{ color: cssColor(colorValue(project, platform, 'main.paragraph.normal')) }}>{row[1]}</p></ColorHotspot></div>
    <div className="kt-row-meta"><time>{row[2]}</time>{row[3] && <em>{row[3]}</em>}</div>
  </div>)}<ContentHint /></div>;
}

function FriendsList({ project, platform, selected, onSelect }: Pick<PreviewProps, 'project' | 'platform' | 'selected' | 'onSelect'>) {
  const rows = [['업데이트한 친구', '새 소식이 있어요'], ['추천친구', '새로운 친구를 만나보세요!'], ['채널', '다양한 채널을 구독해 보세요!'], ['라이언', '오늘도 좋은 하루'], ['춘식이', '맛있는 간식 시간']];
  return <div className="editable kt-list kt-friends-list" role="button" tabIndex={0} aria-label="목록과 콘텐츠 꾸미기" data-selected={selected === 'content'} onClick={(event) => { event.stopPropagation(); onSelect('content'); }}><ColorHotspot slotId="main.section.foreground" selected={selected} onSelect={onSelect}><h5 style={{ color: cssColor(colorValue(project, platform, 'main.section.foreground')) }}>업데이트 프로필</h5></ColorHotspot>{rows.map((row, index) => <div className="kt-list-row" key={row[0]} style={listRowStyle(project, platform)}><Avatar project={project} platform={platform} selected={selected} onSelect={onSelect} index={index + 1} resourceId={PROFILE_RESOURCE_IDS[index % PROFILE_RESOURCE_IDS.length]} /><div className="kt-list-copy"><ColorHotspot slotId="main.title.normal" selected={selected} onSelect={onSelect}><b style={{ color: cssColor(colorValue(project, platform, 'main.title.normal')) }}>{row[0]}</b></ColorHotspot><ColorHotspot slotId="main.description.normal" selected={selected} onSelect={onSelect}><p style={{ color: cssColor(colorValue(project, platform, 'main.description.normal')) }}>{row[1]}</p></ColorHotspot></div></div>)}<ContentHint /></div>;
}

function NowList({ project, platform, selected, onSelect }: Pick<PreviewProps, 'project' | 'platform' | 'selected' | 'onSelect'>) {
  const rows = [['지금 뜨는 커뮤니티', '인기 있는 이야기를 만나보세요'], ['해외 여행 사진방', '여행 사진과 이야기를 나눠요'], ['수도권 날씨 실시간 대화방', '오늘 아침 바람 완전 가을 같지 않나요?'], ['설레는 라이언', '새로운 오픈채팅 소식']];
  const titleSlot = platform === 'ios' ? 'main.secondary.foreground' : 'main.title.normal';
  const paragraphSlot = platform === 'ios' ? 'main.secondary.foreground' : 'main.paragraph.normal';
  return <div className="editable kt-list kt-now-list" role="button" tabIndex={0} aria-label="목록과 콘텐츠 꾸미기" data-selected={selected === 'content'} onClick={(event) => { event.stopPropagation(); onSelect('content'); }}>{rows.map((row, index) => <div className="kt-list-row" key={row[0]} style={listRowStyle(project, platform)}><Avatar project={project} platform={platform} selected={selected} onSelect={onSelect} index={index + 2} resourceId={PROFILE_RESOURCE_IDS[index % PROFILE_RESOURCE_IDS.length]} /><div className="kt-list-copy"><ColorHotspot slotId={titleSlot} selected={selected} onSelect={onSelect}><b style={{ color: cssColor(colorValue(project, platform, titleSlot)) }}>{row[0]}</b></ColorHotspot><ColorHotspot slotId={paragraphSlot} selected={selected} onSelect={onSelect}><p style={{ color: cssColor(colorValue(project, platform, paragraphSlot)) }}>{row[1]}</p></ColorHotspot></div><div className="kt-row-meta"><time>{index + 1}분 전</time></div></div>)}<ContentHint /></div>;
}

const services = [
  ['gift', '선물하기'], ['received', '받은선물'], ['deal', '톡딜'], ['emoticon', '이모티콘'],
  ['live', '라이브쇼핑'], ['fashion', '브랜드패션'], ['makers', '메이커스'], ['friends', '프렌즈'],
  ['id', '모바일신분증'], ['calendar', '캘린더'], ['game', '게임'], ['reserve', '예약하기'],
] as const;

function MoreContent({ project, platform, selected, onSelect }: Pick<PreviewProps, 'project' | 'platform' | 'selected' | 'onSelect'>) {
  const foreground = cssColor(colorValue(project, platform, 'main.title.normal'));
  const defaultDotSlot = platform === 'ios' ? 'main.header.tab.normal' : 'feature.browse.normal';
  const defaultDotColor = cssColor(colorValue(project, platform, defaultDotSlot));
  return <div className="editable kt-more-content" role="button" tabIndex={0} aria-label="목록과 콘텐츠 꾸미기" data-selected={selected === 'content'} onClick={(event) => { event.stopPropagation(); onSelect('content'); }}><div className="kt-pay"><b>pay <small>53,000원</small></b><span>송금　│　자산　│　결제</span></div>
    <div className="kt-service-grid" style={{ backgroundColor: colorAtAlpha(colorValue(project, platform, 'main.title.normal'), 0.06) }}>{services.map(([key, label]) => { const icon = OFFICIAL_MORE_SERVICE_VECTORS[key]; return <ColorHotspot slotId="main.title.normal" selected={selected} onSelect={onSelect} className="kt-service-item" key={key} style={{ color: foreground }}>
      <svg className="kt-more-service-icon" data-source={`${platform}-guide-26.5-more-service`} viewBox={icon.viewBox} fill="currentColor" aria-hidden="true"><path d={icon.path} fillRule="evenodd" /></svg><span>{label}</span>
    </ColorHotspot>; })}<div className="kt-grid-pagination">
      <ColorHotspot slotId="main.title.normal" selected={selected} onSelect={onSelect}><i className="kt-grid-dot" data-active="true" style={{ backgroundColor: foreground }} /></ColorHotspot>
      {[0, 1, 2].map((index) => <ColorHotspot key={index} slotId={defaultDotSlot} selected={selected} onSelect={onSelect}><i className="kt-grid-dot" data-active="false" style={{ backgroundColor: defaultDotColor }} /></ColorHotspot>)}
    </div></div><ContentHint />
  </div>;
}

type MainBannerVariant = 'hidden' | 'banner';

function BottomBannerPreview({ project, platform, screen, selected, onSelect }: Pick<PreviewProps, 'project' | 'platform' | 'screen' | 'selected' | 'onSelect'>) {
  const layout = getHostLayout(platform, screen).tabBar!.bottomBanner;
  const backgroundColor = cssColor(colorValue(project, platform, 'main.banner'));
  const badgeColor = cssColor(colorValue(project, platform, 'main.description.normal'));
  const avatar = profileImage(project, platform);
  return <>
    <ColorHotspot slotId="main.banner" selected={selected} onSelect={onSelect} className="kt-banner-ad-pill" style={{
      position: 'absolute', zIndex: 49,
      top: layout.adPill.y, left: layout.adPill.x, width: layout.adPill.width, height: layout.adPill.height,
      backgroundColor, color: '#FFFFFF',
    }}>
      <span className="kt-banner-ad-avatar">{avatar && <img src={avatar} alt="" />}</span>
      <span className="kt-banner-ad-copy">일이삼사오육칠팔구십일이</span>
      <ColorHotspot slotId="main.description.normal" selected={selected} onSelect={onSelect} className="kt-banner-ad-badge" style={{ color: badgeColor }}>AD</ColorHotspot>
      <i className="kt-banner-close" aria-hidden="true" />
    </ColorHotspot>
    <ColorHotspot slotId="main.banner" selected={selected} onSelect={onSelect} className="kt-bottom-banner-preview" style={{
      position: 'absolute', zIndex: 49,
      top: layout.frame.y, left: layout.frame.x, width: layout.frame.width, height: layout.frame.height,
      display: 'flex', alignItems: 'center',
      borderRadius: 0,
      backgroundColor,
      color: '#FFFFFF',
      boxSizing: 'border-box',
    }}>
      <i className="kt-banner-play" aria-hidden="true" />
      <span className="kt-banner-message">추석 귀성길 교통상황, 서울서 부산 <b>7시간</b></span>
      <i className="kt-banner-close" aria-hidden="true" />
    </ColorHotspot>
  </>;
}

function MainScreen(props: PreviewProps & { bannerVariant?: MainBannerVariant }) {
  const { project, platform, screen, selected, onSelect } = props;
  return <div className={`kt-screen kt-main-screen screen-${screen}`} style={screenStyle(project, platform, screen)} onClick={() => onSelect('screen-background')}>
    <ThemeBackground project={project} platform={platform} screen={screen} />
    <MainHeader project={project} platform={platform} screen={screen} selected={selected} onSelect={onSelect} /><ChipRow project={project} platform={platform} screen={screen} selected={selected} onSelect={onSelect} />
    {screen !== 'more' && <GuideBanner />}
    {screen === 'friends' ? <FriendsList project={project} platform={platform} selected={selected} onSelect={onSelect} /> : screen === 'now' ? <NowList project={project} platform={platform} selected={selected} onSelect={onSelect} /> : screen === 'more' ? <MoreContent project={project} platform={platform} selected={selected} onSelect={onSelect} /> : <ChatList project={project} platform={platform} selected={selected} onSelect={onSelect} />}
    {props.bannerVariant && props.bannerVariant !== 'hidden' && <BottomBannerPreview project={project} platform={platform} screen={screen} selected={selected} onSelect={onSelect} />}
    <BottomTabs project={project} platform={platform} active={screen} selected={selected} onSelect={onSelect} onNavigateScreen={props.onNavigateScreen} />
  </div>;
}

function IosChatHeader({ project, selected, onSelect }: Pick<PreviewProps, 'project' | 'selected' | 'onSelect'>) {
  const platform = 'ios' as const;
  const vectors = OFFICIAL_CHATROOM_VECTORS.ios;
  const foreground = cssColor(colorValue(project, platform, 'main.header.foreground'));
  return <div role="button" tabIndex={0} aria-label="채팅방 위쪽 바 꾸미기" className="editable kt-chat-header kt-ios-chat-header" data-selected={selected === 'header'} style={{ color: foreground }} onClick={() => onSelect('header')}>
    <ColorHotspot slotId="main.header.foreground" selected={selected} onSelect={onSelect} className="kt-chat-back" style={{ gridColumn: 1 }}><OfficialVector platform={platform} {...vectors.back} /></ColorHotspot>
    <ColorHotspot slotId="main.header.foreground" selected={selected} onSelect={onSelect}><b data-alignment="center">어피치</b></ColorHotspot>
    <ColorHotspot slotId="main.header.foreground" selected={selected} onSelect={onSelect} className="kt-chat-fixed-actions" style={{ gridColumn: 3 }}><OfficialVector platform={platform} {...vectors.actions} /></ColorHotspot>
    <span className="edit-hint">채팅방 위쪽 바</span>
  </div>;
}

function AndroidChatHeader({ project, selected, onSelect }: Pick<PreviewProps, 'project' | 'selected' | 'onSelect'>) {
  const platform = 'android' as const;
  const vectors = OFFICIAL_CHATROOM_VECTORS.android;
  const foreground = cssColor(colorValue(project, platform, 'main.header.foreground'));
  const header = getHostLayout(platform, 'chatroom').header;
  return <div role="button" tabIndex={0} aria-label="채팅방 위쪽 바 꾸미기" className="editable kt-chat-header kt-android-chat-header" data-selected={selected === 'header'} style={{ color: foreground, top: header.y, height: header.height }} onClick={() => onSelect('header')}>
    <ColorHotspot slotId="main.header.foreground" selected={selected} onSelect={onSelect} className="kt-chat-back" style={{ gridColumn: 1 }}><OfficialVector platform={platform} {...vectors.back} /></ColorHotspot>
    <ColorHotspot slotId="main.header.foreground" selected={selected} onSelect={onSelect}><b data-alignment="start">어피치</b></ColorHotspot>
    <ColorHotspot slotId="main.header.foreground" selected={selected} onSelect={onSelect} className="kt-chat-fixed-actions" style={{ gridColumn: 3 }}><OfficialVector platform={platform} {...vectors.actions} /></ColorHotspot>
    <span className="edit-hint">채팅방 위쪽 바</span>
  </div>;
}

type NotificationVariant = 'notification' | 'notification-pressed' | 'direct-share';

function IosChatRoom(props: PreviewProps & { notificationVariant?: NotificationVariant }) {
  const { project, selected, onSelect } = props;
  const platform = 'ios' as const;
  const [draft, setDraft] = useState('카카오톡 테마');
  const [pressedControl, setPressedControl] = useState<'menu' | 'send' | null>(null);
  const composer = getScreenBlueprint('ios', 'chatroom').regions.composer!;
  const host = getHostLayout('ios', 'chatroom');
  const chat = host.chat!;
  const me = project.chat.bubbles.me;
  const you = project.chat.bubbles.you;
  const composerVectors = OFFICIAL_CHATROOM_VECTORS.ios.composer;
  const menuVector = composerVectors.find((icon) => icon.name === 'menu')!;
  const emojiVector = composerVectors.find((icon) => icon.name === 'emoji')!;
  const hashVector = composerVectors.find((icon) => icon.name === 'hash')!;
  const hasText = draft.length > 0;
  const inputBackground = cssColor(colorValue(project, 'ios', 'chat.input.background'));
  const menuBackground = cssColor(colorValue(project, 'ios', 'chat.input.menu.background'));
  return <div className="kt-screen kt-chatroom kt-ios-chatroom" data-platform-renderer="ios" style={screenStyle(project, 'ios', props.screen)} onClick={() => onSelect('screen-background')}>
    <ThemeBackground project={project} platform="ios" screen={props.screen} />
    <IosChatHeader project={project} selected={selected} onSelect={onSelect} />
    {props.screen === 'notification' && <Editable id="notification" label={props.notificationVariant === 'direct-share' ? '전달 완료 배너' : '메시지 알림'} selected={selected} onSelect={onSelect} className="kt-notification-bar" style={{ backgroundColor: cssColor(colorValue(project, 'ios', props.notificationVariant === 'direct-share' ? 'direct-share.background' : 'notification.background')) }}>
      <ProfileHotspot project={project} platform="ios" selected={selected} onSelect={onSelect} className="kt-notification-avatar" />
      {props.notificationVariant === 'direct-share'
        ? <span className="kt-notification-copy"><ColorHotspot slotId="direct-share.title" selected={selected} onSelect={onSelect}><b style={{ color: cssColor(colorValue(project, 'ios', 'direct-share.title')) }}>어피치</b></ColorHotspot><ColorHotspot slotId="direct-share.message" selected={selected} onSelect={onSelect}><span style={{ color: cssColor(colorValue(project, 'ios', 'direct-share.message')) }}>사진을 전달하였습니다.</span></ColorHotspot></span>
        : <span className="kt-notification-copy"><ColorHotspot slotId="notification.title" selected={selected} onSelect={onSelect}><b style={{ color: cssColor(colorValue(project, 'ios', 'notification.title')) }}>어피치</b></ColorHotspot><ColorHotspot slotId="notification.message" selected={selected} onSelect={onSelect}><span style={{ color: cssColor(colorValue(project, 'ios', 'notification.message')) }}>오랜만이야~</span></ColorHotspot></span>}
    </Editable>}
    <div className="kt-chat-body" style={{ top: host.content.y, height: host.content.height, bottom: 'auto' }}>
      <div className="kt-date" data-testid="date-chip">2024년 12월 20일 월요일</div>
      <div className="kt-message-flow" data-layout="flow" style={{
        paddingTop: chat.messageInset.top, paddingLeft: chat.messageInset.left, paddingRight: chat.messageInset.right,
        '--kt-avatar-size': `${chat.avatarSize}px`, '--kt-avatar-radius': `${chat.avatarRadius}px`,
        '--kt-avatar-gap': `${chat.avatarGap}px`, '--kt-sender-gap': `${chat.senderGap}px`,
        '--kt-group-gap': `${chat.groupGap}px`, '--kt-max-bubble-width': `${chat.maxBubbleWidth}px`,
      } as React.CSSProperties}>
        <div className="kt-message received" data-anchor="start"><ProfileHotspot project={project} platform="ios" selected={selected} onSelect={onSelect} className="kt-chat-avatar" />
          <div className="kt-message-stack" style={{ gap: chat.senderGap }}><span className="kt-sender">어피치</span><IosInsetBubble project={project} side="you" grouped={false} appearance={you.normal} selected={selected} onSelect={onSelect}>어피치피치한</IosInsetBubble>
            <div className="kt-received-last-row"><IosInsetBubble project={project} side="you" grouped appearance={you.grouped} selected={selected} onSelect={onSelect}>봄~봄~봄이 왔어요</IosInsetBubble><ColorHotspot slotId="chat.unread.received" selected={selected} onSelect={onSelect}><span className="kt-unread" style={{ color: cssColor(colorValue(project, 'ios', 'chat.unread.received')) }}>1</span></ColorHotspot><time>오후 12:03</time></div></div></div>
        <div className="kt-message sent" data-anchor="end" style={{ marginTop: chat.sentGap, gap: chat.groupGap }}><div className="kt-sent-row"><ColorHotspot slotId="chat.unread" selected={selected} onSelect={onSelect}><span className="kt-unread" style={{ color: cssColor(colorValue(project, 'ios', 'chat.unread')) }}>1</span></ColorHotspot><IosInsetBubble project={project} side="me" grouped={false} appearance={me.normal} selected={selected} onSelect={onSelect}>으아 설레에</IosInsetBubble></div>
          <div className="kt-sent-row kt-sent-last"><time data-position="left-of-last-bubble">오후 12:04</time><IosInsetBubble project={project} side="me" grouped appearance={me.grouped} selected={selected} onSelect={onSelect}>ㅎㅎㅎ</IosInsetBubble></div></div>
      </div>
    </div>
    <div className="kt-composer" data-testid="composer-region" data-top={composer.top} data-height={composer.height}
      style={{ top: composer.top, height: composer.height, padding: `${chat.composerControl.y}px ${host.viewport.width - chat.composerControl.x - chat.composerControl.width}px ${composer.height - chat.composerControl.y - chat.composerControl.height}px ${chat.composerControl.x}px` }}
      onClick={(event) => { event.stopPropagation(); onSelect('inputbar'); }}>
      <div className={`kt-composer-controls${hasText ? ' has-text' : ''}`} style={{ backgroundColor: inputBackground }}>
        <ElementHotspot id="inputbar-menu" label="메뉴 버튼" selected={selected} onSelect={onSelect} className="kt-composer-fixed-icon menu" style={{ backgroundColor: menuBackground }}
          onPointerDown={() => setPressedControl('menu')} onPointerUp={() => setPressedControl(null)} onPointerCancel={() => setPressedControl(null)} onPointerLeave={() => setPressedControl(null)}><span style={{ color: cssColor(colorValue(project, 'ios', pressedControl === 'menu' ? 'chat.input.menu.icon.pressed' : 'chat.input.menu.icon')) }}><OfficialVector platform="ios" {...menuVector} /></span></ElementHotspot>
        <ElementHotspot id="inputbar-field" label="메시지 입력 영역" selected={selected} onSelect={onSelect} className="kt-composer-pill"><input aria-label="메시지 입력 미리보기" value={draft} placeholder="메시지 입력" onChange={(event) => setDraft(event.target.value)} onClick={(event) => { event.stopPropagation(); onSelect('inputbar-field'); }} style={{ color: cssColor(colorValue(project, 'ios', 'chat.input.text')) }} /></ElementHotspot>
        <ElementHotspot id="inputbar-field" label="메시지 입력 영역" selected={selected} onSelect={onSelect} className="kt-composer-fixed-icon emoji"><span style={{ color: cssColor(colorValue(project, 'ios', 'chat.input.text')) }}><OfficialVector platform="ios" {...emojiVector} /></span></ElementHotspot>
        {!hasText && <ElementHotspot id="inputbar-menu" label="메뉴 버튼" selected={selected} onSelect={onSelect} className="kt-composer-fixed-icon hash" style={{ backgroundColor: menuBackground }}
          onPointerDown={() => setPressedControl('menu')} onPointerUp={() => setPressedControl(null)} onPointerCancel={() => setPressedControl(null)} onPointerLeave={() => setPressedControl(null)}><span style={{ color: cssColor(colorValue(project, 'ios', pressedControl === 'menu' ? 'chat.input.menu.icon.pressed' : 'chat.input.menu.icon')) }}><OfficialVector platform="ios" {...hashVector} /></span></ElementHotspot>}
        {hasText && <ElementHotspot id="inputbar-send" label="보내기 버튼" selected={selected} onSelect={onSelect} className="kt-chat-send" style={{ backgroundColor: cssColor(colorValue(project, 'ios', pressedControl === 'send' ? 'chat.input.send.background.pressed' : 'chat.input.send.background')) }}
          onPointerDown={() => setPressedControl('send')} onPointerUp={() => setPressedControl(null)} onPointerCancel={() => setPressedControl(null)} onPointerLeave={() => setPressedControl(null)}><span style={{ color: cssColor(colorValue(project, 'ios', pressedControl === 'send' ? 'chat.input.send.icon.pressed' : 'chat.input.send.icon')) }}><OfficialVector platform="ios" {...IOS_CHAT_SEND_VECTOR} /></span></ElementHotspot>}
      </div>
    </div>
  </div>;
}

function AndroidChatRoom(props: PreviewProps & { notificationVariant?: NotificationVariant }) {
  const { project, selected, onSelect } = props;
  const platform = 'android' as const;
  const [draft, setDraft] = useState('카카오톡 테마');
  const blueprint = getScreenBlueprint(platform, 'chatroom');
  const composer = blueprint.regions.composer!;
  const host = getHostLayout(platform, 'chatroom');
  const chat = host.chat!;
  const me = project.chat.bubbles.me;
  const you = project.chat.bubbles.you;
  const composerVectors = OFFICIAL_CHATROOM_VECTORS[platform].composer;
  const menuVector = composerVectors.find((icon) => icon.name === 'menu')!;
  const emojiVector = composerVectors.find((icon) => icon.name === 'emoji')!;
  const hashVector = composerVectors.find((icon) => icon.name === 'hash')!;
  const hasText = draft.length > 0;
  const sendVector = ANDROID_CHAT_SEND_VECTOR;
  const inputBackground = cssColor(colorValue(project, platform, 'chat.input.background'));
  const menuBackground = cssColor(colorValue(project, platform, 'chat.input.menu.background'));
  return <div className="kt-screen kt-chatroom kt-android-chatroom" data-platform-renderer="android" style={screenStyle(project, platform, props.screen)} onClick={() => onSelect('screen-background')}>
    <ThemeBackground project={project} platform={platform} screen={props.screen} />
    <AndroidChatHeader project={project} selected={selected} onSelect={onSelect} />
    {props.screen === 'notification' && <Editable id="notification" label={props.notificationVariant === 'direct-share' ? '전달 완료 배너' : '메시지 알림'} selected={selected} onSelect={onSelect} className="kt-notification-bar" style={{ backgroundColor: cssColor(colorValue(project, platform, props.notificationVariant === 'direct-share' ? 'direct-share.background' : props.notificationVariant === 'notification-pressed' ? 'notification.background.pressed' : 'notification.background')) }}>
      <ProfileHotspot project={project} platform={platform} selected={selected} onSelect={onSelect} className="kt-notification-avatar" />
      {props.notificationVariant === 'direct-share'
        ? <ColorHotspot slotId="direct-share.title" selected={selected} onSelect={onSelect} className="kt-notification-copy"><span style={{ color: cssColor(colorValue(project, platform, 'direct-share.title')) }}>어피치에게 메시지를 전달하였습니다.</span></ColorHotspot>
        : <span className="kt-notification-copy"><ColorHotspot slotId="notification.title" selected={selected} onSelect={onSelect}><b style={{ color: cssColor(colorValue(project, platform, 'notification.title')) }}>어피치</b><span style={{ color: cssColor(colorValue(project, platform, 'notification.title')) }}>오랜만이야~</span></ColorHotspot></span>}
      {props.notificationVariant === 'direct-share' && <ColorHotspot slotId="direct-share.button" selected={selected} onSelect={onSelect}><span className="kt-notification-move" style={{ color: cssColor(colorValue(project, platform, 'direct-share.button')) }}>채팅방 이동</span></ColorHotspot>}
    </Editable>}
    <div className="kt-chat-body" style={{ top: host.content.y, height: host.content.height, bottom: 'auto' }}>
      {chat.showsDateChip && <div className="kt-date" data-testid="date-chip">2024년 12월 20일 월요일</div>}
      <div className="kt-message-flow" data-layout="flow" style={{
        paddingTop: chat.messageInset.top,
        paddingLeft: chat.messageInset.left,
        paddingRight: chat.messageInset.right,
        '--kt-avatar-size': `${chat.avatarSize}px`,
        '--kt-avatar-radius': `${chat.avatarRadius}px`,
        '--kt-avatar-gap': `${chat.avatarGap}px`,
        '--kt-sender-gap': `${chat.senderGap}px`,
        '--kt-group-gap': `${chat.groupGap}px`,
        '--kt-max-bubble-width': `${chat.maxBubbleWidth}px`,
      } as React.CSSProperties}>
      <div className="kt-message received" data-anchor="start"><ProfileHotspot project={project} platform={platform} selected={selected} onSelect={onSelect} className="kt-chat-avatar" />
        <div className="kt-message-stack" style={{ gap: chat.senderGap }}><span className="kt-sender">어피치</span><AndroidNinePatchBubble project={project} side="you" grouped={false} appearance={you.normal} selected={selected} onSelect={onSelect}>어피치피치한</AndroidNinePatchBubble>
          <AndroidNinePatchBubble project={project} side="you" grouped appearance={you.grouped} selected={selected} onSelect={onSelect}>봄~봄~봄이 왔어요</AndroidNinePatchBubble>
          <div className="kt-received-last-row"><AndroidNinePatchBubble project={project} side="you" grouped appearance={you.grouped} selected={selected} onSelect={onSelect}>ㅎㅎㅎ</AndroidNinePatchBubble><time>오후 12:03</time></div></div></div>
      <div className="kt-message sent" data-anchor="end" style={{ marginTop: chat.sentGap, gap: chat.groupGap }}><div className="kt-sent-row"><ColorHotspot slotId="chat.unread" selected={selected} onSelect={onSelect}><span className="kt-unread" style={{ color: cssColor(colorValue(project, platform, 'chat.unread')) }}>1</span></ColorHotspot><AndroidNinePatchBubble project={project} side="me" grouped={false} appearance={me.normal} selected={selected} onSelect={onSelect}>으아 설레에</AndroidNinePatchBubble></div>
        <div className="kt-sent-row kt-sent-last"><time data-position="left-of-last-bubble">오후 12:04</time><AndroidNinePatchBubble project={project} side="me" grouped appearance={me.grouped} selected={selected} onSelect={onSelect}>ㅎㅎㅎ</AndroidNinePatchBubble></div></div>
      </div>
    </div>
    <div className="kt-composer" data-testid="composer-region" data-top={composer.top} data-height={composer.height}
      style={{ top: composer.top, height: composer.height, padding: `${chat.composerControl.y}px ${host.viewport.width - chat.composerControl.x - chat.composerControl.width}px ${composer.height - chat.composerControl.y - chat.composerControl.height}px ${chat.composerControl.x}px` }}
      onClick={(event) => { event.stopPropagation(); onSelect('inputbar'); }}>
      <div className={`kt-composer-controls${hasText ? ' has-text' : ''}`} style={{ backgroundColor: inputBackground }}>
        <ElementHotspot id="inputbar-menu" label="메뉴 버튼" selected={selected} onSelect={onSelect} className="kt-composer-fixed-icon menu" style={{ backgroundColor: menuBackground }}>
          <span style={{ color: cssColor(colorValue(project, platform, 'chat.input.menu.icon')) }}><OfficialVector platform={platform} {...menuVector} /></span>
        </ElementHotspot>
        <ElementHotspot id="inputbar-field" label="메시지 입력 영역" selected={selected} onSelect={onSelect} className="kt-composer-pill">
          <input aria-label="메시지 입력 미리보기" value={draft} placeholder="메시지 입력" onChange={(event) => setDraft(event.target.value)} onClick={(event) => { event.stopPropagation(); onSelect('inputbar-field'); }} style={{ color: cssColor(colorValue(project, platform, 'chat.input.text')) }} />
        </ElementHotspot>
        <ElementHotspot id="inputbar-field" label="메시지 입력 영역" selected={selected} onSelect={onSelect} className="kt-composer-fixed-icon emoji">
          <span style={{ color: cssColor(colorValue(project, platform, 'chat.input.text')) }}><OfficialVector platform={platform} {...emojiVector} /></span>
        </ElementHotspot>
        {!hasText && <ElementHotspot id="inputbar-menu" label="메뉴 버튼" selected={selected} onSelect={onSelect} className="kt-composer-fixed-icon hash" style={{ backgroundColor: menuBackground }}>
          <span style={{ color: cssColor(colorValue(project, platform, 'chat.input.menu.icon')) }}><OfficialVector platform={platform} {...hashVector} /></span>
        </ElementHotspot>}
        {hasText && <ElementHotspot id="inputbar-send" label="보내기 버튼" selected={selected} onSelect={onSelect} className="kt-chat-send" style={{ backgroundColor: cssColor(colorValue(project, platform, 'chat.input.send.background')) }}>
          <span style={{ color: cssColor(colorValue(project, platform, 'chat.input.send.icon')) }}><OfficialVector platform={platform} {...sendVector} /></span>
        </ElementHotspot>}
      </div>
    </div>
  </div>;
}

function PasscodeScreen(props: PreviewProps) {
  const { project, platform, selected, onSelect } = props;
  const passcode = getHostLayout(platform, 'passcode').passcode!;
  const [entered, setEntered] = useState(0);
  const [pressed, setPressed] = useState<number | null>(null);
  const pressedImage = resolveResourceUrl(project, platform, 'passcode.keypad.pressed');
  const enterDigit = () => setEntered((current) => Math.min(4, current + 1));
  const deleteDigit = () => setEntered((current) => Math.max(0, current - 1));
  const bullets = <div className="kt-passcode-bullets" role="button" tabIndex={0} aria-label="잠금화면 상태별 이미지 꾸미기"
    style={platform === 'ios' ? { top: passcode.bulletTop } : undefined}
    onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); }}>
    {[1, 2, 3, 4].map((index) => {
      const state = index <= entered ? 'selected' : 'normal';
      const image = resolveResourceUrl(project, platform, `passcode.bullet.${index}.${state}`);
      return image ? <img key={index} data-testid={`passcode-bullet-${index}`} data-passcode-bullet={index} data-state={state} src={image} alt="" />
        : <i key={index} data-testid={`passcode-bullet-${index}`} data-passcode-bullet={index} data-state={state} />;
    })}
  </div>;
  return <div className="kt-screen kt-passcode" style={screenStyle(project, platform, 'passcode')} onClick={() => onSelect('screen-background')}>
    <ThemeBackground project={project} platform={platform} screen="passcode" />
    {platform === 'android' && <span className="kt-passcode-keypad-background" style={{ top: passcode.keypad.y, backgroundColor: cssColor(colorValue(project, platform, 'passcode.keypad.background')) }} aria-hidden="true" />}
    <div className="kt-passcode-title" style={{ top: passcode.titleTop, color: cssColor(colorValue(project, platform, 'passcode.foreground')) }}><ColorHotspot slotId="passcode.foreground" selected={selected} onSelect={onSelect} className="kt-passcode-title-copy"><span><h4>{platform === 'ios' ? '암호 입력' : '암호'}</h4><p>{platform === 'ios' ? '카카오톡 암호를 입력해 주세요.' : '카카오톡 암호를 입력해주세요.'}</p></span></ColorHotspot>{platform === 'android' && bullets}</div>
    {platform === 'ios' && bullets}
    <div role="button" tabIndex={0} aria-label="숫자 키패드 꾸미기" className="editable kt-keypad" data-selected={selected === 'passcode-keypad'} data-testid="passcode-keypad"
      data-frame={`${passcode.keypad.x},${passcode.keypad.y},${passcode.keypad.width},${passcode.keypad.height}`}
      style={{ top: passcode.keypad.y, height: passcode.keypad.height, backgroundColor: platform === 'ios' ? cssColor(colorValue(project, platform, 'passcode.keypad.background')) : 'transparent' }} onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect('passcode-keypad'); }}>
      {[1,2,3,4,5,6,7,8,9].map((key) => <button type="button" key={key} aria-label={`숫자 ${key} 입력`} className="kt-keypad-key"
        style={{ color: cssColor(colorValue(project, platform, platform === 'android' && pressed === key ? 'passcode.keypad.text.pressed' : 'passcode.keypad.text')) }}
        onPointerDown={(event) => { event.stopPropagation(); setPressed(key); }} onPointerUp={() => setPressed(null)} onPointerCancel={() => setPressed(null)} onPointerLeave={() => setPressed(null)}
        onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); enterDigit(); }}>
        {pressed === key && (pressedImage ? <img className="kt-keypad-pressed-image" src={pressedImage} alt="" /> : platform === 'android' ? <span className="kt-keypad-pressed-color" style={{ backgroundColor: cssColor(colorValue(project, platform, 'passcode.keypad.background.pressed')) }} /> : null)}<span>{key}</span>
      </button>)}
      {platform === 'ios'
        ? <button type="button" className="kt-keypad-cancel" aria-label="키패드 취소" style={{ color: cssColor(colorValue(project, platform, 'passcode.keypad.text')) }} onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); }}>취소</button>
        : <span className="kt-keypad-empty" aria-hidden="true" />}
      <button type="button" aria-label="숫자 0 입력" className="kt-keypad-key"
        style={{ color: cssColor(colorValue(project, platform, platform === 'android' && pressed === 0 ? 'passcode.keypad.text.pressed' : 'passcode.keypad.text')) }}
        onPointerDown={(event) => { event.stopPropagation(); setPressed(0); }} onPointerUp={() => setPressed(null)} onPointerCancel={() => setPressed(null)} onPointerLeave={() => setPressed(null)}
        onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); enterDigit(); }}>
        {pressed === 0 && (pressedImage ? <img className="kt-keypad-pressed-image" src={pressedImage} alt="" /> : platform === 'android' ? <span className="kt-keypad-pressed-color" style={{ backgroundColor: cssColor(colorValue(project, platform, 'passcode.keypad.background.pressed')) }} /> : null)}<span>0</span>
      </button>
      <button type="button" className="kt-keypad-delete" aria-label="한 자리 지우기" style={{ color: cssColor(colorValue(project, platform, 'passcode.keypad.text')) }} onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); deleteDigit(); }}><svg data-source={`${platform}-guide-26.5`} viewBox="0 0 48 31" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 2.5H45.5V28.5H16L2.5 15.5Z" /><path d="m26 10 11 11m0-11L26 21" /></svg></button>
      <span className="edit-hint">숫자 키패드</span>
    </div>
  </div>;
}

function SplashScreen(props: PreviewProps) {
  const { project, platform, selected, onSelect } = props;
  if (platform === 'ios') return <div className="kt-screen kt-splash" style={screenStyle(project, platform, 'splash')} onClick={() => onSelect('screen-background')} />;
  const image = resolveResourceUrl(project, platform, 'splash.image');
  return <div className="kt-screen kt-splash" style={screenStyle(project, platform, 'splash')} onClick={() => onSelect('screen-background')}>
    <ThemeBackground project={project} platform={platform} screen="splash" />
    {image && <Editable id="splash-image" label="시작 이미지" selected={selected} onSelect={onSelect} className="kt-splash-content"><img src={image} alt="" /></Editable>}</div>;
}

export function PhonePreview(props: PreviewProps) {
  const blueprint = getScreenBlueprint(props.platform, props.screen);
  const host = getHostLayout(props.platform, props.screen);
  const [width, height] = blueprint.viewport;
  const scale = props.previewScale ?? 0.75;
  const [notificationVariant, setNotificationVariant] = useState<NotificationVariant>(props.platform === 'ios' ? 'notification' : 'direct-share');
  const [bannerVariant, setBannerVariant] = useState<MainBannerVariant>('hidden');
  useEffect(() => setNotificationVariant(props.platform === 'ios' ? 'notification' : 'direct-share'), [props.platform]);
  useEffect(() => setBannerVariant('hidden'), [props.platform, props.screen]);
  const supportsBannerPreview = (props.platform === 'ios' && props.screen === 'chats') || (props.platform === 'android' && props.screen === 'now');
  const style = {
    '--kt-width': `${width}px`, '--kt-height': `${height}px`, '--kt-scale': scale,
    '--kt-bezel': `${host.bezel}px`, '--kt-frame-radius': `${host.frameRadius}px`, '--kt-radius': `${host.radius}px`,
    '--kt-font-family': previewFontFamily(props.platform, props.project.font?.family),
    width: `${(width + host.bezel * 2) * scale}px`, height: `${(height + host.bezel * 2) * scale}px`,
    padding: `${host.bezel * scale}px`,
  } as React.CSSProperties;
  if (host.chat) {
    Object.assign(style, {
      '--kt-composer-height': `${host.chat.composerControl.height}px`,
      '--kt-composer-button-size': `${host.chat.composerButtonSize}px`,
      '--kt-composer-emoji-button-size': `${host.chat.composerEmojiButtonSize}px`,
      '--kt-composer-send-button-size': `${host.chat.composerSendButtonSize}px`,
      '--kt-composer-field-offset': `${host.chat.composerFieldOffset}px`,
      '--kt-composer-menu-inset': `${host.chat.composerMenuInset}px`,
      '--kt-composer-input-inset': `${host.chat.composerInputInset}px`,
      '--kt-composer-send-inset': `${host.chat.composerSendInset}px`,
      '--kt-composer-emoji-gap': `${host.chat.composerEmojiGap}px`,
      '--kt-composer-menu-icon-size': `${host.chat.composerIconSize.menu}px`,
      '--kt-composer-emoji-icon-size': `${host.chat.composerIconSize.emoji}px`,
      '--kt-composer-hash-icon-size': `${host.chat.composerIconSize.hash}px`,
      '--kt-composer-send-icon-size': `${host.chat.composerIconSize.send}px`,
    });
  }
  const content = props.screen === 'chatroom' || props.screen === 'notification'
    ? props.platform === 'ios' ? <IosChatRoom {...props} notificationVariant={notificationVariant} /> : <AndroidChatRoom {...props} notificationVariant={notificationVariant} />
    : props.screen === 'passcode' ? <PasscodeScreen {...props} />
      : props.screen === 'splash' ? <SplashScreen {...props} /> : <MainScreen {...props} bannerVariant={supportsBannerPreview ? bannerVariant : 'hidden'} />;
  return <div className="phone-preview-stack">
    {props.screen === 'notification' && <div className="preview-state-switcher" aria-label="알림 상태"><button type="button" data-active={notificationVariant === 'notification'} onClick={() => setNotificationVariant('notification')}>메시지 알림</button>{props.platform === 'android' && <button type="button" data-active={notificationVariant === 'notification-pressed'} onClick={() => setNotificationVariant('notification-pressed')}>알림 눌림</button>}<button type="button" data-active={notificationVariant === 'direct-share'} aria-label="전달 완료 보기" onClick={() => setNotificationVariant('direct-share')}>전달 완료</button></div>}
    {supportsBannerPreview && <div className="preview-state-switcher" aria-label="탭 배너 상태"><button type="button" data-active={bannerVariant === 'hidden'} onClick={() => setBannerVariant('hidden')}>기본</button><button type="button" data-active={bannerVariant === 'banner'} onClick={() => setBannerVariant('banner')}>탭 배너</button></div>}
    {props.platform === 'android' && props.screen === 'splash' && <p className="preview-availability-note">Android 12 미만에서 적용</p>}
  <div className={`device-frame actual-device guide-device ${props.platform}`} style={style}
    aria-label="카카오톡 미리보기" data-kakao-version={KAKAO_PREVIEW_VERSION}
    data-viewport={`${width}x${height}`} data-bezel={host.bezel} data-frame-radius={host.frameRadius} data-screen-radius={host.radius}
    data-layout-kind={blueprint.kind} data-source={blueprint.source}>
    <div className="screen-scaler guide-scaler" style={{ borderRadius: host.radius }}>{content}</div>
  </div></div>;
}
