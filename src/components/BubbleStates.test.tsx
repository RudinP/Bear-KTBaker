import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../domain/theme';
import { BubbleStates } from './BubbleStates';

describe('BubbleStates', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    {
      platform: 'ios',
      normalKey: 'MessageCellStyle-Send|-ios-text-color',
      pressedKey: 'MessageCellStyle-Send|-ios-selected-text-color',
      normalColor: '#112233',
      pressedColor: '#445566',
    },
    {
      platform: 'android',
      normalKey: 'theme_chatroom_bubble_me_color',
      pressedKey: 'theme_chatroom_bubble_me_color',
      normalColor: '#778899',
      pressedColor: '#778899',
    },
  ] as const)('uses the canonical $platform normal and selected text-color slots', ({
    platform, normalKey, pressedKey, normalColor, pressedColor,
  }) => {
    const project = createDefaultTheme();
    project.chat.bubbles.me.normal.textColor = '#ABCDEF';
    project.chat.bubbles.me.pressed.textColor = '#ABCDEF';
    project.colorValues[platform][normalKey] = normalColor;
    project.colorValues[platform][pressedKey] = pressedColor;

    render(<BubbleStates project={project} platform={platform} side="me" />);

    const normal = screen.getByText('네!').closest<HTMLElement>('.mini-bubble');
    const pressed = screen.getByText('선택된 모습').closest<HTMLElement>('.mini-bubble');
    expect(normal?.style.getPropertyValue('--bubble-text')).toBe(normalColor);
    expect(pressed?.style.getPropertyValue('--bubble-text')).toBe(pressedColor);
  });

  it.each([
    ['ios', '14px', '400', '18px', '248px'],
    ['android', '15px', '300', '24px', '238px'],
  ] as const)('uses the real %s chat-bubble typography and maximum width', (platform, fontSize, fontWeight, lineHeight, maxWidth) => {
    const { container } = render(<BubbleStates project={createDefaultTheme()} platform={platform} side="me" />);
    const bubble = container.querySelector<HTMLElement>('.state-cell .mini-bubble');

    expect(bubble?.style.fontSize).toBe(fontSize);
    expect(bubble?.style.fontWeight).toBe(fontWeight);
    expect(bubble?.style.lineHeight).toBe(lineHeight);
    expect(bubble?.style.maxWidth).toBe(maxWidth);
  });

  it.each(['ios', 'android'] as const)('renders an unclipped, structured reply preview for %s', (platform) => {
    const { container } = render(<BubbleStates project={createDefaultTheme()} platform={platform} side="me" />);
    const panel = screen.getByLabelText('말풍선 모든 상태');
    const reply = container.querySelector<HTMLElement>('.state-cell.reply')!;

    expect(panel).toHaveAttribute('data-platform', platform);
    expect(reply).toHaveAttribute('data-layout', 'full-width');
    expect(reply.querySelector('[data-reply-title]')).toHaveTextContent('나에게 답장');
    expect(reply.querySelector('[data-reply-original]')).toHaveTextContent('답장 원문이 길어져도 자연스럽게 표시돼요.');
    expect(reply.querySelector('[data-reply-divider]')).toBeInTheDocument();
    expect(reply.querySelector('[data-reply-body]')).toHaveTextContent('답장하면 이렇게 돼');

    if (platform === 'ios') {
      expect(reply.querySelector('[data-renderer="ios-inset-nine-slice"]')).toBeInTheDocument();
      expect(reply.querySelector('[data-renderer="android-nine-patch"]')).not.toBeInTheDocument();
      expect(reply.querySelector('.mini-bubble')).toHaveAttribute('data-content-mode', 'wrap');
    } else {
      expect(reply.querySelector('[data-renderer="android-nine-patch"]')).toBeInTheDocument();
      expect(reply.querySelector('[data-renderer="ios-inset-nine-slice"]')).not.toBeInTheDocument();
    }
  });

  it('reuses the Android normal nine-patch for the pressed preview without retaining the iOS asset', () => {
    const project = createDefaultTheme();
    const { container, rerender } = render(<BubbleStates project={project} platform="ios" side="me" />);
    expect(container.querySelector('.state-cell.pressed [data-renderer="ios-inset-nine-slice"]')).toBeInTheDocument();

    rerender(<BubbleStates project={project} platform="android" side="me" />);

    const androidLayer = container.querySelector<HTMLElement>('.state-cell.pressed [data-renderer="android-nine-patch"]');
    const source = androidLayer?.querySelector<HTMLCanvasElement>('.kt-nine-slice-canvas')?.dataset.sourceImage ?? '';
    expect(androidLayer).toBeInTheDocument();
    expect(source).toContain('/sample/android/');
    expect(source).not.toContain('/sample/ios/');
    expect(androidLayer?.closest('.state-cell')).toHaveAttribute('data-resource-id', 'chat.bubble.me.first.normal');
  });

  it('ignores a previous bubble image load that finishes after a replacement asset', () => {
    const pending: DeferredImage[] = [];
    class DeferredImage {
      onload: null | (() => void) = null;
      naturalWidth = 0;
      naturalHeight = 0;
      private value = '';
      set src(value: string) { this.value = value; pending.push(this); }
      get src() { return this.value; }
    }
    vi.stubGlobal('Image', DeferredImage);

    const project = createDefaultTheme();
    const view = render(<BubbleStates project={project} platform="ios" side="me" />);
    const previous = pending.find((image) => image.src.includes('chatroomBubbleSend01'))!;
    const replacementUrl = 'data:image/png;base64,UkVQTEFDRU1FTlQ=';
    const replacement = createDefaultTheme();
    replacement.platformResources.ios['chat.bubble.me.first.normal'] = {
      fileName: 'replacement@3x.png', dataUrl: replacementUrl, width: 240, height: 150,
    };
    view.rerender(<BubbleStates project={replacement} platform="ios" side="me" />);
    const next = pending.find((image) => image.src === replacementUrl)!;

    next.naturalWidth = 240;
    next.naturalHeight = 150;
    act(() => next.onload?.());
    previous.naturalWidth = 120;
    previous.naturalHeight = 105;
    act(() => previous.onload?.());

    const canvas = screen.getByText('네!').closest('.mini-bubble')?.querySelector<HTMLCanvasElement>('.kt-nine-slice-canvas');
    expect(canvas?.dataset.sourceImage).toBe(replacementUrl);
  });

  it('lets every iOS state compress fixed caps through the canonical renderer', () => {
    const project = createDefaultTheme();
    const guides = {
      stretch: { x: [99 / 345, 102 / 345] as [number, number], y: [285 / 375, 288 / 375] as [number, number] },
      content: { left: 51 / 345, top: 249 / 375, right: 141 / 345, bottom: 321 / 375 },
    };
    for (const id of [
      'chat.bubble.me.first.normal',
      'chat.bubble.me.grouped.normal',
      'chat.bubble.me.first.pressed',
    ]) {
      project.platformResources.ios[id] = {
        fileName: `${id}@3x.png`, dataUrl: `data:image/png;base64,${id}`, width: 345, height: 375, sourceScale: 3,
      };
    }
    project.chat.bubbles.me.normal.stretchByPlatform = { ios: guides };
    project.chat.bubbles.me.grouped.stretchByPlatform = { ios: guides };
    project.chat.bubbles.me.pressed.stretchByPlatform = { ios: guides };

    const { container } = render(<BubbleStates project={project} platform="ios" side="me" />);
    const bubbles = [...container.querySelectorAll<HTMLElement>('.mini-bubble')];

    expect(bubbles).toHaveLength(5);
    expect(bubbles.every((bubble) => bubble.style.minWidth === '')).toBe(true);
    expect(bubbles.every((bubble) => bubble.style.minHeight === '')).toBe(true);
    expect(bubbles.every((bubble) => bubble.querySelector('[data-renderer="ios-inset-nine-slice"]'))).toBe(true);
    expect(bubbles.every((bubble) => bubble.querySelector('.kt-nine-slice-canvas'))).toBe(true);
    expect(bubbles.filter((bubble) => bubble.dataset.contentMode === 'single-line').every((bubble) => (
      bubble.querySelector('[data-ios-label-placement="mapped-nine-slice"]')
    ))).toBe(true);
    expect(bubbles.map((bubble) => bubble.dataset.contentMode)).toEqual([
      'single-line', 'wrap', 'wrap', 'single-line', 'single-line',
    ]);
  });

  it('does not impose bitmap-derived minimum dimensions on color-only iOS bubbles', () => {
    const project = createDefaultTheme('색상 전용', false);

    const { container } = render(<BubbleStates project={project} platform="ios" side="me" />);
    const bubbles = [...container.querySelectorAll<HTMLElement>('.mini-bubble')];

    expect(bubbles).toHaveLength(5);
    expect(bubbles.every((bubble) => bubble.style.minWidth === '')).toBe(true);
    expect(bubbles.every((bubble) => bubble.style.minHeight === '')).toBe(true);
    expect(container.querySelector('[data-renderer="ios-inset-nine-slice"]')).not.toBeInTheDocument();
  });
});
