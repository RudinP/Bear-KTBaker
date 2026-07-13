import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../domain/theme';
import { Inspector } from './Inspector';

function renderInspector(selected: Parameters<typeof Inspector>[0]['selected'], onNinePatch = vi.fn(), platform: 'ios' | 'android' = 'android') {
  const project = createDefaultTheme();
  const onProject = vi.fn();
  const view = render(<Inspector project={project} platform={platform} screen="chatroom" selected={selected} onProject={onProject} onNinePatch={onNinePatch} />);
  return { project, onProject, onNinePatch, ...view };
}

describe('manifest-driven inspector', () => {
  it('shows every domestic tab image state as a separate mapped upload slot', () => {
    renderInspector('tabbar');
    expect(screen.getByLabelText('하단 탭 배경 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('친구 탭 기본 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('친구 탭 선택 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('더보기 탭 기본 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('더보기 탭 선택 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('픽코마 탭 기본 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('콜 탭 선택 이미지')).toBeInTheDocument();
  });

  it.each([
    ['ios', 'BottomBannerStyle|background-color'],
    ['android', 'theme_tab_bannerbadge_background_color'],
  ] as const)('exposes only the documented single %s bottom-banner color', (platform, key) => {
    const { container } = render(<Inspector project={createDefaultTheme()} platform={platform} screen="chats" selected="tabbar" onProject={vi.fn()} onNinePatch={vi.fn()} />);
    const ids = [...container.querySelectorAll<HTMLElement>('[data-color-slot]')].map((element) => element.dataset.colorSlot);

    expect(ids).toContain('main.banner');
    expect(ids).not.toContain('main.banner.light');
    expect(ids).not.toContain('main.banner.dark');
    expect(screen.getByText(key)).toBeInTheDocument();
  });

  it('exposes all Android profile and add-friend image files documented by the guide', () => {
    renderInspector('profile');
    expect(screen.getByLabelText('1번 기본 프로필 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('2번 기본 프로필 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('3번 기본 프로필 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('1번 프로필 상세 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('친구 추가 버튼 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('친구 추가 버튼 눌림 이미지')).toBeInTheDocument();
  });

  it('exposes three independent iOS default-profile image slots', () => {
    render(<Inspector project={createDefaultTheme()} platform="ios" screen="friends" selected="profile" onProject={vi.fn()} onNinePatch={vi.fn()} />);
    expect(screen.getByLabelText('1번 기본 프로필 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('2번 기본 프로필 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('3번 기본 프로필 이미지')).toBeInTheDocument();
    expect(screen.queryByLabelText('1번 프로필 상세 이미지')).not.toBeInTheDocument();
  });

  it('shows the distinct Android direct-share and notification keys on the notification screen', () => {
    render(<Inspector project={createDefaultTheme()} platform="android" screen="notification" selected="notification" onProject={vi.fn()} onNinePatch={vi.fn()} />);
    expect(screen.getByText('theme_direct_share_background_color')).toBeInTheDocument();
    expect(screen.getByText('theme_direct_share_button_color')).toBeInTheDocument();
    expect(screen.getByText('theme_notification_background_color')).toBeInTheDocument();
    expect(screen.getByText('theme_notification_background_pressed_color')).toBeInTheDocument();
  });

  it('stores a selected file under the same official resource id used by preview and export', async () => {
    const { onProject } = renderInspector('profile');
    const file = new File(['profile'], 'my-profile.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('1번 기본 프로필 이미지'), { target: { files: [file] } });

    await waitFor(() => expect(onProject).toHaveBeenCalled());
    const updated = onProject.mock.calls.at(-1)?.[0];
    expect(updated.platformResources.android['main.profile.01'].fileName).toBe('my-profile.png');
    expect(updated.platformResources.android['main.profile.01'].sourceScale).toBe(3);
  });

  it('shows the original pixel dimensions next to an attached image name', () => {
    const project = createDefaultTheme();
    project.platformResources.android['chat.background'] = {
      fileName: '첨부된 이미지',
      dataUrl: 'data:image/png;base64,AA==',
      width: 1146,
      height: 862,
    };

    render(<Inspector project={project} platform="android" screen="chatroom" selected="screen-background" onProject={vi.fn()} onNinePatch={vi.fn()} />);

    expect(screen.getByText('첨부된 이미지 · 1146 × 862')).toBeInTheDocument();
  });

  it('contains long resource metadata in a truncation node with a full native tooltip', () => {
    const project = createDefaultTheme();
    const metadata = '매우-긴-말풍선-리소스-파일명-원본.9.png · 1146 × 862';
    project.platformResources.android['chat.bubble.me.first.normal'] = {
      fileName: '매우-긴-말풍선-리소스-파일명-원본.9.png',
      dataUrl: 'data:image/png;base64,AA==',
      width: 1146,
      height: 862,
    };

    render(<Inspector project={project} platform="android" screen="chatroom" selected="bubble-me" onProject={vi.fn()} onNinePatch={vi.fn()} />);

    expect(screen.getByTitle(metadata)).toHaveClass('resource-file-meta');
    expect(screen.getByTitle(metadata)).toHaveTextContent(metadata);
  });

  it('keeps an uploaded Android .9.png marker border until export rebuilds it', async () => {
    const { onProject } = renderInspector('bubble-me');
    const file = new File(['bubble'], 'wide-bubble.9.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('보낸 첫 말풍선 이미지'), { target: { files: [file] } });

    await waitFor(() => expect(onProject).toHaveBeenCalled());
    const asset = onProject.mock.calls.at(-1)?.[0].platformResources.android['chat.bubble.me.first.normal'];
    expect(asset.rawNinePatch).toBe(true);
    expect(asset.sourceScale).toBe(3);
  });

  it('shows only the two normal bubble images that exist in the Android APK', () => {
    const { onNinePatch } = renderInspector('bubble-me');
    expect(screen.getByLabelText('보낸 첫 말풍선 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('보낸 연속 말풍선 이미지')).toBeInTheDocument();
    expect(screen.queryByLabelText('보낸 첫 말풍선 눌림 이미지')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('보낸 연속 말풍선 눌림 이미지')).not.toBeInTheDocument();
    expect(screen.getByText('2개')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /영역 조정$/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '보낸 연속 말풍선 영역 조정' }));
    expect(onNinePatch).toHaveBeenCalledWith('grouped', 'chat.bubble.me.grouped.normal');
  });

  it('keeps all four independently stretched iOS bubble images', () => {
    renderInspector('bubble-me', vi.fn(), 'ios');

    expect(screen.getByLabelText('보낸 첫 말풍선 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('보낸 첫 말풍선 눌림 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('보낸 연속 말풍선 이미지')).toBeInTheDocument();
    expect(screen.getByLabelText('보낸 연속 말풍선 눌림 이미지')).toBeInTheDocument();
    expect(screen.getByText('4개')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /영역 조정$/ })).toHaveLength(4);
  });

  it('shows the current official sample thumbnail without filler copy before upload', () => {
    const { container } = renderInspector('bubble-me');
    const firstThumb = container.querySelector<HTMLElement>('.resource-file .asset-thumb');

    expect(firstThumb?.style.backgroundImage).toContain('/sample/android/src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png');
    expect(container.textContent).not.toContain('iPhone과 Android에 적용');
    expect(container.textContent).not.toContain('공식 iPhone 샘플');
  });

  it('explains image priority wherever a screen accepts both a color and an image', () => {
    renderInspector('screen-background');
    expect(screen.getByText('이미지 첨부 시 이미지가 우선적으로 적용됩니다.')).toBeInTheDocument();
  });

  it('shows only the exact iOS and Android guide key connected to a clicked icon', () => {
    renderInspector('color:chat.input.menu.icon');
    expect(screen.getByLabelText('입력바 메뉴 아이콘 색상')).toBeInTheDocument();
    expect(screen.getByText('theme_chatroom_input_bar_menu_icon_color')).toBeInTheDocument();
    expect(screen.queryByLabelText('입력바 배경 색상')).not.toBeInTheDocument();
  });

  it.each(['ios', 'android'] as const)('sends a %s color edit to every corresponding OS key', (platform) => {
    const { project, onProject } = renderInspector('color:chat.input.menu.icon', vi.fn(), platform);
    fireEvent.change(screen.getByLabelText('입력바 메뉴 아이콘 색상'), { target: { value: '#123456' } });

    const updated = onProject.mock.calls.at(-1)?.[0];
    expect(updated.colorValues[platform]).not.toEqual(project.colorValues[platform]);
    const correspondingPlatform = platform === 'ios' ? 'android' : 'ios';
    expect(updated.colorValues[correspondingPlatform]).not.toEqual(project.colorValues[correspondingPlatform]);
  });

  it('shows and edits the Android alpha channel inside the color picker card', () => {
    const { container, onProject } = renderInspector('color:chat.input.menu.background', vi.fn(), 'android');
    const alpha = screen.getByRole('spinbutton', { name: '입력바 메뉴 배경 알파값' });
    const swatch = screen.getByTestId('chat.input.menu.background-color-swatch');

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(alpha).toHaveValue(4);
    expect(swatch).toHaveAttribute('data-preview-color', '#0000000A');
    expect(container.querySelector('.color-alpha-field')).toHaveTextContent('알파%');

    fireEvent.change(alpha, { target: { value: '50' } });
    expect(onProject.mock.calls.at(-1)?.[0].colorValues.android.theme_chatroom_input_bar_menu_button_color)
      .toBe('#80000000');
  });

  it('shows and edits the iOS alpha declaration in the same color picker card', () => {
    const { onProject } = renderInspector('color:chat.input.menu.background', vi.fn(), 'ios');
    const alpha = screen.getByRole('spinbutton', { name: '입력바 메뉴 배경 알파값' });

    expect(alpha).toHaveValue(4);
    expect(screen.getByTestId('chat.input.menu.background-color-swatch'))
      .toHaveAttribute('data-preview-color', '#0000000A');

    fireEvent.change(alpha, { target: { value: '35' } });
    expect(onProject.mock.calls.at(-1)?.[0].colorValues.ios['InputBarStyle-Chat|-ios-button-normal-background-alpha'])
      .toBe('0.35');
  });

  it.each([
    ['ios', ['notification.background', 'notification.title', 'notification.message', 'direct-share.background', 'direct-share.title', 'direct-share.message']],
    ['android', ['notification.background', 'notification.background.pressed', 'notification.title', 'direct-share.background', 'direct-share.title', 'direct-share.button']],
  ] as const)('shows each %s notification PDF color exactly once', (platform, expected) => {
    const { container } = render(<Inspector project={createDefaultTheme()} platform={platform} screen="notification" selected="notification" onProject={vi.fn()} onNinePatch={vi.fn()} />);
    const ids = [...container.querySelectorAll<HTMLElement>('[data-color-slot]')].map((element) => element.dataset.colorSlot);

    expect(ids).toEqual(expected);
  });

  it('shows the independent received unread-number color for an iOS received bubble', () => {
    const { container } = render(<Inspector project={createDefaultTheme()} platform="ios" screen="chatroom" selected="bubble-you" onProject={vi.fn()} onNinePatch={vi.fn()} />);
    const ids = [...container.querySelectorAll<HTMLElement>('[data-color-slot]')].map((element) => element.dataset.colorSlot);

    expect(ids).toContain('chat.unread.received');
    expect(ids).not.toContain('chat.unread');
  });

  it.each(['ios', 'android'] as const)('connects the %s Now background picker to the secondary screen color that is actually rendered', (platform) => {
    const { container } = render(<Inspector project={createDefaultTheme()} platform={platform} screen="now" selected="screen-background" onProject={vi.fn()} onNinePatch={vi.fn()} />);
    const ids = [...container.querySelectorAll<HTMLElement>('[data-color-slot]')].map((element) => element.dataset.colorSlot);

    expect(ids).toContain('main.secondary.background');
    expect(ids).not.toContain('main.background');
  });

  it.each(['ios', 'android'] as const)('shows both send background and icon colors for the %s send control', (platform) => {
    renderInspector('inputbar-send', vi.fn(), platform);

    expect(screen.getByLabelText('보내기 버튼 색상')).toBeInTheDocument();
    expect(screen.getByLabelText('보내기 아이콘 색상')).toBeInTheDocument();
  });

  it.each(['ios', 'android'] as const)('shows both menu background and icon colors for the %s menu control', (platform) => {
    renderInspector('inputbar-menu', vi.fn(), platform);

    expect(screen.getByLabelText('입력바 메뉴 배경 색상')).toBeInTheDocument();
    expect(screen.getByLabelText('입력바 메뉴 아이콘 색상')).toBeInTheDocument();
  });

  it.each(['ios', 'android'] as const)('shows both input background and text colors for the %s input field', (platform) => {
    renderInspector('inputbar-field', vi.fn(), platform);

    expect(screen.getByLabelText('입력바 배경 색상')).toBeInTheDocument();
    expect(screen.getByLabelText('입력바 글자 색상')).toBeInTheDocument();
  });

  it('shows the Android header background together with the visible header controls', () => {
    render(<Inspector project={createDefaultTheme()} platform="android" screen="friends" selected="header" onProject={vi.fn()} onNinePatch={vi.fn()} />);
    expect(screen.getByText('theme_header_color')).toBeInTheDocument();
    expect(screen.getByText('theme_header_cell_color')).toBeInTheDocument();
  });

  it('does not repeat the project-wide font setting in the selected-element inspector', () => {
    renderInspector('screen-background');
    expect(screen.queryByLabelText('미리보기 폰트 파일')).not.toBeInTheDocument();
  });

  it('exposes all four Android passcode bullets in both normal and checked states', () => {
    renderInspector('passcode-keypad');
    for (let index = 1; index <= 4; index += 1) {
      expect(screen.getByLabelText(`${index}번째 불릿 기본 이미지`)).toBeInTheDocument();
      expect(screen.getByLabelText(`${index}번째 불릿 입력됨 이미지`)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText('숫자 키패드 눌림 이미지')).not.toBeInTheDocument();
  });
});
