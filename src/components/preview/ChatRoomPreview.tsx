import { useState } from 'react';
import { colorValue, cssColor } from '../../manifest/colorResolver';
import { getScreenBlueprint } from '../../preview/blueprints';
import { getHostLayout } from '../../preview/layout';
import { ANDROID_CHAT_SEND_VECTOR, IOS_CHAT_SEND_VECTOR, OFFICIAL_CHATROOM_VECTORS } from '../../preview/officialUiVectors';
import {
  AndroidNinePatchBubble, ColorHotspot, Editable, ElementHotspot, IosInsetBubble, OfficialVector,
  ProfileHotspot, ThemeBackground,
  screenStyle,
} from './PreviewHotspots';
import { type PreviewProps } from './PreviewTypes';

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

export type NotificationVariant = 'notification' | 'notification-pressed' | 'direct-share';

export function IosChatRoomPreview(
  props: PreviewProps & { notificationVariant?: NotificationVariant },
): React.ReactElement {
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

export function AndroidChatRoomPreview(
  props: PreviewProps & { notificationVariant?: NotificationVariant },
): React.ReactElement {
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
