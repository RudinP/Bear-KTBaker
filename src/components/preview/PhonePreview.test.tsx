import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../../domain/theme/defaults';
import { PhonePreview } from './PhonePreview';

const baseProps = {
  project: createDefaultTheme(),
  selected: 'screen-background' as const,
  onSelect: vi.fn(),
};

function directChildClasses(element: Element): string[] {
  return [...element.children].map((child) => child.className);
}

describe('final preview dispatcher', () => {
  it.each([
    ['ios', 'friends', 'kt-main-screen'],
    ['android', 'friends', 'kt-main-screen'],
    ['ios', 'chatroom', 'kt-ios-chatroom'],
    ['android', 'chatroom', 'kt-android-chatroom'],
    ['ios', 'passcode', 'kt-passcode'],
    ['android', 'passcode', 'kt-passcode'],
    ['ios', 'splash', 'kt-splash'],
    ['android', 'splash', 'kt-splash'],
  ] as const)('wraps the %s %s renderer as the scaler’s only direct child', (platform, previewScreen, screenClass) => {
    const { container } = render(
      <PhonePreview {...baseProps} platform={platform} screen={previewScreen} />,
    );
    const scaler = container.querySelector(
      '.screen-scaler.guide-scaler',
    )!;

    expect(scaler.parentElement).toHaveClass(
      'device-frame',
      'actual-device',
      'guide-device',
      platform,
    );
    expect(scaler.children).toHaveLength(1);
    expect(scaler.firstElementChild).toHaveClass('kt-screen', screenClass);
  });

  it('keeps the main renderer direct-child order', () => {
    const { container } = render(
      <PhonePreview {...baseProps} platform="ios" screen="friends" />,
    );
    const preview = container.querySelector('.kt-main-screen')!;

    expect(directChildClasses(preview)).toEqual([
      'kt-theme-background',
      'editable kt-main-header',
      'kt-chip-row',
      'kt-guide-banner',
      'editable kt-list kt-friends-list',
      'editable kt-tabbar',
    ]);
  });

  it.each([
    ['ios', 'editable kt-chat-header kt-ios-chat-header'],
    ['android', 'editable kt-chat-header kt-android-chat-header'],
  ] as const)('keeps the %s chat renderer direct-child order', (platform, headerClass) => {
    const { container } = render(
      <PhonePreview {...baseProps} platform={platform} screen="chatroom" />,
    );
    const preview = container.querySelector('.kt-chatroom')!;

    expect(directChildClasses(preview)).toEqual([
      'kt-theme-background',
      headerClass,
      'kt-chat-body',
      'kt-composer',
    ]);
  });

  it.each([
    ['ios', [
      'kt-theme-background',
      'kt-passcode-title',
      'kt-passcode-bullets',
      'editable kt-keypad',
    ]],
    ['android', [
      'kt-theme-background',
      'kt-passcode-keypad-background',
      'kt-passcode-title',
      'editable kt-keypad',
    ]],
  ] as const)('keeps the %s passcode renderer direct-child order', (platform, expectedClasses) => {
    const { container } = render(
      <PhonePreview {...baseProps} platform={platform} screen="passcode" />,
    );
    const preview = container.querySelector('.kt-passcode')!;

    expect(directChildClasses(preview)).toEqual(expectedClasses);
  });

  it('keeps the platform-specific splash direct-child order', () => {
    const ios = render(
      <PhonePreview {...baseProps} platform="ios" screen="splash" />,
    );
    expect(directChildClasses(ios.container.querySelector('.kt-splash')!)).toEqual([]);
    ios.unmount();

    const android = render(
      <PhonePreview {...baseProps} platform="android" screen="splash" />,
    );
    expect(directChildClasses(android.container.querySelector('.kt-splash')!)).toEqual([
      'kt-theme-background',
      'editable kt-splash-content',
    ]);
  });

  it('owns the notification switcher and dispatches every Android notification variant', () => {
    const { container } = render(
      <PhonePreview {...baseProps} platform="android" screen="notification" />,
    );
    const stack = container.querySelector('.phone-preview-stack')!;

    expect(directChildClasses(stack)).toEqual([
      'preview-state-switcher',
      'device-frame actual-device guide-device android',
    ]);
    expect(screen.getByLabelText('알림 상태')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전달 완료 보기' })).toHaveTextContent('전달 완료');
    expect(screen.getByText('채팅방 이동')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '메시지 알림' }));
    expect(screen.getByText('오랜만이야~')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '알림 눌림' }));
    expect(screen.getByRole('button', { name: '알림 눌림' })).toHaveAttribute('data-active', 'true');
  });

  it.each([
    ['ios', 'chats'],
    ['android', 'now'],
  ] as const)('owns the documented %s %s banner switcher', (platform, previewScreen) => {
    const { container } = render(
      <PhonePreview {...baseProps} platform={platform} screen={previewScreen} />,
    );

    expect(screen.getByLabelText('탭 배너 상태')).toBeInTheDocument();
    expect(container.querySelector('.kt-bottom-banner-preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '탭 배너' }));
    expect(container.querySelector('.kt-main-screen')?.children).toHaveLength(8);
    expect(container.querySelector('.kt-main-screen')?.children[5]).toHaveClass('color-hotspot', 'kt-banner-ad-pill');
    expect(container.querySelector('.kt-main-screen')?.children[6]).toHaveClass('color-hotspot', 'kt-bottom-banner-preview');
    expect(container.querySelector('.kt-main-screen')?.lastElementChild).toHaveClass('editable', 'kt-tabbar');
  });

  it('keeps the Android splash availability note immediately before the device', () => {
    const { container } = render(
      <PhonePreview {...baseProps} platform="android" screen="splash" />,
    );
    const stack = container.querySelector('.phone-preview-stack')!;

    expect(directChildClasses(stack)).toEqual([
      'preview-availability-note',
      'device-frame actual-device guide-device android',
    ]);
    expect(screen.getByText('Android 12 미만에서 적용')).toBeInTheDocument();
  });

  it('keeps guide metadata and host style variables on the device frame', () => {
    render(<PhonePreview {...baseProps} platform="ios" screen="chatroom" previewScale={0.5} />);
    const frame = screen.getByLabelText('카카오톡 미리보기');

    expect(frame).toHaveAttribute('data-kakao-version');
    expect(frame).toHaveAttribute('data-viewport', '375x750');
    expect(frame).toHaveAttribute('data-bezel', '0');
    expect(frame).toHaveAttribute('data-frame-radius', '26');
    expect(frame).toHaveAttribute('data-screen-radius', '26');
    expect(frame).toHaveStyle({
      '--kt-width': '375px',
      '--kt-height': '750px',
      '--kt-scale': '0.5',
      '--kt-bezel': '0px',
      '--kt-frame-radius': '26px',
      '--kt-radius': '26px',
      '--kt-composer-height': '48px',
      '--kt-composer-button-size': '30px',
      '--kt-composer-emoji-button-size': '24px',
      '--kt-composer-send-button-size': '32px',
      width: '187.5px',
      height: '375px',
      padding: '0px',
    });
  });
});
