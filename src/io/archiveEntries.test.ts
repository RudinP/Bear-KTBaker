import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  decodeArchiveEntries,
  encodeCleanArchiveEntries,
  type ArchiveEntry,
} from './archiveEntries';

describe('archive entries', () => {
  it('decodes entry names, directory flags, and exact file bytes', async () => {
    const zip = new JSZip();
    zip.folder('images');
    zip.file('images/icon.png', new Uint8Array([0, 1, 127, 255]));

    const entries = await decodeArchiveEntries(
      await zip.generateAsync({ type: 'uint8array' }),
    );

    expect(entries).toEqual([
      {
        relativePath: 'images/',
        directory: true,
        contents: undefined,
      },
      {
        relativePath: 'images/icon.png',
        directory: false,
        contents: new Uint8Array([0, 1, 127, 255]),
      },
    ]);
  });

  it('round-trips ordinary entries without changing their bytes', async () => {
    const entries: readonly ArchiveEntry[] = [
      { relativePath: 'assets/', directory: true },
      {
        relativePath: 'assets/a.bin',
        directory: false,
        contents: new Uint8Array([9, 8, 7, 0]),
      },
      {
        relativePath: 'empty.txt',
        directory: false,
        contents: new Uint8Array(),
      },
    ];

    await expect(
      decodeArchiveEntries(await encodeCleanArchiveEntries(entries)),
    ).resolves.toEqual(entries);
  });

  it('does not synthesize parent directories for nested file entries', async () => {
    const entries: readonly ArchiveEntry[] = [
      {
        relativePath: 'Images/first.png',
        directory: false,
        contents: new Uint8Array([1]),
      },
      {
        relativePath: 'KakaoTalkTheme.css',
        directory: false,
        contents: new Uint8Array([2]),
      },
      {
        relativePath: 'Images/second.png',
        directory: false,
        contents: new Uint8Array([3]),
      },
    ];

    const roundTripped = await decodeArchiveEntries(
      await encodeCleanArchiveEntries(entries),
    );

    expect(roundTripped.map((entry) => entry.relativePath))
      .toEqual(entries.map((entry) => entry.relativePath));
    expect(roundTripped).toHaveLength(entries.length);
  });

  it('keeps the real iOS template at 59 entries without Images/', async () => {
    const template = new Uint8Array(await readFile(resolve(
      'resources/templates/ios-base.ktheme',
    )));
    const original = await decodeArchiveEntries(template);

    const roundTripped = await decodeArchiveEntries(
      await encodeCleanArchiveEntries(original),
    );

    expect(original).toHaveLength(59);
    expect(roundTripped).toHaveLength(59);
    expect(roundTripped.map((entry) => entry.relativePath))
      .toEqual(original.map((entry) => entry.relativePath));
    expect(roundTripped.some(
      (entry) => entry.relativePath === 'Images/',
    )).toBe(false);
  });

  it('omits macOS metadata from clean archives at any path depth', async () => {
    const encoded = await encodeCleanArchiveEntries([
      {
        relativePath: '__MACOSX/._icon.png',
        directory: false,
        contents: new Uint8Array([1]),
      },
      {
        relativePath: 'assets/.DS_Store',
        directory: false,
        contents: new Uint8Array([2]),
      },
      {
        relativePath: 'assets/._icon.png',
        directory: false,
        contents: new Uint8Array([3]),
      },
      {
        relativePath: 'assets/icon.png',
        directory: false,
        contents: new Uint8Array([4]),
      },
    ]);

    const entries = await decodeArchiveEntries(encoded);

    expect(entries
      .filter((entry) => !entry.directory)
      .map((entry) => entry.relativePath))
      .toEqual(['assets/icon.png']);
  });

  it.each([
    '',
    'bad\0name.png',
    '/absolute/icon.png',
    'C:/themes/icon.png',
    'C:\\themes\\icon.png',
    'images\\icon.png',
    '../icon.png',
    'images/../icon.png',
  ])('rejects an unsafe caller-provided path: %j', async (relativePath) => {
    await expect(encodeCleanArchiveEntries([{
      relativePath,
      directory: false,
      contents: new Uint8Array([1]),
    }])).rejects.toThrow('압축 파일에 안전하지 않은 경로가 있습니다.');
  });

  it('rejects a traversal path from an archive before returning entries', async () => {
    const zip = new JSZip();
    zip.file('../escaped.txt', 'unsafe');
    zip.file('safe.txt', 'safe');
    const source = await zip.generateAsync({ type: 'uint8array' });

    await expect(decodeArchiveEntries(source))
      .rejects.toThrow('압축 파일에 안전하지 않은 경로가 있습니다.');
  });
});
