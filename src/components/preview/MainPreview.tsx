import { useEffect, useState } from 'react';
import type { Platform, ScreenId, ThemeProject } from '../../domain/theme/model';
import { resolveResourceAsset, resolveResourceUrl } from '../../manifest/resourceResolver';
import { colorValue, cssColor } from '../../manifest/colorResolver';
import { getColorSlot } from '../../manifest/kakaoColors';
import { getHostLayout } from '../../preview/layout';
import { ANDROID_CHAT_ACTIONS_PATH, ANDROID_CHAT_ACTIONS_VIEWBOX } from '../../preview/officialUiVectors';
import { OFFICIAL_CHAT_FILTER_VECTORS, OFFICIAL_MAIN_ACTION_VECTORS, OFFICIAL_MORE_SERVICE_VECTORS } from '../../preview/officialMainUiVectors';
import {
  BorderlessNinePatchImage, ColorHotspot, ProfileHotspot, ThemeBackground, colorAtAlpha, profileImage,
  screenStyle,
} from './PreviewHotspots';
import {
  PROFILE_RESOURCE_IDS, type PreviewProps, type ProfileResourceId,
} from './PreviewTypes';

const tabs = [
  ['friends', '친구', 'friends'], ['chats', '채팅', 'chats'], ['now', '지금', 'now'],
  ['shopping', '쇼핑', null], ['more', '더보기', 'more'],
] as const;

function tabIcon(project: ThemeProject, platform: Platform, key: string, active: boolean) {
  return resolveResourceUrl(project, platform, `main.tab.${key}.${active ? 'selected' : 'normal'}`);
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
  return <div className={`kt-main-actions actions-${actionSet}`} aria-hidden="true"><ColorHotspot slotId="main.header.foreground" selected={selected} onSelect={onSelect} className="header-icon-hotspot"><svg className="kt-official-actions" data-source={`${platform}-guide-26.5-${actionSet}`} viewBox={vector.viewBox}
    fill="currentColor" aria-hidden="true"><path d={vector.path} fillRule="evenodd" /></svg></ColorHotspot></div>;
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

export type MainBannerVariant = 'hidden' | 'banner';

function BottomBannerPreview({ project, platform, screen, selected, onSelect }: Pick<PreviewProps, 'project' | 'platform' | 'screen' | 'selected' | 'onSelect'>) {
  const layout = getHostLayout(platform, screen).tabBar!.bottomBanner;
  const backgroundColor = cssColor(colorValue(project, platform, 'main.banner'));
  const badgeColor = cssColor(colorValue(project, platform, 'main.description.normal'));
  const avatar = profileImage(project, platform);
  return <>
    <ColorHotspot slotId="main.banner" selected={selected} onSelect={onSelect} className="kt-banner-ad-pill" style={{ position: 'absolute', zIndex: 49, top: layout.adPill.y, left: layout.adPill.x, width: layout.adPill.width, height: layout.adPill.height, backgroundColor, color: '#FFFFFF' }}>
      <span className="kt-banner-ad-avatar">{avatar && <img src={avatar} alt="" />}</span><span className="kt-banner-ad-copy">일이삼사오육칠팔구십일이</span><ColorHotspot slotId="main.description.normal" selected={selected} onSelect={onSelect} className="kt-banner-ad-badge" style={{ color: badgeColor }}>AD</ColorHotspot><i className="kt-banner-close" aria-hidden="true" />
    </ColorHotspot>
    <ColorHotspot slotId="main.banner" selected={selected} onSelect={onSelect} className="kt-bottom-banner-preview" style={{ position: 'absolute', zIndex: 49, top: layout.frame.y, left: layout.frame.x, width: layout.frame.width, height: layout.frame.height, display: 'flex', alignItems: 'center', borderRadius: 0, backgroundColor, color: '#FFFFFF', boxSizing: 'border-box' }}>
      <i className="kt-banner-play" aria-hidden="true" /><span className="kt-banner-message">추석 귀성길 교통상황, 서울서 부산 <b>7시간</b></span><i className="kt-banner-close" aria-hidden="true" />
    </ColorHotspot>
  </>;
}

export function MainPreview(props: PreviewProps & { bannerVariant?: MainBannerVariant }): React.ReactElement {
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
