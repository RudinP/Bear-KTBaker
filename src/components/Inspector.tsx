import type { EditableElementId, ImageAsset, Platform, ScreenId, ThemeProject } from '../domain/theme';
import { getResourceSlot } from '../manifest/kakaoResources';
import { resolveResourceAsset, resolveResourceUrl } from '../manifest/resourceResolver';
import { KAKAO_COLOR_SLOTS, getColorSlot } from '../manifest/kakaoColors';
import { colorAlpha, colorValue, cssColor, opaqueColor, setColorSlot, setColorSlotAlpha } from '../manifest/colorResolver';
import { pngDimensionsFromDataUrl, uploadSourceScale } from '../io/resourceGeometry';

const labels: Partial<Record<EditableElementId, string>> = {
  'screen-background': '화면 배경', header: '위쪽 바', tabbar: '하단 탭',
  'bubble-me': '내가 보낸 말풍선', 'bubble-you': '받은 말풍선', inputbar: '메시지 입력창',
  'inputbar-field': '메시지 입력 영역', 'inputbar-menu': '메뉴 버튼', 'inputbar-send': '보내기 버튼',
  notification: '메시지 알림',
  profile: '기본 프로필', 'passcode-keypad': '잠금화면', 'splash-image': '시작 이미지',
  content: '목록과 콘텐츠',
};

function selectionLabel(selected: EditableElementId) {
  if (selected.startsWith('color:')) return getColorSlot(selected.slice(6)).label;
  return labels[selected] ?? '선택한 부분';
}

function readFile(file: File, platform: Platform, resourceId: string, callback: (asset: ImageAsset) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    const dimensions = pngDimensionsFromDataUrl(dataUrl);
    const asset: ImageAsset = {
      fileName: file.name,
      dataUrl,
      ...dimensions,
      sourceScale: uploadSourceScale(platform, resourceId, file.name),
      rawNinePatch: platform === 'android' && /\.9\.png$/i.test(file.name),
    };
    callback(asset);
    if (dimensions) return;
    const image = new Image();
    image.onload = () => callback({ ...asset, width: image.naturalWidth, height: image.naturalHeight });
    image.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function ResourceUpload({ project, platform, resourceId, label, onResource, action }: {
  project: ThemeProject;
  platform: Platform;
  resourceId: string;
  label: string;
  onResource: (resourceId: string, asset: ImageAsset) => void;
  action?: { label: string; onClick: () => void };
}) {
  const asset = resolveResourceAsset(project, platform, resourceId);
  getResourceSlot(resourceId);
  const preview = asset?.dataUrl ?? resolveResourceUrl(project, platform, resourceId);
  const assetMetadata = asset && `${asset.fileName}${asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ''}`;
  return <div className={`file-drop resource-file${action ? ' has-action' : ''}`}>
    <label className="resource-picker"><input type="file" aria-label={`${label} 이미지`} accept="image/png,image/jpeg,image/webp"
      onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file, platform, resourceId, (asset) => onResource(resourceId, asset)); }} />
      <span className="asset-thumb" style={preview ? { backgroundImage: `url(${preview})` } : undefined} />
      <span className="resource-file-copy"><b>{label}</b>{assetMetadata && <small className="resource-file-meta" title={assetMetadata}>{assetMetadata}</small>}</span>
    </label>
    {action && <button type="button" className="resource-action" aria-label={`${label} ${action.label}`} onClick={action.onClick}>{action.label}</button>}
  </div>;
}

const tabUploads = [
  ['main.tab.background', '하단 탭 배경'],
  ['main.tab.friends.normal', '친구 탭 기본'], ['main.tab.friends.selected', '친구 탭 선택'],
  ['main.tab.chats.normal', '채팅 탭 기본'], ['main.tab.chats.selected', '채팅 탭 선택'],
  ['main.tab.now.normal', '지금 탭 기본'], ['main.tab.now.selected', '지금 탭 선택'],
  ['main.tab.shopping.normal', '쇼핑 탭 기본'], ['main.tab.shopping.selected', '쇼핑 탭 선택'],
  ['main.tab.more.normal', '더보기 탭 기본'], ['main.tab.more.selected', '더보기 탭 선택'],
  ['main.tab.piccoma.normal', '픽코마 탭 기본'], ['main.tab.piccoma.selected', '픽코마 탭 선택'],
  ['main.tab.call.normal', '콜 탭 기본'], ['main.tab.call.selected', '콜 탭 선택'],
] as const;

