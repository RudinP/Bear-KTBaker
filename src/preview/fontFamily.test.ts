import { describe, expect, it } from 'vitest';
import { previewFontFamily } from './fontFamily';

describe('previewFontFamily', () => {
  it('uses Kakao Small Sans as the default preview font on both platforms', () => {
    expect(previewFontFamily('ios')).toBe('"Kakao Small Sans", sans-serif');
    expect(previewFontFamily('android')).toBe('"Kakao Small Sans", sans-serif');
  });

  it('places the attached theme font before the platform fallback', () => {
    expect(previewFontFamily('android', 'My Theme Font')).toBe('"My Theme Font", "Kakao Small Sans", sans-serif');
  });
});
