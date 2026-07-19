import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { buildNinePatchPng, parseNinePatchPng, replaceNinePatchInterior, stripNinePatchBorder } from './ninePatchPng';

const sample = path.join(process.cwd(), 'public/sample/apeach/android/theme_chatroom_bubble_me_01_image.9.png');

describe('Android nine-patch PNG codec', () => {
  it('reads stretch and content markers from the official sample border', async () => {
    const parsed = parseNinePatchPng(await readFile(sample));

    expect(parsed.width).toBe(122);
    expect(parsed.height).toBe(112);
    expect(parsed.guides.stretch.x[0]).toBeCloseTo(54 / 122, 5);
    expect(parsed.guides.stretch.x[1]).toBeCloseTo(56 / 122, 5);
    expect(parsed.guides.stretch.y[0]).toBeCloseTo(55 / 112, 5);
    expect(parsed.guides.stretch.y[1]).toBeCloseTo(57 / 112, 5);
    expect(parsed.guides.content).toEqual({
      left: 20 / 122, top: 12 / 112, right: 92 / 122, bottom: 100 / 112,
    });
  });

  it('strips the marker border for preview and recreates it without changing guides', async () => {
    const original = await readFile(sample);
    const parsed = parseNinePatchPng(original);
    const borderless = stripNinePatchBorder(original);
    const image = PNG.sync.read(borderless);

    expect([image.width, image.height]).toEqual([122, 112]);

    const rebuilt = buildNinePatchPng(borderless, parsed.guides);
    const rebuiltImage = PNG.sync.read(rebuilt);
    const roundTrip = parseNinePatchPng(rebuilt);
    expect([rebuiltImage.width, rebuiltImage.height]).toEqual([124, 114]);
    expect(roundTrip.guides.stretch.x[0]).toBeCloseTo(parsed.guides.stretch.x[0], 2);
    expect(roundTrip.guides.content.right).toBeCloseTo(parsed.guides.content.right, 2);
  });

  it('can preserve a template border exactly for non-bubble nine-patch resources', async () => {
    const original = await readFile(sample);
    const borderless = stripNinePatchBorder(original);
    const replaced = replaceNinePatchInterior(original, borderless);
    expect(parseNinePatchPng(replaced).guides).toEqual(parseNinePatchPng(original).guides);
  });

  it('accepts portable Uint8Array inputs without changing output bytes', async () => {
    const original = await readFile(sample);
    const bytes = new Uint8Array(original);
    const borderless = stripNinePatchBorder(bytes);
    const guides = parseNinePatchPng(original).guides;

    expect(borderless).toEqual(stripNinePatchBorder(original));
    expect(replaceNinePatchInterior(bytes, new Uint8Array(borderless)))
      .toEqual(replaceNinePatchInterior(original, borderless));
    expect(buildNinePatchPng(new Uint8Array(borderless), guides))
      .toEqual(buildNinePatchPng(borderless, guides));
  });
});
