import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../../domain/theme';
import { PhonePreview } from '../PhonePreview';
import { ScreenRail } from '../ScreenRail';

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
    const { container } = render(<PhonePreview project={createDefaultTheme()} platform={platform} screen="passcode"
      selected="passcode-keypad" onSelect={vi.fn()} />);
    expect(container.querySelectorAll('[data-passcode-bullet]')).toHaveLength(4);
    expect(screen.getByTestId('passcode-keypad')).toHaveAttribute(
      'data-frame',
      platform === 'ios' ? '0,375,375,375' : '0,360,360,400',
    );
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
});
