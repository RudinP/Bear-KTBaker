import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_NINE_PATCH, type NinePatchGuides } from '../domain/ninePatch';
import { clearNinePatchClipboard } from '../domain/ninePatchClipboard';
import { NinePatchEditor } from './NinePatchEditor';

describe('nine-patch area editor', () => {
  beforeEach(() => clearNinePatchClipboard());
  it('shows real source pixels and lets the user type exact stretch coordinates', () => {
    const onChange = vi.fn();
    render(<NinePatchEditor platform="android" guides={DEFAULT_NINE_PATCH} color="#ff7f7f" imageSize={{ width: 122, height: 112 }} onChange={onChange} onClose={vi.fn()} />);

    expect(screen.getByLabelText('X 시작 (px)')).toHaveValue(51);
    expect(screen.getByLabelText('X 끝 (px)')).toHaveValue(71);
    expect(screen.getByLabelText('Y 시작 (px)')).toHaveValue(45);
    expect(screen.getByLabelText('Y 끝 (px)')).toHaveValue(67);
    expect(screen.getByLabelText('글자 왼쪽 (px)')).toHaveValue(20);
    expect(screen.getByLabelText('글자 위 (px)')).toHaveValue(13);
    expect(screen.getByLabelText('글자 오른쪽 (px)')).toHaveValue(102);
    expect(screen.getByLabelText('글자 아래 (px)')).toHaveValue(99);
    expect(document.querySelectorAll('[data-guide-kind="stretch"]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-guide-kind="content"]')).toHaveLength(4);

    fireEvent.change(screen.getByLabelText('X 시작 (px)'), { target: { value: '54' } });
    const changed = onChange.mock.calls.at(-1)?.[0];
    expect(changed.stretch.x[0]).toBeCloseTo(54 / 122, 4);
    expect(changed.stretch.x[1]).toBe(DEFAULT_NINE_PATCH.stretch.x[1]);

    fireEvent.change(screen.getByLabelText('글자 오른쪽 (px)'), { target: { value: '92' } });
    const contentChanged = onChange.mock.calls.at(-1)?.[0];
    expect(contentChanged.content.right).toBeCloseTo(92 / 122, 4);
  });

  it('fits the editing canvas inside its bounds without changing the source aspect ratio', () => {
    render(<NinePatchEditor platform="android" guides={DEFAULT_NINE_PATCH} color="#ff7f7f" imageSize={{ width: 122, height: 112 }} onChange={vi.fn()} onClose={vi.fn()} />);

    const canvas = document.querySelector<HTMLElement>('.patch-canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.style.aspectRatio).toBe('122 / 112');
    expect(canvas?.style.width).toBe('370.35714285714283px');
    expect(canvas?.style.maxWidth).toBe('62vw');
  });

  it('commits a multi-pixel drag once when the pointer is dropped', () => {
    const onChange = vi.fn();
    render(<NinePatchEditor platform="android" guides={DEFAULT_NINE_PATCH} color="#ff7f7f" imageSize={{ width: 100, height: 100 }} onChange={onChange} onClose={vi.fn()} />);
    const canvas = document.querySelector<HTMLElement>('.patch-canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}),
    });
    const guide = screen.getByRole('button', { name: '세로 가이드 1' });
    guide.setPointerCapture = vi.fn();
    const start = Math.round(DEFAULT_NINE_PATCH.stretch.x[0] * 100);

    fireEvent.pointerDown(guide, { pointerId: 1, clientX: start });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: start + 1 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: start + 2 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: start + 4 });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('X 시작 (px)')).toHaveValue(start + 4);

    fireEvent.pointerUp(window, { pointerId: 1, clientX: start + 4 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].stretch.x[0]).toBeCloseTo((start + 4) / 100, 4);
  });

  it('also commits a content-inset drag once on drop', () => {
    const onChange = vi.fn();
    render(<NinePatchEditor platform="ios" guides={DEFAULT_NINE_PATCH} color="#ff7f7f" imageSize={{ width: 100, height: 100 }} onChange={onChange} onClose={vi.fn()} />);
    const canvas = document.querySelector<HTMLElement>('.patch-canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, toJSON: () => ({}),
    });
    const guide = screen.getByRole('button', { name: '글자 오른쪽 가이드' });
    guide.setPointerCapture = vi.fn();

    fireEvent.pointerDown(guide, { pointerId: 1, clientX: 84 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 83 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 82 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 80 });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('글자 오른쪽 (px)')).toHaveValue(80);

    fireEvent.pointerUp(window, { pointerId: 1, clientX: 80 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].content.right).toBeCloseTo(0.8, 4);
  });

  it('copies every coordinate and pastes it after opening a different bubble', () => {
    const sourceGuides: NinePatchGuides = {
      stretch: { x: [0.2, 0.6], y: [0.3, 0.7] },
      content: { left: 0.1, top: 0.25, right: 0.8, bottom: 0.9 },
    };
    const first = render(<NinePatchEditor platform="ios" guides={sourceGuides} color="#fff" imageSize={{ width: 100, height: 200 }} onChange={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: '전체 붙여넣기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '전체 복사' }));
    first.unmount();

    const onChange = vi.fn();
    render(<NinePatchEditor platform="ios" guides={DEFAULT_NINE_PATCH} color="#fff" imageSize={{ width: 200, height: 100 }} onChange={onChange} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '전체 붙여넣기' }));

    expect(onChange).toHaveBeenCalledWith({
      stretch: { x: [0.2, 0.6], y: [0.3, 0.7] },
      content: { left: 0.1, top: 0.25, right: 0.8, bottom: 0.9 },
    });
  });

  it('can paste only one coordinate row without replacing the other row', () => {
    const copied: NinePatchGuides = {
      stretch: { x: [0.1, 0.4], y: [0.2, 0.5] },
      content: { left: 0.15, top: 0.25, right: 0.75, bottom: 0.85 },
    };
    const first = render(<NinePatchEditor platform="android" guides={copied} color="#fff" imageSize={{ width: 100, height: 100 }} onChange={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '늘어나는 영역 복사' }));
    fireEvent.click(screen.getByRole('button', { name: '글자 영역 복사' }));
    first.unmount();

    const current: NinePatchGuides = {
      stretch: { x: [0.3, 0.6], y: [0.4, 0.8] },
      content: { left: 0.2, top: 0.3, right: 0.7, bottom: 0.9 },
    };
    const onChange = vi.fn();
    render(<NinePatchEditor platform="android" guides={current} color="#fff" imageSize={{ width: 100, height: 100 }} onChange={onChange} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '늘어나는 영역 붙여넣기' }));

    expect(onChange).toHaveBeenCalledWith({ stretch: copied.stretch, content: current.content });
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '글자 영역 붙여넣기' }));
    expect(onChange).toHaveBeenCalledWith({ stretch: current.stretch, content: copied.content });
  });

  it('never pastes iOS inset coordinates into the Android nine-patch editor', () => {
    const ios = render(<NinePatchEditor platform="ios" guides={DEFAULT_NINE_PATCH} color="#fff" imageSize={{ width: 100, height: 100 }} onChange={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '전체 복사' }));
    ios.unmount();

    render(<NinePatchEditor platform="android" guides={DEFAULT_NINE_PATCH} color="#fff" imageSize={{ width: 100, height: 100 }} onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: '전체 붙여넣기' })).toBeDisabled();
  });
});
