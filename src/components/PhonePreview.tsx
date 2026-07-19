import { useEffect, useState } from 'react';
import { resolveResourceUrl } from '../manifest/resourceResolver';
import { colorValue, cssColor } from '../manifest/colorResolver';
import { KAKAO_PREVIEW_VERSION, getScreenBlueprint } from '../preview/blueprints';
import { getHostLayout } from '../preview/layout';
import { previewFontFamily } from '../preview/fontFamily';
import { ANDROID_CHAT_SEND_VECTOR, IOS_CHAT_SEND_VECTOR, OFFICIAL_CHATROOM_VECTORS } from '../preview/officialUiVectors';
import {
  AndroidNinePatchBubble, ColorHotspot, Editable, ElementHotspot, IosInsetBubble, OfficialVector,
  ProfileHotspot, ThemeBackground,
  screenStyle,
} from './preview/PreviewHotspots';
import { type PreviewProps } from './preview/PreviewTypes';
import { MainPreview, type MainBannerVariant } from './preview/MainPreview';

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
      : props.screen === 'splash' ? <SplashScreen {...props} /> : <MainPreview {...props} bannerVariant={supportsBannerPreview ? bannerVariant : 'hidden'} />;
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
