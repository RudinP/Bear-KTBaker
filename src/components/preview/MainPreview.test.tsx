import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../../domain/theme/defaults';
import { MainPreview } from './MainPreview';

function renderMain(platform: 'ios' | 'android') {
  return render(<MainPreview project={createDefaultTheme()} platform={platform} screen="chats"
    selected="screen-background" onSelect={vi.fn()} onNavigateScreen={vi.fn()} bannerVariant="hidden" />);
}

describe('official main and tab host layout', () => {
  it('renders the iOS center-crop tab background at 470×49 logical points', () => {
    const { container } = renderMain('ios');
    const tab = screen.getByTestId('tabbar');
    const image = container.querySelector('.kt-tabbar-background > img');

    expect(tab).toHaveAttribute('data-frame', '0,697,375,53');
    expect(image).toHaveAttribute('data-logical-size', '470x49');
  });

  it('renders the Android guide tab background at 360×53 instead of xxhdpi 480×71', () => {
    const { container } = renderMain('android');
    const tab = screen.getByTestId('tabbar');
    const image = container.querySelector('.kt-tabbar-background > img');

    expect(tab).toHaveAttribute('data-frame', '0,707,360,53');
    expect(image).toHaveAttribute('data-logical-size', '360x53');
    expect(image).toHaveAttribute('data-nine-patch', 'true');
  });

  it('switches official normal and selected tab resources when clicked', () => {
    renderMain('android');
    const friends = screen.getByRole('button', { name: '친구 탭 보기' });
    expect(friends.querySelector('img')?.src).toContain('theme_maintab_ico_friends_image.png');
    fireEvent.click(friends);
    expect(friends.querySelector('img')?.src).toContain('theme_maintab_ico_friends_focused_image.png');
  });
});
