// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NineSliceImage } from './NineSliceImage';

const guides = {
  stretch: { x: [54 / 122, 56 / 122] as [number, number], y: [55 / 112, 57 / 112] as [number, number] },
  content: { left: 20 / 122, top: 12 / 112, right: 92 / 122, bottom: 100 / 112 },
};

describe('NineSliceImage', () => {
  it('renders one lattice canvas instead of nine independently rasterized CSS backgrounds', () => {
    const { container } = render(<NineSliceImage image="bubble.png" guides={guides}
      sourceSize={{ width: 122, height: 112 }} sourceScale={3} targetSize={{ width: 120, height: 54 }} />);
    const layer = container.querySelector<HTMLElement>('.kt-nine-slice');
    const canvas = container.querySelector<HTMLCanvasElement>('.kt-nine-slice-canvas');

    expect(layer).toHaveAttribute('data-renderer', 'nine-slice');
    expect(layer).toHaveAttribute('data-seam-overlap', '0');
    expect(container.querySelectorAll('.kt-nine-slice-cell')).toHaveLength(0);
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('data-target-width', '120');
    expect(canvas).toHaveAttribute('data-target-height', '54');
    expect(canvas).toHaveAttribute('data-center-width', '80');
  });

  it('does not paint a scalable row when proportional fixed caps consume the target height', () => {
    const { container } = render(<NineSliceImage image="bubble.png" guides={guides}
      sourceSize={{ width: 122, height: 112 }} sourceScale={3} targetSize={{ width: 58, height: 32 }} />);
    const canvas = container.querySelector<HTMLCanvasElement>('.kt-nine-slice-canvas');

    expect(canvas).toHaveAttribute('data-center-height', '0');
  });

  it('measures the untransformed layout box instead of the scaled screen rectangle', async () => {
    const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return this.classList.contains('kt-nine-slice') ? 120 : 0; } });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return this.classList.contains('kt-nine-slice') ? 54 : 0; } });
    try {
      const { container } = render(<NineSliceImage image="bubble.png" guides={guides}
        sourceSize={{ width: 122, height: 112 }} sourceScale={3} />);

      await waitFor(() => expect(container.querySelector<HTMLCanvasElement>('.kt-nine-slice-canvas')).toHaveAttribute('data-target-width', '120'));
    } finally {
      if (originalWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalWidth);
      else delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
      if (originalHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalHeight);
      else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
    }
  });
});
