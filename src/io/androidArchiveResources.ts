import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { stripNinePatchBorder } from './ninePatchPng';

export type AndroidArchiveKind = 'apk' | 'source';
export type AndroidResourceType = 'drawable' | 'mipmap';

export interface AndroidResourceIdentity {
  key: `${AndroidResourceType}/${string}`;
  type: AndroidResourceType;
  name: string;
  semanticQualifier: string;
  fileName: string;
  sourcePath: string;
}

export interface AndroidArchiveCandidate {
  path: string;
  entry: JSZip.JSZipObject;
  identity: AndroidResourceIdentity;
  compiled: boolean;
}

export interface AndroidArchiveIndex {
  find(path: string): JSZip.JSZipObject | undefined;
  identity(path: string): AndroidResourceIdentity | undefined;
  resourceEntries(type: AndroidResourceType, name: string): AndroidArchiveCandidate[];
}

export interface AndroidCandidateOptions {
  index: AndroidArchiveIndex;
  kind: AndroidArchiveKind;
  bindingFiles: readonly string[];
  resourceFiles?: Record<string, string[]>;
}

export interface AndroidPixelFingerprint {
  width: number;
  height: number;
  sha256: string;
}

export function normalizeAndroidArchivePath(input: string) {
  const replaced = input.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
  if (replaced.startsWith('/') || /^[A-Za-z]:\//.test(replaced)) {
    throw new Error('안전하지 않은 Android 압축 경로입니다.');
  }
  const segments = replaced.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.some((segment) => segment === '..')) {
    throw new Error('안전하지 않은 Android 압축 경로입니다.');
  }
  return segments.join('/');
}

function resourceName(fileName: string) {
  return fileName.replace(/\.9\.png$/i, '').replace(/\.(?:png|xml)$/i, '');
}

export function androidResourceIdentity(input: string): AndroidResourceIdentity | undefined {
  const sourcePath = normalizeAndroidArchivePath(input);
  const source = sourcePath.match(/^src\/main\/(?:theme|theme-adv|res)\/([^/]+)\/(.+)$/i);
  const compiled = sourcePath.match(/^res\/([^/]+)\/(.+)$/i);
  const match = source ?? compiled;
  if (!match) return undefined;
  const [, rawQualifier, fileName] = match;
  const qualifier = rawQualifier.toLowerCase().replace(/-v\d+$/i, '');
  const type = qualifier.split('-', 1)[0];
  if (type !== 'drawable' && type !== 'mipmap') return undefined;
  const name = resourceName(fileName).toLowerCase();
  return {
    key: `${type}/${name}`,
    type,
    name,
    semanticQualifier: qualifier,
    fileName,
    sourcePath,
  };
}

interface IndexedAndroidEntry {
  path: string;
  entry: JSZip.JSZipObject;
  identity?: AndroidResourceIdentity;
}

function indexedResourceIdentity(input: string, kind: AndroidArchiveKind) {
  const path = normalizeAndroidArchivePath(input);
  const matchesKind = kind === 'source' ? /^src\/main\//i.test(path) : /^res\//i.test(path);
  return matchesKind ? androidResourceIdentity(path) : undefined;
}

function isFinderMetadataPath(input: string) {
  return normalizeAndroidArchivePath(input).split('/').some((segment) => {
    const lower = segment.toLowerCase();
    return lower === '__macosx' || lower === '.appledouble' || lower.startsWith('._');
  });
}

