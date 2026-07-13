import { describe, expect, it } from 'vitest';
import { calculateImagePlacement, resolveAssetScale } from './imagePlacement';

describe('official theme image placement', () => {
  it('places the iOS 1:2 sample background at its logical 375×750 size', () => {
    expect(calculateImagePlacement(
      { width: 1125, height: 2250, scale: 3 },
      { width: 375, height: 750 },
      'top-center-crop',
    )).toEqual({ x: 0, y: 0, width: 375, height: 750 });
  });

  it('top-crops the iOS 1:2 asset into the guide 393×852 full-device theme surface', () => {
    expect(calculateImagePlacement(
      { width: 1125, height: 2250, scale: 3 },
      { width: 393, height: 852 },
      'top-center-cover',
    )).toEqual({ x: -16.5, y: 0, width: 426, height: 852 });
  });

  it('top-crops the Android 1:2 background across the full app surface', () => {
    expect(calculateImagePlacement(
      { width: 1440, height: 2880, scale: 4 },
      { width: 360, height: 760 },
      'top-center-cover',
    )).toEqual({ x: -10, y: 0, width: 380, height: 760 });
  });

  it('distinguishes iOS scale suffixes, Android bubbles, and the guide four-times tab asset', () => {
    expect(resolveAssetScale({ fileName: 'maintabBgImage@3x.png' }, 'ios')).toBe(3);
    expect(resolveAssetScale({ fileName: 'theme_chatroom_bubble_me_01_image.png' }, 'android')).toBe(3);
    expect(resolveAssetScale({ fileName: 'theme_maintab_cell_image.9.png' }, 'android-tab')).toBe(4);
  });
});