const passcodeBulletUploads = [
  ...[1, 2, 3, 4].flatMap((index) => [
    [`passcode.bullet.${index}.normal`, `${index}번째 불릿 기본`],
    [`passcode.bullet.${index}.selected`, `${index}번째 불릿 입력됨`],
  ] as const),
];

function screenResource(screen: ScreenId) {
  if (screen === 'chatroom' || screen === 'notification') return 'chat.background';
  if (screen === 'passcode') return 'passcode.background';
  if (screen === 'splash') return 'splash.image';
  return 'main.background';
}

export function Inspector({ project, platform, selected, screen, onProject, onNinePatch }: {
  project: ThemeProject;
  platform: Platform;
  selected: EditableElementId;
  screen: ScreenId;
  onProject: (project: ThemeProject) => void;
  onNinePatch: (variant: 'normal' | 'pressed' | 'grouped' | 'groupedPressed', resourceId: string) => void;
}) {
  const isMe = selected === 'bubble-me';
  const isYou = selected === 'bubble-you';
  const bubble = isMe ? project.chat.bubbles.me.normal : project.chat.bubbles.you.normal;
  const screenFill = project.screens[screen].background;
  const exactColorSlot = selected.startsWith('color:') ? selected.slice(6) : undefined;
  const colorSlots = exactColorSlot
    ? [getColorSlot(exactColorSlot)]
    : KAKAO_COLOR_SLOTS.filter((slot) => slot.screens.includes(screen) && (
      slot.targets.includes(selected as never)
      || (selected === 'notification' && slot.targets.includes('direct-share'))
    ));

  const setResource = (resourceId: string, asset: ImageAsset) => onProject({
    ...project,
    platformResources: {
      ...project.platformResources,
      [platform]: { ...project.platformResources[platform], [resourceId]: asset },
    },
  });
  const updateBubble = (patch: Partial<typeof bubble>) => {
    const side = isMe ? 'me' : 'you';
    const set = project.chat.bubbles[side];
    onProject({ ...project, chat: { ...project.chat, bubbles: { ...project.chat.bubbles, [side]: { ...set, normal: { ...set.normal, ...patch } } } } });
  };
  const bubbleSide = isMe ? 'me' : 'you';
  const bubbleLabel = isMe ? '보낸' : '받은';
  const bubbleUploads = platform === 'android'
    ? [
        [`chat.bubble.${bubbleSide}.first.normal`, `${bubbleLabel} 첫 말풍선`, 'normal'],
        [`chat.bubble.${bubbleSide}.grouped.normal`, `${bubbleLabel} 연속 말풍선`, 'grouped'],
      ] as const
    : [
        [`chat.bubble.${bubbleSide}.first.normal`, `${bubbleLabel} 첫 말풍선`, 'normal'],
        [`chat.bubble.${bubbleSide}.first.pressed`, `${bubbleLabel} 첫 말풍선 눌림`, 'pressed'],
        [`chat.bubble.${bubbleSide}.grouped.normal`, `${bubbleLabel} 연속 말풍선`, 'grouped'],
        [`chat.bubble.${bubbleSide}.grouped.pressed`, `${bubbleLabel} 연속 말풍선 눌림`, 'groupedPressed'],
      ] as const;
  const passcodeUploads = platform === 'ios'
    ? [...passcodeBulletUploads, ['passcode.keypad.pressed', '숫자 키패드 눌림'] as const]
    : passcodeBulletUploads;

  return <aside className="inspector-panel">
    <div className="inspector-title"><span className="panel-kicker">선택한 부분</span><h2>{selectionLabel(selected)}</h2></div>
    {colorSlots.length > 0 && <section className="control-group color-slot-list"><div className="control-heading"><span>연결된 색상</span><span>{platform === 'ios' ? 'iPhone' : 'Android'}</span></div>
      {colorSlots.map((slot) => {
        const keys = slot[platform];
        if (!keys.length) return null;
        const value = colorValue(project, platform, slot.id);
        const alpha = colorAlpha(project, platform, slot.id);
        const alphaPercent = alpha === undefined ? undefined : Math.round(alpha * 100);
        const previewColor = cssColor(value).toUpperCase();
        return <div className="color-slot-control" data-color-slot={slot.id} key={slot.id}>
          <label className="color-swatch-picker">
            <span className="color-swatch-checker" aria-hidden="true">
              <span data-testid={`${slot.id}-color-swatch`} data-preview-color={previewColor} style={{ backgroundColor: previewColor }} />
            </span>
            <input aria-label={`${slot.label} 색상`} type="color" value={opaqueColor(value)} onChange={(event) => onProject(setColorSlot(project, platform, slot.id, event.target.value))} />
          </label>
          <span className="color-slot-copy"><b>{slot.label}</b><small title={keys.join(' · ')}>{keys.join(' · ')}</small></span>
          <span className="color-slot-values">
            <code>{opaqueColor(value).toUpperCase()}</code>
            {alphaPercent !== undefined && <label className="color-alpha-field">
              <span>알파</span>
              <input aria-label={`${slot.label} 알파값`} type="number" min="0" max="100" step="1" value={alphaPercent}
                onChange={(event) => {
                  if (event.target.value === '') return;
                  const percent = Number(event.target.value);
                  if (Number.isFinite(percent)) onProject(setColorSlotAlpha(project, platform, slot.id, percent / 100));
                }} />
              <span>%</span>
            </label>}
          </span>
        </div>;
      })}
    </section>}
    {selected === 'screen-background' && <section className="control-group">
      <ResourceUpload project={project} platform={platform} resourceId={screenResource(screen)} label="배경" onResource={setResource} />
      <p className="asset-priority-note">이미지 첨부 시 이미지가 우선적으로 적용됩니다.</p>
    </section>}

    {selected === 'tabbar' && <section className="control-group resource-list"><div className="control-heading"><span>하단 탭 이미지</span><span className="auto-label">기본 · 선택</span></div>
      {tabUploads.map(([id, label]) => <ResourceUpload key={id} project={project} platform={platform} resourceId={id} label={label} onResource={setResource} />)}
    </section>}

    {selected === 'profile' && <section className="control-group resource-list"><div className="control-heading"><span>프로필과 친구 추가 이미지</span></div>
      {[1, 2, 3].map((index) => <ResourceUpload key={`profile-${index}`} project={project} platform={platform} resourceId={`main.profile.0${index}`} label={`${index}번 기본 프로필`} onResource={setResource} />)}
      {platform === 'android' && <>
          {[1, 2, 3].map((index) => <ResourceUpload key={`profile-full-${index}`} project={project} platform={platform} resourceId={`main.profile.0${index}.full`} label={`${index}번 프로필 상세`} onResource={setResource} />)}
        </>}
      <ResourceUpload project={project} platform={platform} resourceId="main.add-friend.normal" label="친구 추가 버튼" onResource={setResource} />
      {platform === 'android' && <ResourceUpload project={project} platform={platform} resourceId="main.add-friend.pressed" label="친구 추가 버튼 눌림" onResource={setResource} />}
    </section>}

    {(isMe || isYou) && <>
      <section className="control-group resource-list"><div className="control-heading"><span>말풍선 상태별 이미지</span><span className="auto-label">{bubbleUploads.length}개</span></div>{bubbleUploads.map(([id, label, variant]) => <ResourceUpload key={id} project={project} platform={platform} resourceId={id} label={label} onResource={setResource} action={{ label: '영역 조정', onClick: () => onNinePatch(variant, id) }} />)}</section>
    </>}

    {selected === 'passcode-keypad' && <section className="control-group resource-list"><div className="control-heading"><span>잠금화면 상태별 이미지</span><span className="auto-label">기본 · 입력됨</span></div>{passcodeUploads.map(([id, label]) => <ResourceUpload key={id} project={project} platform={platform} resourceId={id} label={label} onResource={setResource} />)}</section>}
    {selected === 'splash-image' && <section className="control-group resource-list"><div className="control-heading"><span>시작 이미지</span><span className="auto-label">Android</span></div><ResourceUpload project={project} platform={platform} resourceId="splash.image" label="시작 화면" onResource={setResource} /></section>}

  </aside>;
}
