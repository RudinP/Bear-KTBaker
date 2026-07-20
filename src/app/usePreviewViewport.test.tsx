// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePreviewViewport } from './usePreviewViewport';

function ViewportHarness({ active = true }: { active?: boolean }) {
  const viewport = usePreviewViewport(active);
  if (!active) return null;

  return (
    <div
      ref={viewport.stageRef}
      data-testid="stage"
      className={[
        viewport.spacePanReady && 'is-space-pan-ready',
        viewport.panning && 'is-panning',
      ].filter(Boolean).join(' ')}
      onPointerDown={viewport.onPointerDown}
      onLostPointerCapture={viewport.onLostPointerCapture}
    >
      <output>{viewport.zoom}%</output>
      <button disabled={!viewport.canZoomOut} onClick={viewport.zoomOut}>out</button>
      <button disabled={!viewport.canZoomIn} onClick={viewport.zoomIn}>in</button>
    </div>
  );
}

function setScrollPosition(stage: HTMLElement, left: number, top: number) {
  Object.defineProperties(stage, {
    scrollLeft: { value: left, writable: true },
    scrollTop: { value: top, writable: true },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('usePreviewViewport', () => {
  it('zooms in five-percent steps between 50 and 200 percent', () => {
    render(<ViewportHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'out' }));
    expect(screen.getByText('95%')).toBeInTheDocument();

    for (let index = 0; index < 9; index += 1) fireEvent.click(screen.getByRole('button', { name: 'out' }));
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'out' })).toBeDisabled();

    for (let index = 0; index < 31; index += 1) fireEvent.click(screen.getByRole('button', { name: 'in' }));
    expect(screen.getByText('200%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'in' })).toBeDisabled();
  });

  it('zooms with a cancelable non-passive wheel listener without handling horizontal gestures', () => {
    const addEventListener = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    render(<ViewportHarness />);
    const stage = screen.getByTestId('stage');

    expect(addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
    expect(fireEvent.wheel(stage, { deltaY: -100 })).toBe(false);
    expect(screen.getByText('105%')).toBeInTheDocument();
    expect(fireEvent.wheel(stage, { deltaY: 100, shiftKey: true })).toBe(true);
    expect(fireEvent.wheel(stage, { deltaX: 100, deltaY: 10 })).toBe(true);
    expect(screen.getByText('105%')).toBeInTheDocument();
  });

  it('pans with Space-drag and stops after pointer release or Space release', () => {
    render(<ViewportHarness />);
    const stage = screen.getByTestId('stage');
    setScrollPosition(stage, 120, 80);
    stage.setPointerCapture = vi.fn();
    stage.releasePointerCapture = vi.fn();

    expect(fireEvent.keyDown(window, { key: ' ' })).toBe(false);
    expect(stage).toHaveClass('is-space-pan-ready');
    fireEvent.pointerDown(stage, { pointerId: 7, clientX: 300, clientY: 200 });
    expect(stage.setPointerCapture).toHaveBeenCalledWith(7);
    expect(stage).toHaveClass('is-panning');
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 260, clientY: 150 });
    expect([stage.scrollLeft, stage.scrollTop]).toEqual([160, 130]);

    fireEvent.pointerUp(window, { pointerId: 7 });
    expect(stage.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(stage).not.toHaveClass('is-panning');
    expect(stage).toHaveClass('is-space-pan-ready');

    expect(fireEvent.keyUp(window, { key: ' ' })).toBe(false);
    expect(stage).not.toHaveClass('is-space-pan-ready');
  });

  it('stops panning after capture loss, pointer cancellation, or window blur', () => {
    render(<ViewportHarness />);
    const stage = screen.getByTestId('stage');
    setScrollPosition(stage, 10, 20);
    stage.setPointerCapture = vi.fn();
    stage.releasePointerCapture = vi.fn();

    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.pointerDown(stage, { pointerId: 3, clientX: 100, clientY: 100 });
    fireEvent.lostPointerCapture(stage, { pointerId: 3 });
    fireEvent.pointerMove(window, { pointerId: 3, clientX: 50, clientY: 50 });
    expect([stage.scrollLeft, stage.scrollTop]).toEqual([10, 20]);

    fireEvent.pointerDown(stage, { pointerId: 4, clientX: 100, clientY: 100 });
    fireEvent.pointerCancel(window, { pointerId: 4 });
    fireEvent.pointerMove(window, { pointerId: 4, clientX: 50, clientY: 50 });
    expect([stage.scrollLeft, stage.scrollTop]).toEqual([10, 20]);

    fireEvent.pointerDown(stage, { pointerId: 5, clientX: 100, clientY: 100 });
    fireEvent.blur(window);
    fireEvent.pointerMove(window, { pointerId: 5, clientX: 50, clientY: 50 });
    expect([stage.scrollLeft, stage.scrollTop]).toEqual([10, 20]);
    expect(stage).not.toHaveClass('is-space-pan-ready');
    expect(stage).not.toHaveClass('is-panning');
  });

  it('leaves Space available to editable controls', () => {
    render(<><ViewportHarness /><input aria-label="editable" /></>);
    const stage = screen.getByTestId('stage');

    expect(fireEvent.keyDown(screen.getByRole('textbox', { name: 'editable' }), { key: ' ' })).toBe(true);
    expect(stage).not.toHaveClass('is-space-pan-ready');
  });

  it('attaches listeners only while active and cleans them up on unmount', () => {
    const addEventListener = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const removeEventListener = vi.spyOn(HTMLElement.prototype, 'removeEventListener');
    const addWindowEventListener = vi.spyOn(window, 'addEventListener');
    const removeWindowEventListener = vi.spyOn(window, 'removeEventListener');
    const { rerender, unmount } = render(<ViewportHarness active={false} />);

    expect(addEventListener).not.toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
    expect(addWindowEventListener).not.toHaveBeenCalledWith('keydown', expect.any(Function));
    rerender(<ViewportHarness active />);
    expect(addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
    expect(addWindowEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    rerender(<ViewportHarness active={false} />);
    expect(removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function));
    expect(removeWindowEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

    rerender(<ViewportHarness active />);
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function));
    expect(removeWindowEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
