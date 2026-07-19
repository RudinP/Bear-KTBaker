import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../../domain/theme';
import {
  AndroidChatRoomPreview,
  IosChatRoomPreview,
} from './ChatRoomPreview';

const previewCss = readFileSync('src/preview/preview.css', 'utf8');

let previewStyles: HTMLStyleElement;

beforeAll(() => {
  previewStyles = document.createElement('style');
  previewStyles.textContent = previewCss;
  document.head.append(previewStyles);
});

afterAll(() => previewStyles.remove());

function renderChat(platform: 'ios' | 'android') {
  const ChatRoomPreview = platform === 'ios'
    ? IosChatRoomPreview
    : AndroidChatRoomPreview;
  return render(<ChatRoomPreview project={createDefaultTheme()} platform={platform} screen="chatroom"
    selected="screen-background" onSelect={vi.fn()} />);
}

describe('platform chatroom host layout', () => {
  it.each([
    ['ios', 'InputBarStyle-Chat|background-color'],
    ['android', 'theme_chatroom_input_bar_background_color'],
  ] as const)('keeps the %s composer surface transparent while controls retain the configured background', (platform, colorKey) => {
    const project = createDefaultTheme();
    project.colorValues[platform][colorKey] = '#123456';
    const ChatRoomPreview = platform === 'ios'
      ? IosChatRoomPreview
      : AndroidChatRoomPreview;
    const { container } = render(<ChatRoomPreview project={project} platform={platform} screen="chatroom"
      selected="screen-background" onSelect={vi.fn()} />);

    const composer = container.querySelector<HTMLElement>('.kt-composer');
    const controls = container.querySelector<HTMLElement>('.kt-composer-controls');
    expect(getComputedStyle(composer!).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(controls).toHaveStyle({ backgroundColor: '#123456' });
  });

  it('uses an iOS date chip but no Android date chip', () => {
    const ios = renderChat('ios');
    expect(ios.container.querySelector('[data-testid="date-chip"]')).toBeInTheDocument();
    ios.unmount();
    const android = renderChat('android');
    expect(android.container.querySelector('[data-testid="date-chip"]')).not.toBeInTheDocument();
  });

  it.each(['ios', 'android'] as const)('lays message groups in flow on %s', (platform) => {
    const { container } = renderChat(platform);
    expect(container.querySelector('.kt-message-flow')).toHaveAttribute('data-layout', 'flow');
    expect(container.querySelector('.kt-message-stack')).toBeInTheDocument();
    expect(container.querySelector('.kt-message.received')).toHaveAttribute('data-anchor', 'start');
    expect(container.querySelector('.kt-message.sent')).toHaveAttribute('data-anchor', 'end');
  });

  it('uses the platform-specific received-message sequence shown in each official guide', () => {
    const ios = renderChat('ios');
    expect(ios.container.querySelectorAll('.kt-message.received .kt-bubble')).toHaveLength(2);
    ios.unmount();
    const android = renderChat('android');
    expect(android.container.querySelectorAll('.kt-message.received .kt-bubble')).toHaveLength(3);
  });

  it('shows the official input-after state by default on Android and still exposes input-before', () => {
    const { container } = renderChat('android');
    const input = screen.getByRole('textbox', { name: '메시지 입력 미리보기' });
    expect(input).toHaveValue('카카오톡 테마');
    expect(container.querySelector('.kt-chat-send')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '' } });
    expect(container.querySelector('.kt-chat-send')).not.toBeInTheDocument();
    expect(container.querySelector('.kt-composer-fixed-icon.hash')).toBeInTheDocument();
  });

  it('does not render a fabricated text-only attachment grid', () => {
    renderChat('ios');
    fireEvent.click(screen.getByLabelText('메뉴 버튼 꾸미기'));
    expect(screen.queryByText('친구위치')).not.toBeInTheDocument();
    expect(document.querySelector('.kt-attachments')).not.toBeInTheDocument();
  });
});
