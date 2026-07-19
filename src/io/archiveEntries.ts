import JSZip from 'jszip';

export interface ArchiveEntry {
  relativePath: string;
  directory: boolean;
  contents?: Uint8Array;
}

function assertSafeArchivePath(relativePath: string) {
  const segments = relativePath.split('/');
  if (
    relativePath.length === 0
    || relativePath.includes('\0')
    || relativePath.includes('\\')
    || relativePath.startsWith('/')
    || /^[A-Za-z]:/.test(relativePath)
    || segments.includes('..')
  ) {
    throw new Error('압축 파일에 안전하지 않은 경로가 있습니다.');
  }
}

function isMacOsJunkPath(relativePath: string) {
  return relativePath
    .split('/')
    .some((segment) =>
      segment === '__MACOSX'
      || segment === '.DS_Store'
      || segment.startsWith('._'));
}

export async function decodeArchiveEntries(
  source: Uint8Array,
): Promise<readonly ArchiveEntry[]> {
  const zip = await JSZip.loadAsync(source);
  return Promise.all(Object.values(zip.files).map(async (entry) => {
    const originalName = (
      entry as JSZip.JSZipObject & {
        unsafeOriginalName?: string;
      }
    ).unsafeOriginalName ?? entry.name;
    assertSafeArchivePath(originalName);
    assertSafeArchivePath(entry.name);
    return {
      relativePath: entry.name,
      directory: entry.dir,
      contents: entry.dir
        ? undefined
        : await entry.async('uint8array'),
    };
  }));
}

export async function encodeCleanArchiveEntries(
  entries: readonly ArchiveEntry[],
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const entry of entries) {
    assertSafeArchivePath(entry.relativePath);
    if (isMacOsJunkPath(entry.relativePath)) continue;
    if (entry.directory) {
      zip.folder(entry.relativePath);
    } else {
      zip.file(
        entry.relativePath,
        Array.from(entry.contents ?? []),
        { createFolders: false },
      );
    }
  }
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
  });
}
