import { useEffect, useState } from 'react';
import { KAKAO_PREVIEW_VERSION, getScreenBlueprint } from '../preview/blueprints';
import { previewFontFamily } from '../preview/fontFamily';
import { getHostLayout } from '../preview/layout';
import { PasscodePreview, SplashPreview } from './preview/AuxiliaryScreens';
import {
  AndroidChatRoomPreview,
  IosChatRoomPreview,
  type NotificationVariant,
} from './preview/ChatRoomPreview';
import { MainPreview, type MainBannerVariant } from './preview/MainPreview';
import { type PreviewProps } from './preview/PreviewTypes';

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
    ? props.platform === 'ios' ? <IosChatRoomPreview {...props} notificationVariant={notificationVariant} /> : <AndroidChatRoomPreview {...props} notificationVariant={notificationVariant} />
    : props.screen === 'passcode' ? <PasscodePreview {...props} />
      : props.screen === 'splash' ? <SplashPreview {...props} /> : <MainPreview {...props} bannerVariant={supportsBannerPreview ? bannerVariant : 'hidden'} />;
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
