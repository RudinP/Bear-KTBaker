import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../domain/theme';
import { PhonePreview } from './PhonePreview';

const baseProps = {
  project: createDefaultTheme(),
  selected: 'screen-background' as const,
  onSelect: vi.fn(),
};

describe('guide-faithful KakaoTalk preview', () => {
  it('renders only the iOS KakaoTalk app area without synthetic OS chrome or invented icons', () => {
    const onSelect = vi.fn();
    const { container } = render(<PhonePreview {...baseProps} onSelect={onSelect} platform="ios" screen="friends" />);

    expect(screen.getByLabelText('카카오톡 미리보기')).toHaveAttribute('data-viewport', '375x750');
    expect(container.querySelector('.lucide')).not.toBeInTheDocument();
    expect(container.querySelector('.kt-main-actions svg')).toHaveAttribute('data-source', 'ios-guide-26.5-friends');
    expect(container.querySelector('.kt-main-actions img')).not.toBeInTheDocument();
    expect(container.querySelector('.kt-statusbar')).not.toBeInTheDocument();
    expect(container.querySelector('.kt-android-navigation')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('16:31');
    expect(container.textContent).not.toContain('⌕');
    expect(container.textContent).not.toContain('광고 영역');
    expect(container.querySelector('.kt-dynamic-island')).not.toBeInTheDocument();
    expect(container.querySelector('.banner-characters')).not.toBeInTheDocument();
    const firstProfile = container.querySelector<HTMLImageElement>('.kt-list-avatar[data-resource-id="main.profile.01"] img');
    expect(firstProfile?.src).toContain('/sample/ios/Images/profileImg01@3x.png');
    fireEvent.click(container.querySelector('.kt-header-profile')!);
    expect(onSelect).toHaveBeenCalledWith('profile');
  });

  it.each([
    ['ios', 'friends'],
    ['ios', 'chats'],
    ['ios', 'now'],
    ['android', 'friends'],
    ['android', 'chats'],
    ['android', 'now'],
  ] as const)('cycles the three shared profile resources through %s %s rows while keeping one Inspector target', (platform, previewScreen) => {
    const onSelect = vi.fn();
    const { container } = render(<PhonePreview {...baseProps} onSelect={onSelect} platform={platform} screen={previewScreen} />);
    const avatars = [...container.querySelectorAll<HTMLElement>('.kt-list-avatar')];

    expect(avatars.slice(0, 4).map((avatar) => avatar.dataset.resourceId)).toEqual([
      'main.profile.01',
      'main.profile.02',
      'main.profile.03',
      'main.profile.01',
    ]);

    avatars.slice(0, 3).forEach((avatar) => fireEvent.click(avatar));
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect).toHaveBeenNthCalledWith(1, 'profile');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'profile');
    expect(onSelect).toHaveBeenNthCalledWith(3, 'profile');
  });

  it('uses the official Android guide aspect ratio without generated status or navigation bars', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="android" screen="chatroom" />);

    expect(screen.getByLabelText('카카오톡 미리보기')).toHaveAttribute('data-viewport', '360x760');
    expect(container.querySelector('.kt-statusbar')).not.toBeInTheDocument();
    expect(container.querySelector('.kt-android-navigation')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('7:03');
  });

  it.each([
    ['ios', 'friends'],
    ['android', 'chats'],
    ['ios', 'chatroom'],
    ['android', 'chatroom'],
  ] as const)('places the 1:2 background at the top and repeats it across the full %s %s app surface', (platform, previewScreen) => {
    const { container } = render(<PhonePreview {...baseProps} platform={platform} screen={previewScreen} />);
    const background = container.querySelector<HTMLElement>('.kt-theme-background');
    const expectedSurface = platform === 'ios' ? '393x852' : '360x760';

    expect(background).toHaveAttribute('data-surface', expectedSurface);
    expect(background?.style.left).toBe(platform === 'ios' ? '-9px' : '0px');
    expect(background?.style.top).toBe(platform === 'ios' ? '-51px' : '0px');
    expect(background?.style.backgroundPosition).toBe(platform === 'ios' ? '-16.5px 0px' : '-10px 0px');
    expect(background?.style.backgroundRepeat).toBe('repeat-y');
    expect(background?.style.backgroundSize).toBe(platform === 'ios' ? '426px 852px' : '380px 760px');
  });

  it.each(['ios', 'android'] as const)('fits and repeats a non-1:2 %s chat background from the top without blank bands', (platform) => {
    const project = createDefaultTheme();
    project.platformResources[platform]['chat.background'] = {
      fileName: platform === 'ios' ? 'wide@3x.png' : 'wide.png',
      dataUrl: 'data:image/png;base64,V0lERQ==',
      width: 600,
      height: 600,
      sourceScale: 3,
    };
    const { container } = render(<PhonePreview {...baseProps} project={project} platform={platform} screen="chatroom" />);
    const background = container.querySelector<HTMLElement>('.kt-theme-background');
    expect(background?.style.backgroundPosition).toBe(platform === 'ios' ? '-229.5px 0px' : '-200px 0px');
    expect(background?.style.backgroundSize).toBe(platform === 'ios' ? '852px 852px' : '760px 760px');
    expect(background?.style.backgroundRepeat).toBe('repeat-y');
  });

  it('renders the Android tab nine-patch as a dedicated official image layer', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="android" screen="chats" />);

    const tabBackground = container.querySelector<HTMLImageElement>('.kt-tabbar-background > img');
    expect(tabBackground).toBeInTheDocument();
    expect(tabBackground?.src).toContain('/sample/android/src/main/theme/drawable-xxhdpi/theme_maintab_cell_image.9.png');
    expect(tabBackground).toHaveAttribute('data-nine-patch', 'true');
    expect(screen.getByTestId('tabbar').style.backgroundImage).toBe('');
  });

  it('uses a transparent vector traced from the Android guide and tints it with header color', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="android" screen="chats" />);

    const officialActions = container.querySelector('.kt-official-actions');
    expect(officialActions).toHaveAttribute('data-source', 'android-guide-26.5-chats');
    expect(officialActions?.tagName).toBe('svg');
    expect(officialActions).toHaveAttribute('fill', 'currentColor');
    expect(officialActions?.querySelector('path')).toHaveAttribute('fill-rule', 'evenodd');
    expect(officialActions?.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(100);
    expect(officialActions).not.toHaveClass('lucide');
  });

  it.each([
    ['ios', 'friends', 'friends'],
    ['ios', 'chats', 'chats'],
    ['ios', 'now', 'chats'],
    ['ios', 'more', 'more'],
    ['android', 'friends', 'friends'],
    ['android', 'chats', 'chats'],
    ['android', 'now', 'chats'],
    ['android', 'more', 'more'],
  ] as const)('renders only the official PDF header actions on %s %s', (platform, previewScreen, actionSet) => {
    const { container } = render(<PhonePreview {...baseProps} platform={platform} screen={previewScreen} />);
    const actions = container.querySelector('.kt-main-actions .kt-official-actions');

    expect(actions).toBeInTheDocument();
    expect(actions).toHaveAttribute('data-source', `${platform}-guide-26.5-${actionSet}`);
    expect(actions?.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(100);
    expect(actions).not.toHaveClass('lucide');
  });

  it('keeps theme targets interactive while the fixed KakaoTalk layout stays unchanged', () => {
    const onSelect = vi.fn();
    render(<PhonePreview {...baseProps} onSelect={onSelect} platform="ios" screen="chatroom" />);

    fireEvent.click(screen.getByLabelText('보낸 첫 말풍선 꾸미기'));
    expect(onSelect).toHaveBeenCalledWith('bubble-me');
    expect(screen.getByTestId('composer-region')).toHaveAttribute('data-top', '680');
    expect(screen.getByTestId('composer-region')).toHaveAttribute('data-height', '70');
  });

  it.each([
    ['ios', '375x750', '0', '26'],
    ['android', '360x760', '0', '18'],
  ] as const)('ignores the PDF presentation bezel and keeps only the app screen radius on %s', (platform, viewport, bezel, screenRadius) => {
    const { container } = render(<PhonePreview {...baseProps} platform={platform} screen="chatroom" />);
    const frame = screen.getByLabelText('카카오톡 미리보기');
    const scaler = container.querySelector('.guide-scaler');

    expect(frame).toHaveAttribute('data-viewport', viewport);
    expect(frame).toHaveAttribute('data-bezel', bezel);
    expect(frame).toHaveAttribute('data-frame-radius', screenRadius);
    expect(frame).toHaveAttribute('data-screen-radius', screenRadius);
    expect(scaler).toHaveStyle({ borderRadius: `${screenRadius}px` });
  });

  it.each(['ios', 'android'] as const)('uses only guide-traced fixed chat and input icons on %s', (platform) => {
    const { container } = render(<PhonePreview {...baseProps} platform={platform} screen="chatroom" />);

    expect(container.querySelector('.kt-chat-back svg')).toHaveAttribute('data-source', `${platform}-guide-26.5`);
    expect(container.querySelector('.kt-chat-fixed-actions svg')).toHaveAttribute('data-source', `${platform}-guide-26.5`);
    const composerIcons = [...container.querySelectorAll('.kt-composer-fixed-icon svg')];
    expect(composerIcons).toHaveLength(2);
    expect(composerIcons.every((icon) => icon.getAttribute('fill') === 'currentColor')).toBe(true);
    if (platform === 'ios') expect(container.querySelector('.kt-chat-send svg')).toHaveAttribute('data-source', 'ios-guide-26.5');
    expect(container.querySelector('.lucide')).not.toBeInTheDocument();
  });

  it.each(['ios', 'android'] as const)('switches the official hash and send controls from the actual input value on %s', (platform) => {
    const { container } = render(<PhonePreview {...baseProps} platform={platform} screen="chatroom" />);
    const input = screen.getByRole('textbox', { name: '메시지 입력 미리보기' });

    fireEvent.change(input, { target: { value: '' } });
    expect(container.querySelector('.kt-composer-fixed-icon.hash')).toBeInTheDocument();
    expect(container.querySelector('.kt-chat-send')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: '카카오톡 테마' } });
    expect(container.querySelector('.kt-composer-fixed-icon.hash')).not.toBeInTheDocument();
    expect(container.querySelector('.kt-chat-send svg')).toHaveAttribute('data-source', `${platform}-guide-26.5`);
  });

  it('renders the 26.5 input bar as one capsule and applies key 6 only to menu buttons', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="android" screen="chatroom" />);
    const menu = container.querySelector<HTMLElement>('.kt-composer-fixed-icon.menu');
    const inputField = container.querySelector<HTMLElement>('.kt-composer-pill');
    const controls = container.querySelector<HTMLElement>('.kt-composer-controls');

    expect(menu?.style.backgroundColor).not.toBe('');
    expect(inputField?.style.backgroundColor).toBe('');
    expect(controls?.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(controls).toContainElement(menu);
    expect(controls).toContainElement(inputField);
  });

  it.each(['ios', 'android'] as const)('uses the guide-sized emoji button instead of scaling every input control to the menu size on %s', (platform) => {
    const { container } = render(<PhonePreview {...baseProps} platform={platform} screen="chatroom" />);
    const frame = screen.getByLabelText('카카오톡 미리보기');
    const input = screen.getByRole('textbox', { name: '메시지 입력 미리보기' });

    expect(frame).toHaveStyle({ '--kt-composer-button-size': platform === 'ios' ? '30px' : '32px' });
    expect(frame).toHaveStyle({ '--kt-composer-emoji-button-size': '24px' });
    expect(frame).toHaveStyle({ '--kt-composer-send-button-size': '32px' });
    expect(frame).toHaveStyle({ '--kt-composer-input-inset': '8px' });
    expect(container.querySelector('.kt-composer-fixed-icon.emoji')).toBeInTheDocument();
    expect(input.style.paddingLeft).toBe('');
  });

  it('does not bring the retired AI or voice controls back into the 26.5 input bar', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="ios" screen="chatroom" />);
    const input = screen.getByRole('textbox', { name: '메시지 입력 미리보기' });

    fireEvent.change(input, { target: { value: '' } });
    expect(container.querySelector('.kt-composer-fixed-icon.voice')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('AI');
    expect(container.querySelectorAll('.kt-composer-fixed-icon')).toHaveLength(3);

    fireEvent.change(input, { target: { value: '카카오톡 테마' } });
    expect(container.querySelector('.kt-composer-fixed-icon.hash')).not.toBeInTheDocument();
    expect(container.querySelector('.kt-chat-send')).toBeInTheDocument();
  });

  it('uses the iOS CSS cap inset as a single border image and preserves the logical source size', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="ios" screen="chatroom" />);
    const bubble = screen.getByLabelText('보낸 첫 말풍선 꾸미기');
    const layer = bubble.querySelector<HTMLElement>('.kt-ios-inset-layer');

    expect(bubble.style.backgroundColor).toBe('transparent');
    expect(bubble.style.borderImageSource).toBe('');
    expect(layer).toBeInTheDocument();
    expect(layer).toHaveAttribute('data-renderer', 'ios-inset');
    expect(layer?.querySelectorAll('.kt-nine-slice-cell')).toHaveLength(0);
    expect(layer?.style.borderImageSource).toContain('chatroomBubbleSend01');
    expect(bubble.style.paddingTop).toBe('10px');
    expect(bubble.style.paddingRight).toBe('17px');
    expect(Number.parseFloat(bubble.style.paddingLeft)).toBeCloseTo(11, 5);
    expect(bubble.style.minWidth).toBe('40px');
    expect(bubble.style.minHeight).toBe('35px');
    expect(container.querySelector('.kt-bubble-copy')).toBeInTheDocument();
  });

  it('never compresses decorated iOS caps below a custom asset logical size', () => {
    const project = createDefaultTheme();
    const guides = {
      stretch: { x: [99 / 345, 102 / 345] as [number, number], y: [285 / 375, 288 / 375] as [number, number] },
      content: { left: 51 / 345, top: 249 / 375, right: 141 / 345, bottom: 321 / 375 },
    };
    project.platformResources.ios['chat.bubble.me.first.normal'] = {
      fileName: 'decorated@3x.png', dataUrl: 'data:image/png;base64,REVDS1JBVEVE', width: 345, height: 375, sourceScale: 3,
    };
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: guides };

    render(<PhonePreview {...baseProps} project={project} platform="ios" screen="chatroom" />);
    const bubble = screen.getByLabelText('보낸 첫 말풍선 꾸미기');

    expect(bubble.style.minWidth).toBe('115px');
    expect(bubble.style.minHeight).toBe('125px');
    expect(bubble.querySelector('[data-renderer="ios-inset"]')).toBeInTheDocument();
  });

  it('matches exported iOS integer-point inset metrics for non-aligned source guides', () => {
    const project = createDefaultTheme();
    project.platformResources.ios['chat.bubble.me.first.normal'] = {
      fileName: 'misaligned@3x.png', dataUrl: 'data:image/png;base64,TUlTQUxJR05FRA==', width: 120, height: 105, sourceScale: 3,
    };
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: {
      stretch: { x: [50 / 120, 90 / 120], y: [52 / 105, 90 / 105] },
      content: { left: 32 / 120, top: 31 / 105, right: 70 / 120, bottom: 83 / 105 },
    } };

    render(<PhonePreview {...baseProps} project={project} platform="ios" screen="chatroom" />);
    const bubble = screen.getByLabelText('보낸 첫 말풍선 꾸미기');
    const layer = bubble.querySelector<HTMLElement>('[data-renderer="ios-inset"]');

    expect(bubble.style.paddingTop).toBe('10px');
    expect(bubble.style.paddingRight).toBe('17px');
    expect(bubble.style.paddingBottom).toBe('7px');
    expect(bubble.style.paddingLeft).toBe('11px');
    expect(bubble.style.minWidth).toBe('40px');
    expect(bubble.style.minHeight).toBe('35px');
    expect(layer?.style.borderImageSlice).toBe('51 69 51 48 fill');
  });

  it('uses only the Android .9.png marker renderer for Android bubbles', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="android" screen="chatroom" />);
    const bubble = screen.getByLabelText('보낸 첫 말풍선 꾸미기');
    const layer = bubble.querySelector<HTMLElement>('.kt-nine-slice');
    const canvas = layer?.querySelector<HTMLCanvasElement>('.kt-nine-slice-canvas');

    expect(layer).toHaveAttribute('data-renderer', 'android-nine-patch');
    expect(layer?.querySelectorAll('.kt-nine-slice-cell')).toHaveLength(0);
    expect(canvas).toBeInTheDocument();
    expect(canvas?.dataset.sourceImage).toContain('/sample/android/');
    expect(bubble.querySelector('.kt-ios-inset-layer')).not.toBeInTheDocument();
    expect(bubble.style.paddingTop).toBe('4px');
    expect(bubble.style.paddingRight).toBe('14px');
    expect(bubble.style.paddingLeft).toBe('11px');
    expect(bubble.style.minWidth).toBe('');
    expect(bubble.style.minHeight).toBe('');
    expect(container.querySelector('.kt-bubble-copy')).toBeInTheDocument();
  });

  it.each([
    ['ios', 'center'],
    ['android', 'start'],
  ] as const)('uses the independent %s chat header title alignment', (platform, alignment) => {
    const { container } = render(<PhonePreview {...baseProps} platform={platform} screen="chatroom" />);
    expect(container.querySelector('.kt-chat-header b')).toHaveAttribute('data-alignment', alignment);
    expect(container.querySelector<HTMLElement>('.kt-chat-back')?.style.gridColumn).toBe('1');
    expect(container.querySelector<HTMLElement>('.kt-chat-fixed-actions')?.style.gridColumn).toBe('3');
    expect(container.querySelector('.kt-chatroom')).toHaveAttribute('data-platform-renderer', platform);
    expect(container.querySelector(`.kt-${platform}-chatroom`)).toBeInTheDocument();
    expect(container.querySelector(`.kt-${platform}-chat-header`)).toBeInTheDocument();
    expect(container.querySelector(`.kt-${platform === 'ios' ? 'android' : 'ios'}-chatroom`)).not.toBeInTheDocument();
  });

  it.each(['ios', 'android'] as const)('keeps sent-group spacing at the host value and places time left of the last bubble on %s', (platform) => {
    const { container } = render(<PhonePreview {...baseProps} platform={platform} screen="chatroom" />);
    const sent = container.querySelector<HTMLElement>('.kt-message.sent');
    const lastRow = container.querySelector('.kt-message.sent .kt-sent-last');
    const time = lastRow?.querySelector('time');
    const lastBubble = lastRow?.querySelector('.kt-bubble');

    expect(sent?.style.gap).toBe(platform === 'ios' ? '4px' : '10px');
    expect(lastRow?.firstElementChild).toBe(time);
    expect(time?.nextElementSibling).toBe(lastBubble);
    expect(time).toHaveAttribute('data-position', 'left-of-last-bubble');
    expect(sent?.querySelector(':scope > time')).not.toBeInTheDocument();
  });

  it('renders the independent iOS received unread color on the received-message state documented by the guide', () => {
    const project = createDefaultTheme();
    project.colorValues.ios['MessageCellStyle-Receive|-ios-unread-text-color'] = '#123456';
    render(<PhonePreview {...baseProps} project={project} platform="ios" screen="chatroom" />);

    const receivedUnread = screen.getByLabelText('받은 안 읽은 숫자 색상 편집');
    expect(within(receivedUnread).getByText('1')).toHaveStyle({ color: '#123456' });
  });

  it.each([
    ['보낸 첫 말풍선 꾸미기', 'MessageCellStyle-Send|-ios-text-color', 'MessageCellStyle-Send|-ios-selected-text-color'],
    ['받은 첫 말풍선 꾸미기', 'MessageCellStyle-Receive|-ios-text-color', 'MessageCellStyle-Receive|-ios-selected-text-color'],
  ] as const)('shows the documented iOS selected text color only while %s is pressed', (label, normalKey, selectedKey) => {
    const project = createDefaultTheme();
    project.colorValues.ios[normalKey] = '#123456';
    project.colorValues.ios[selectedKey] = '#ABCDEF';
    render(<PhonePreview {...baseProps} project={project} platform="ios" screen="chatroom" />);
    const bubble = screen.getByLabelText(label);

    expect(bubble).toHaveStyle({ color: '#123456' });
    fireEvent.pointerDown(bubble);
    expect(bubble).toHaveStyle({ color: '#abcdef' });
    fireEvent.pointerUp(bubble);
    expect(bubble).toHaveStyle({ color: '#123456' });
  });

  it('renders the notification guide as its own selectable screen', () => {
    const onSelect = vi.fn();
    render(<PhonePreview {...baseProps} onSelect={onSelect} platform="ios" screen="notification" />);

    expect(screen.getByText('오랜만이야~')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('메시지 알림 꾸미기'));
    expect(onSelect).toHaveBeenCalledWith('notification');
    fireEvent.click(screen.getByRole('button', { name: '전달 완료 보기' }));
    expect(screen.getByText('사진을 전달하였습니다.')).toBeInTheDocument();
  });

  it('renders the iOS direct-share name and message as the two independent PDF colors without an Android-only button', () => {
    const project = createDefaultTheme();
    project.colorValues.ios['LabelStyle-DirectShareBarName|-ios-text-color'] = '#123456';
    project.colorValues.ios['LabelStyle-DirectShareBarMessage|-ios-text-color'] = '#ABCDEF';
    render(<PhonePreview {...baseProps} project={project} platform="ios" screen="notification" />);

    fireEvent.click(screen.getByRole('button', { name: '전달 완료 보기' }));
    const banner = screen.getByLabelText('전달 완료 배너 꾸미기');
    expect(within(banner).getByText('어피치')).toHaveStyle({ color: '#123456' });
    expect(within(banner).getByText('사진을 전달하였습니다.')).toHaveStyle({ color: '#abcdef' });
    expect(screen.queryByText('채팅방 이동')).not.toBeInTheDocument();
  });

  it('shows the Android notification pressed state with the documented pressed background color', () => {
    const project = createDefaultTheme();
    project.colorValues.android.theme_notification_background_pressed_color = '#123456';
    const { container } = render(<PhonePreview {...baseProps} project={project} platform="android" screen="notification" />);

    fireEvent.click(screen.getByRole('button', { name: '알림 눌림' }));
    expect(container.querySelector('.kt-notification-bar')).toHaveStyle({ backgroundColor: '#123456' });
  });

  it('applies the documented iOS highlighted colors while the send control is pressed', () => {
    const project = createDefaultTheme();
    project.colorValues.ios['InputBarStyle-Chat|-ios-send-highlighted-background-color'] = '#123456';
    project.colorValues.ios['InputBarStyle-Chat|-ios-send-highlighted-foreground-color'] = '#ABCDEF';
    const { container } = render(<PhonePreview {...baseProps} project={project} platform="ios" screen="chatroom" />);
    const send = screen.getByLabelText('보내기 버튼 꾸미기');

    fireEvent.pointerDown(send);
    expect(send).toHaveStyle({ backgroundColor: '#123456' });
    expect(send.querySelector('span')).toHaveStyle({ color: '#abcdef' });
    fireEvent.pointerUp(send);
    expect(send).toHaveStyle({ backgroundColor: '#ff7f7f' });
    expect(container.querySelector('.kt-chat-send')).toBe(send);
  });

  it('uses the iOS tab background color when no tab background image exists', () => {
    const project = createDefaultTheme('테스트', false);
    project.colorValues.ios['TabBarStyle-Main|background-color'] = '#123456';
    render(<PhonePreview {...baseProps} project={project} platform="ios" screen="chats" />);

    expect(screen.getByTestId('tabbar')).toHaveStyle({ backgroundColor: '#123456' });
  });

  it('shows the one documented iOS bottom banner as a full-width bar', () => {
    const project = createDefaultTheme();
    project.colorValues.ios['BottomBannerStyle|background-color'] = '#123456';
    project.colorValues.ios['MainViewStyle-Primary|-ios-description-text-color'] = '#ABCDEF';
    const { container } = render(<PhonePreview {...baseProps} project={project} platform="ios" screen="chats" />);

    expect(container.querySelector('.kt-bottom-banner-preview')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '어두운 탭 배너' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '밝은 탭 배너' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '탭 배너' }));
    expect(container.querySelector('.kt-bottom-banner-preview')).toHaveStyle({
      backgroundColor: '#123456', top: '657px', left: '0px', width: '375px', height: '40px', borderRadius: '0',
    });
    expect(container.querySelector('.kt-banner-ad-pill')).toHaveStyle({
      backgroundColor: '#123456', color: '#ffffff', top: '604px', left: '82px', width: '209px', height: '38px',
    });
    expect(container.querySelector('.kt-banner-ad-badge')).toHaveStyle({ color: '#abcdef' });
    expect(container.querySelector('.kt-banner-play')).toBeInTheDocument();
    expect(container.querySelector('.kt-banner-close')).toBeInTheDocument();
  });

  it('shows the one documented Android bottom banner as a full-width bar', () => {
    const project = createDefaultTheme();
    project.colorValues.android.theme_tab_bannerbadge_background_color = '#123456';
    project.colorValues.android.theme_description_color = '#ABCDEF';
    const { container } = render(<PhonePreview {...baseProps} project={project} platform="android" screen="now" />);

    expect(container.querySelector('.kt-bottom-banner-preview')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '어두운 탭 배너' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '밝은 탭 배너' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '탭 배너' }));
    expect(container.querySelector('.kt-bottom-banner-preview')).toHaveStyle({
      backgroundColor: '#123456', top: '669px', left: '0px', width: '360px', height: '38px', borderRadius: '0',
    });
    expect(container.querySelector('.kt-banner-ad-pill')).toHaveStyle({
      backgroundColor: '#123456', color: '#ffffff', top: '595px', left: '77px', width: '185px', height: '32px',
    });
    expect(container.querySelector('.kt-banner-ad-badge')).toHaveStyle({ color: '#abcdef' });
  });

  it('uses the Android direct-share keys for the full chat banner', () => {
    const project = createDefaultTheme();
    const { container } = render(<PhonePreview {...baseProps} project={project} platform="android" screen="notification" />);
    const banner = container.querySelector<HTMLElement>('.kt-notification-bar');

    expect(screen.getByLabelText('전달 완료 배너 꾸미기')).toBeInTheDocument();
    expect(banner).toHaveStyle({ backgroundColor: '#fff2f2' });
    expect(screen.getByText('채팅방 이동')).toHaveStyle({ color: '#e87d7d' });
  });

  it('does not invent a TALK splash mark for iOS, where the theme has no splash image slot', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="ios" screen="splash" />);
    expect(container).not.toHaveTextContent('TALK');
    expect(container.querySelector('.kt-splash-content')).not.toBeInTheDocument();
  });

  it('maps the header icon directly and keeps the menu button background-and-icon keys together', () => {
    const onSelect = vi.fn();
    render(<PhonePreview {...baseProps} onSelect={onSelect} platform="ios" screen="chatroom" />);

    fireEvent.click(screen.getAllByLabelText('메뉴 버튼 꾸미기')[0]);
    expect(onSelect).toHaveBeenCalledWith('inputbar-menu');
    fireEvent.click(screen.getAllByLabelText('헤더 제목·아이콘 색상 편집')[0]);
    expect(onSelect).toHaveBeenCalledWith('color:main.header.foreground');
  });

  it('maps the visible passcode title directly and keeps the input field background-and-text keys together', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<PhonePreview {...baseProps} onSelect={onSelect} platform="ios" screen="passcode" />);

    fireEvent.click(screen.getByLabelText('잠금화면 제목 색상 편집'));
    expect(onSelect).toHaveBeenLastCalledWith('color:passcode.foreground');

    rerender(<PhonePreview {...baseProps} onSelect={onSelect} platform="ios" screen="chatroom" />);
    fireEvent.click(screen.getByRole('textbox', { name: '메시지 입력 미리보기' }));
    expect(onSelect).toHaveBeenLastCalledWith('inputbar-field');
  });

  it('makes the whole main content region discoverable without drawing the Android content-boundary color under every row', () => {
    const onSelect = vi.fn();
    const { container } = render(<PhonePreview {...baseProps} onSelect={onSelect} platform="android" screen="friends" />);
    const content = screen.getByLabelText('목록과 콘텐츠 꾸미기');
    const row = container.querySelector<HTMLElement>('.kt-list-row');

    expect(content).toHaveClass('editable');
    expect(row?.style.backgroundColor).toBe('rgba(255, 222, 222, 0)');
    expect(row?.style.borderBottomColor).toBe('');
    fireEvent.click(content);
    expect(onSelect).toHaveBeenCalledWith('content');
  });

  it('does not reuse the iOS section-title border as a border under every list row', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="ios" screen="chats" />);
    const row = container.querySelector<HTMLElement>('.kt-list-row');
    expect(row?.style.borderBottomColor).toBe('');
  });

  it('does not invent a content-boundary line on the simplified section heading for either platform', () => {
    const ios = render(<PhonePreview {...baseProps} platform="ios" screen="friends" />);
    expect(ios.container.querySelector<HTMLElement>('.kt-friends-list h5')?.style.borderBottomStyle).toBe('');
    ios.unmount();

    const android = render(<PhonePreview {...baseProps} platform="android" screen="friends" />);
    expect(android.container.querySelector<HTMLElement>('.kt-friends-list h5')?.style.borderBottomColor).toBe('');
  });

  it.each(['ios', 'android'] as const)('uses the %s MainView title color for the More grid instead of borrowing the separate feature-button color', (platform) => {
    const project = createDefaultTheme();
    const titleKey = platform === 'ios' ? 'MainViewStyle-Primary|-ios-text-color' : 'theme_title_color';
    const featureKey = platform === 'ios' ? 'FeatureStyle-Primary|-ios-text-color' : 'theme_feature_primary_color';
    project.colorValues[platform][titleKey] = '#123456';
    project.colorValues[platform][featureKey] = '#ABCDEF';
    const { container } = render(<PhonePreview {...baseProps} project={project} platform={platform} screen="more" />);

    expect(container.querySelector<HTMLElement>('.kt-service-item')).toHaveStyle({ color: '#123456' });
  });

  it.each(['ios', 'android'] as const)('selects the %s send control as one documented background-and-icon group', (platform) => {
    const onSelect = vi.fn();
    render(<PhonePreview {...baseProps} onSelect={onSelect} platform={platform} screen="chatroom" />);

    fireEvent.click(screen.getByLabelText('보내기 버튼 꾸미기'));
    expect(onSelect).toHaveBeenLastCalledWith('inputbar-send');
  });

  it.each(['ios', 'android'] as const)('selects the %s menu control as one documented background-and-icon group', (platform) => {
    const onSelect = vi.fn();
    render(<PhonePreview {...baseProps} onSelect={onSelect} platform={platform} screen="chatroom" />);

    fireEvent.click(screen.getByLabelText('메뉴 버튼 꾸미기'));
    expect(onSelect).toHaveBeenLastCalledWith('inputbar-menu');
  });

  it('uses the iOS secondary body keys on the Now screen', () => {
    const project = createDefaultTheme();
    project.colorValues.ios['MainViewStyle-Secondary|background-color'] = '#123456';
    const { container } = render(<PhonePreview {...baseProps} project={project} platform="ios" screen="now" />);
    const background = container.querySelector<HTMLElement>('.kt-theme-background');

    expect(background?.style.backgroundColor).toBe('rgb(18, 52, 86)');
    expect(screen.getAllByLabelText('보조 콘텐츠 글자 색상 편집').length).toBeGreaterThan(0);
  });

  it('does not fall back to black for the Android notification message', () => {
    render(<PhonePreview {...baseProps} platform="android" screen="notification" />);
    fireEvent.click(screen.getByRole('button', { name: '메시지 알림' }));
    expect(screen.getByText('오랜만이야~')).toHaveStyle({ color: '#664242' });
  });

  it('renders only the measured Home and Wallet capsules on More', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="ios" screen="more" />);

    const chips = [...container.querySelectorAll('.screen-more .kt-chip-row > *')];
    expect(chips).toHaveLength(2);
    expect(chips.map((chip) => chip.querySelector(':scope > span:not(.edit-hint)')?.textContent)).toEqual(['홈', '지갑']);
    expect(chips[0]).toHaveAttribute('data-more-chip', 'home');
    expect(chips[1]).toHaveAttribute('data-more-chip', 'wallet');
  });

  it('uses the Android browse-tab color keys instead of falling back to black capsules', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="android" screen="more" />);
    const home = container.querySelector<HTMLElement>('[data-more-chip="home"]');
    const wallet = container.querySelector<HTMLElement>('[data-more-chip="wallet"]');

    expect(home).toHaveStyle({ backgroundColor: '#664242', borderColor: '#664242' });
    expect(wallet).toHaveStyle({ color: '#d49b9b' });
    expect(home).toHaveStyle({ width: '46px' });
    expect(wallet).toHaveStyle({ width: '58px' });
  });

  it.each(['ios', 'android'] as const)('maps the %s selected chip background and text to the two MainView PDF colors', (platform) => {
    const project = createDefaultTheme();
    const backgroundKey = platform === 'ios' ? 'MainViewStyle-Primary|background-color' : 'theme_background_color';
    const titleKey = platform === 'ios' ? 'MainViewStyle-Primary|-ios-text-color' : 'theme_title_color';
    project.colorValues[platform][backgroundKey] = '#ABCDEF';
    project.colorValues[platform][titleKey] = '#123456';
    const onSelect = vi.fn();
    const { container } = render(<PhonePreview {...baseProps} project={project} platform={platform} screen="chats" onSelect={onSelect} />);
    const selectedChip = container.querySelector<HTMLElement>('.kt-chip-row .selected-chip');
    const text = selectedChip?.querySelector<HTMLElement>('[data-chip-selected-text]');

    expect(selectedChip).toHaveStyle({ backgroundColor: '#123456' });
    expect(text).toHaveStyle({ color: '#abcdef' });
    fireEvent.click(text!);
    expect(onSelect).toHaveBeenLastCalledWith('color:main.background');
  });

  it('renders the twelve official More-service glyphs and maps them to the MainView title color', () => {
    const onSelect = vi.fn();
    const { container } = render(<PhonePreview {...baseProps} onSelect={onSelect} platform="ios" screen="more" />);
    const services = [...container.querySelectorAll('.kt-service-item')];

    expect(services).toHaveLength(12);
    expect(container.querySelectorAll('.kt-more-service-icon')).toHaveLength(12);
    expect(screen.getByText('브랜드패션')).toBeInTheDocument();
    expect(screen.getByText('게임')).toBeInTheDocument();
    expect(screen.queryByText('AI국민비서')).not.toBeInTheDocument();
    expect(screen.queryByText('톡클라우드')).not.toBeInTheDocument();
    expect(container.querySelector('.kt-pay')?.textContent).not.toContain('●');
    expect(container.querySelector('.kt-pay')?.textContent).not.toContain('▣');
    fireEvent.click(services[0]);
    expect(onSelect).toHaveBeenCalledWith('color:main.title.normal');
  });

  it.each([
    ['ios', 'color:main.header.tab.normal'],
    ['android', 'color:feature.browse.normal'],
  ] as const)('uses the documented 6%% title tint and pagination colors on %s More', (platform, defaultSlot) => {
    const onSelect = vi.fn();
    const { container } = render(<PhonePreview {...baseProps} onSelect={onSelect} platform={platform} screen="more" />);
    const grid = container.querySelector<HTMLElement>('.kt-service-grid');
    const dots = [...container.querySelectorAll<HTMLElement>('.kt-grid-dot')];

    expect(grid?.style.backgroundColor).toBe('rgba(102, 66, 66, 0.06)');
    expect(dots).toHaveLength(4);
    expect(dots[0]).toHaveAttribute('data-active', 'true');
    fireEvent.click(dots[1].parentElement!);
    expect(onSelect).toHaveBeenCalledWith(defaultSlot);
  });

  it.each(['ios', 'android'] as const)('renders the official fourth chat filter chip on %s', (platform) => {
    const { container } = render(<PhonePreview {...baseProps} platform={platform} screen="chats" />);
    const chips = container.querySelectorAll('.screen-chats .kt-chip-row > *');
    const filter = container.querySelector('.kt-chat-filter-icon');

    expect(chips).toHaveLength(4);
    expect(filter).toHaveAttribute('data-source', `${platform}-guide-26.5-chat-filter`);
    expect(filter?.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(100);
  });

  it('switches the bottom tab to the selected source when a preview tab is clicked', () => {
    function InteractivePreview() {
      const [active, setActive] = useState<'friends' | 'more'>('more');
      return <PhonePreview {...baseProps} platform="ios" screen={active} onNavigateScreen={(next) => {
        if (next === 'friends' || next === 'more') setActive(next);
      }} />;
    }
    const { container } = render(<InteractivePreview />);

    const friends = screen.getByRole('button', { name: '친구 탭 보기' });
    expect(friends.querySelector('img')?.src).toContain('maintabIcoFriends@3x.png');
    fireEvent.click(friends);
    expect(container.querySelector('.screen-friends')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '친구 탭 보기' }).querySelector('img')?.src).toContain('maintabIcoFriendsSelected@3x.png');
    expect(screen.getByRole('button', { name: '더보기 탭 보기' }).querySelector('img')?.src).toContain('maintabIcoMore@3x.png');
  });

  it('changes iOS passcode bullets from normal to selected as digits are entered', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="ios" screen="passcode" />);
    const firstBullet = () => container.querySelector<HTMLImageElement>('[data-passcode-bullet="1"]');

    expect(firstBullet()?.src).toContain('passcodeImgCode01@3x.png');
    fireEvent.click(screen.getByRole('button', { name: '숫자 1 입력' }));
    expect(firstBullet()?.src).toContain('passcodeImgCode01Selected@3x.png');
  });

  it('uses the Android guide number keypad and changes bullets as digits are entered', () => {
    const { container } = render(<PhonePreview {...baseProps} platform="android" screen="passcode" />);
    const firstBullet = () => container.querySelector<HTMLImageElement>('[data-passcode-bullet="1"]');

    expect(screen.queryByTestId('passcode-pattern')).not.toBeInTheDocument();
    expect(firstBullet()?.src).toContain('theme_passcode_01_image.png');
    expect(container.querySelector('.kt-passcode-keypad-background')).toHaveStyle({ backgroundColor: '#fff2f2' });
    fireEvent.click(screen.getByRole('button', { name: '숫자 1 입력' }));
    expect(firstBullet()?.src).toContain('theme_passcode_01_checked_image.png');
  });

  it('shows the official iOS keypad pressed image only while a number is held', () => {
    render(<PhonePreview {...baseProps} platform="ios" screen="passcode" />);
    const one = screen.getByRole('button', { name: '숫자 1 입력' });

    fireEvent.pointerDown(one);
    expect(one.querySelector<HTMLImageElement>('.kt-keypad-pressed-image')?.src).toContain('passcodeKeypadPressed@3x.png');
    fireEvent.pointerUp(one);
    expect(one.querySelector('.kt-keypad-pressed-image')).not.toBeInTheDocument();
  });

  it.each(['ios', 'android'] as const)('uses the fixed delete vector traced from the %s guide', (platform) => {
    const { container } = render(<PhonePreview {...baseProps} platform={platform} screen="passcode" />);
    expect(container.querySelector('.kt-keypad-delete svg')).toHaveAttribute('data-source', `${platform}-guide-26.5`);
    expect(container.querySelector('.kt-keypad-delete')).not.toHaveTextContent('⌫');
  });
});