export function createAndroidArchiveIndex(
  zip: JSZip,
  kind: AndroidArchiveKind,
): AndroidArchiveIndex {
  const normalized = Object.values(zip.files).map((entry) => {
    const unsafe = (entry as JSZip.JSZipObject & { unsafeOriginalName?: string })
      .unsafeOriginalName;
    if (unsafe !== undefined) normalizeAndroidArchivePath(unsafe);
    return { entry, path: normalizeAndroidArchivePath(entry.name) };
  }).filter(({ entry, path }) => !entry.dir && (kind !== 'source' || !isFinderMetadataPath(path)));
  const sourceRoots = new Set<string>();
  if (kind === 'source') {
    for (const { path } of normalized) {
      const segments = path.split('/');
      const marker = segments.findIndex((segment, index) =>
        segment.toLowerCase() === 'src' && segments[index + 1]?.toLowerCase() === 'main');
      if (marker < 0) continue;
      if (marker > 1) throw new Error('Android 소스 ZIP 루트가 두 단계 이상 감싸져 있습니다.');
      sourceRoots.add(marker === 0 ? '' : segments[0].toLowerCase());
    }
    if (sourceRoots.size > 1) {
      throw new Error('Android 소스 ZIP 루트가 둘 이상입니다.');
    }
  }
  const wrapper = [...sourceRoots][0] ?? '';
  const lookup = new Map<string, IndexedAndroidEntry>();
  const resourceRecords: IndexedAndroidEntry[] = [];
  const add = (
    alias: string,
    entry: JSZip.JSZipObject,
    identityPath: string,
  ) => {
    const path = normalizeAndroidArchivePath(alias);
    const key = path.toLowerCase();
    const existing = lookup.get(key);
    if (existing && existing.entry !== entry) {
      throw new Error(`Android 압축 경로가 충돌합니다: ${path}`);
    }
    lookup.set(key, { path, entry, identity: indexedResourceIdentity(identityPath, kind) });
  };

  for (const { entry, path } of normalized) {
    const prefix = wrapper ? `${wrapper}/` : '';
    const canonical = kind === 'source'
      && prefix
      && path.toLowerCase().startsWith(prefix)
      ? path.slice(prefix.length)
      : path;
    const record = { path, entry, identity: indexedResourceIdentity(canonical, kind) };
    resourceRecords.push(record);
    add(path, entry, canonical);
    if (canonical !== path) add(canonical, entry, canonical);
  }

  return {
    find(path) {
      return lookup.get(normalizeAndroidArchivePath(path).toLowerCase())?.entry;
    },
    identity(path) {
      return lookup.get(normalizeAndroidArchivePath(path).toLowerCase())?.identity;
    },
    resourceEntries(type, name) {
      return resourceRecords
        .filter(({ identity }) => identity?.type === type && identity.name === name)
        .sort((left, right) => left.path.localeCompare(right.path))
        .map(({ path, entry, identity }) => ({
          path,
          entry,
          identity: identity!,
          compiled: kind === 'apk',
        }));
    },
  };
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function isAndroidPngPath(path: string) {
  return /(?:\.9)?\.png$/i.test(path);
}

export function androidPngCandidates({
  index,
  kind,
  bindingFiles,
  resourceFiles = {},
}: AndroidCandidateOptions) {
  const desired = bindingFiles.flatMap((file) => {
    const identity = androidResourceIdentity(file);
    return identity ? [identity] : [];
  });
  const keys = unique(desired.map(({ key }) => key));
  const metadataPaths = keys.flatMap((key) => resourceFiles[key] ?? []);
  const bindingPaths = desired.flatMap(({ key, semanticQualifier, fileName }) => {
    const [type, name] = key.split('/') as [AndroidResourceType, string];
    return index.resourceEntries(type, name)
      .filter(({ identity }) => identity.semanticQualifier === semanticQualifier
        && identity.fileName.toLowerCase() === fileName.toLowerCase())
      .map(({ path }) => path);
  });
  const constrainedPaths = keys.flatMap((key) => {
    const [type, name] = key.split('/') as [AndroidResourceType, string];
    return index.resourceEntries(type, name).map(({ path }) => path);
  });
  const groups = kind === 'apk'
    ? [metadataPaths, bindingPaths, constrainedPaths]
    : [bindingFiles, constrainedPaths];
  const preference = new Map<string, number>();
  desired.forEach(({ semanticQualifier }, order) => {
    if (!preference.has(semanticQualifier)) preference.set(semanticQualifier, order);
  });
  const seen = new Set<string>();
  return groups.flatMap((paths, originRank) => paths.map((path, pathOrder) => ({
    path,
    originRank,
    pathOrder,
  })))
    .filter(({ path }) => isAndroidPngPath(path))
    .flatMap(({ path, originRank, pathOrder }) => {
      const normalizedKey = normalizeAndroidArchivePath(path).toLowerCase();
      if (seen.has(normalizedKey)) return [];
      seen.add(normalizedKey);
      const entry = index.find(path);
      const identity = index.identity(path);
      return entry && identity ? [{
        path: normalizeAndroidArchivePath(entry.name),
        entry,
        identity,
        compiled: kind === 'apk',
        originRank,
        pathOrder,
      }] : [];
    })
    .sort((left, right) => left.originRank - right.originRank
      || (preference.get(left.identity.semanticQualifier) ?? Number.MAX_SAFE_INTEGER)
        - (preference.get(right.identity.semanticQualifier) ?? Number.MAX_SAFE_INTEGER)
      || left.pathOrder - right.pathOrder)
    .map(({ originRank: _originRank, pathOrder: _pathOrder, ...candidate }) => candidate);
}

export function fingerprintAndroidPng(buffer: Buffer, sourceNinePatch: boolean): AndroidPixelFingerprint {
  const decoded = PNG.sync.read(sourceNinePatch ? stripNinePatchBorder(buffer) : buffer);
  const pixels = Buffer.from(decoded.data);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] === 0) pixels.fill(0, offset, offset + 3);
  }
  return {
    width: decoded.width,
    height: decoded.height,
    sha256: createHash('sha256').update(pixels).digest('hex'),
  };
}
