import { describe, expect, it } from 'vitest';
import {
  androidPackageId,
  androidVersionCode,
  androidVersionName,
} from './androidPackageMetadata';

describe('Android package metadata policy', () => {
  it.each([
    ['Com.Example.Pretty-Theme', 'com.example.prettytheme'],
    ['123.Theme', 't123.theme'],
    ['single-theme', 'com.themestudio.singletheme'],
    ['..A..!@#.B..', 'a.b'],
    ['!!!', 'com.themestudio.theme'],
  ])('normalizes package id %j to %j', (themeId, expected) => {
    expect(androidPackageId(themeId)).toBe(expected);
  });

  it.each([
    ['2.3.4', 20_304],
    ['2..4', 20_004],
    ['v2.beta3.4rc', 20_304],
    ['not-a-version', 1],
    ['', 1],
  ])('maps version %j to code %d', (version, expected) => {
    expect(androidVersionCode(version)).toBe(expected);
  });

  it.each([
    ['2.3.4', '2.3.4'],
    [' 2.3 beta+4 ', '2.3beta4'],
    ['v2_beta-4', 'v2_beta-4'],
    ['!!!', '1.0.0'],
    ['', '1.0.0'],
  ])('sanitizes version name %j to %j', (version, expected) => {
    expect(androidVersionName(version)).toBe(expected);
  });
});
