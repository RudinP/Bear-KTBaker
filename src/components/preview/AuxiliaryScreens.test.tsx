import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../../domain/theme/defaults';
import { PhonePreview } from './PhonePreview';
import { ScreenRail } from '../ScreenRail';
import {
  PasscodePreview,
  SplashPreview,
} from './AuxiliaryScreens';

const railProps = {
  current: 'chatroom' as const,
  area: 'screens' as const,
  onChange: vi.fn(),
  onThemeInfo: vi.fn(),
  onFont: vi.fn(),
  onScreenshots: vi.fn(),
};

describe('platform auxiliary screens', () => {
  it('exposes the start screen on Android only', () => {
    const ios = render(<ScreenRail {...railProps} platform="ios" />);
    expect(screen.queryByText('시작 화면')).not.toBeInTheDocument();
    ios.unmount();
    render(<ScreenRail {...railProps} platform="android" />);
    expect(screen.getByText('시작 화면')).toBeInTheDocument();
  });

  it.each(['ios', 'android'] as const)('uses all four official passcode bullet slots on %s', (platform) => {
    const { container } = render(<PasscodePreview project={createDefaultTheme()} platform={platform} screen="passcode"
      selected="passcode-keypad" onSelect={vi.fn()} />);
    expect(container.querySelectorAll('[data-passcode-bullet]')).toHaveLength(4);
    expect(screen.getByTestId('passcode-keypad')).toHaveAttribute(
      'data-frame',
      platform === 'ios' ? '0,564,402,310' : '0,360,360,400',
    );
  });

  it('uses the installed iOS passcode copy, bullet geometry, and bottom-row controls', () => {
    const { container } = render(<PasscodePreview project={createDefaultTheme()} platform="ios" screen="passcode"
      selected="passcode-keypad" onSelect={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '암호 입력' })).toBeInTheDocument();
    expect(screen.getByText('카카오톡 암호를 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '키패드 취소' })).toHaveTextContent('취소');
    expect(container.querySelector('.kt-passcode-title')).toHaveStyle({ top: '257px' });
    expect(container.querySelector('.kt-passcode-bullets')).toHaveStyle({ top: '326px' });
    expect(container.querySelector('.kt-theme-background')).toHaveAttribute('data-surface', '402x564');
    expect(container.querySelector<HTMLElement>('.kt-theme-background')).toHaveStyle({
      backgroundPosition: '-81px 0px',
      backgroundSize: '564px 564px',
    });
  });

  it('does not add the iOS cancel key or copy to the Android passcode screen', () => {
    render(<PasscodePreview project={createDefaultTheme()} platform="android" screen="passcode"
      selected="passcode-keypad" onSelect={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '암호' })).toBeInTheDocument();
    expect(screen.getByText('카카오톡 암호를 입력해주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '키패드 취소' })).not.toBeInTheDocument();
  });

  it('switches iOS notification and direct-share guide states without changing screens', () => {
    render(<PhonePreview project={createDefaultTheme()} platform="ios" screen="notification"
      selected="notification" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: '메시지 알림' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전달 완료 보기' }));
    expect(screen.getByText('전달 완료')).toBeInTheDocument();
  });

  it('states the Android splash OS limitation', () => {
    render(<PhonePreview project={createDefaultTheme()} platform="android" screen="splash"
      selected="splash-image" onSelect={vi.fn()} />);
    expect(screen.getByText('Android 12 미만에서 적용')).toBeInTheDocument();
  });

  it('keeps the iOS splash empty and the Android splash background before its image', () => {
    const project = createDefaultTheme();
    const ios = render(<SplashPreview project={project} platform="ios" screen="splash"
      selected="splash-image" onSelect={vi.fn()} />);
    expect(ios.container.querySelector('.kt-splash')).toBeEmptyDOMElement();
    ios.unmount();

    const android = render(<SplashPreview project={project} platform="android" screen="splash"
      selected="splash-image" onSelect={vi.fn()} />);
    const splash = android.container.querySelector('.kt-splash')!;
    expect(splash.firstElementChild).toHaveClass('kt-theme-background');
    expect(splash.lastElementChild).toHaveClass('kt-splash-content');
  });
});
