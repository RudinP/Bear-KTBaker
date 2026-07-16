# Android APK Image Recovery and Export Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Android images from the file references compiled into an APK and reject exported APKs whose compiled pixels or 9-patch guides differ from the prepared resources.

**Architecture:** Add one Electron-independent archive module that owns Android resource identity, safe ZIP lookup, qualifier matching, candidate ordering, and decoded-pixel fingerprints. Extend compiled metadata with actual drawable and mipmap references, then make the importer and standalone verifier consume the shared module without importing each other. The runtime verification script performs the final exporter-to-importer round trip.

**Tech Stack:** TypeScript, Node.js, JSZip, pngjs, Vitest, AAPT2, Electron.

## Global Constraints

- The target application version is `0.1.2`, but this plan does not change package versions or push by itself.
- Every production behavior change begins with a failing regression test and a recorded RED result.
- `resources.arsc` file references are authoritative for compiled APKs.
- XML resource wrappers are not decoded as PNG images.
- Sent and received bubbles use the same candidate resolver and differ only by resource ID.
- Source ZIP imports retain color-only support; APK imports reject zero restored images.
- `src/main/ic_launcher-web.png` is not an AAPT2-compiled verification target.
- `androidStandaloneBuild` and `themeImport` must not import each other.
- No signing identity, user export, `release/`, `dist/`, or `dist-electron/` content may enter a commit.

---

### Task 1: Expose compiled drawable and mipmap file references

**Files:**
- Modify: `src/io/androidCompiledMetadata.ts:4-11,197-345`
- Modify: `src/io/themeImport.test.ts:375-395`

**Interfaces:**
- Produces: `AndroidCompiledMetadata.resourceFiles?: Record<string, string[]>`
- Key format: `drawable/<resourceName>` or `mipmap/<resourceName>`
- Values: every string resource value beginning with `res/`, including XML and PNG candidates

- [ ] **Step 1: Write the failing compiled-metadata assertion**

Add these assertions to the existing `extracts compiled APK metadata and colors without Android SDK tools` test:

```ts
expect(metadata.resourceFiles?.['drawable/theme_background_image']).toEqual(expect.arrayContaining([
  'res/drawable/theme_background_image.xml',
  'res/drawable-xxhdpi-v4/theme_background_image.png',
  'res/drawable-sw600dp-v13/theme_background_image.png',
]));
expect(metadata.resourceFiles?.['mipmap/ic_launcher']).toEqual(expect.arrayContaining([
  'res/mipmap-anydpi-v26/ic_launcher.xml',
  'res/mipmap-xxhdpi-v4/ic_launcher.png',
]));
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/io/themeImport.test.ts -t "extracts compiled APK metadata and colors"
```

Expected: FAIL because `metadata.resourceFiles` is `undefined`.

- [ ] **Step 3: Add the metadata property and collector**

Add the property and collect every direct file value without changing color and string candidate selection:

```ts
export interface AndroidCompiledMetadata {
  colors?: Record<string, string>;
  resourceFiles?: Record<string, string[]>;
  name?: string;
  resourcePackage?: string;
  version?: string;
  themeId?: string;
  appearance?: 'light' | 'dark';
}

function compiledResourceFiles(
  resources: Map<string, Map<string, ResourceCandidate[]>>,
) {
  const result: Record<string, string[]> = {};
  for (const type of ['drawable', 'mipmap'] as const) {
    for (const [name, candidates] of resources.get(type) ?? []) {
      const paths = [...new Set(candidates.flatMap(({ value }) =>
        typeof value === 'string' && value.startsWith('res/') ? [value] : []))].sort();
      if (paths.length) result[`${type}/${name}`] = paths;
    }
  }
  return result;
}
```

After `readResourceTable`, assign the non-empty result:

```ts
const resourceFiles = compiledResourceFiles(resources);
if (Object.keys(resourceFiles).length) result.resourceFiles = resourceFiles;
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- src/io/themeImport.test.ts -t "extracts compiled APK metadata and colors"
```

Expected: PASS with one test selected.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/io/androidCompiledMetadata.ts src/io/themeImport.test.ts
git commit -m "Expose compiled Android image references"
```

### Task 2: Build the safe Android archive resolver

**Files:**
- Create: `src/io/androidArchiveResources.ts`
- Create: `src/io/androidArchiveResources.test.ts`
- Read: `src/manifest/kakaoResources.ts`

**Interfaces:**
- Produces: `normalizeAndroidArchivePath(path: string): string`
- Produces: `androidResourceIdentity(path: string): AndroidResourceIdentity | undefined`
- Produces: `createAndroidArchiveIndex(zip: JSZip, kind: 'apk' | 'source'): AndroidArchiveIndex`
- Produces: `androidPngCandidates(options: AndroidCandidateOptions): AndroidArchiveCandidate[]`
- Produces: `fingerprintAndroidPng(buffer, sourceNinePatch): AndroidPixelFingerprint`
- Produces: `isAndroidPngPath(path): boolean`
- `AndroidResourceIdentity` contains `key`, `type`, `name`, `semanticQualifier`, `fileName`, and `sourcePath`

- [ ] **Step 1: Write failing identity and path-normalization tests**

Create `src/io/androidArchiveResources.test.ts` with these cases:

```ts
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  androidPngCandidates,
  androidResourceIdentity,
  createAndroidArchiveIndex,
  normalizeAndroidArchivePath,
} from './androidArchiveResources';

describe('Android archive resource lookup', () => {
  it('normalizes separators and rejects traversal', () => {
    expect(normalizeAndroidArchivePath('.\\res\\drawable-xxhdpi-v31\\bubble.9.png'))
      .toBe('res/drawable-xxhdpi-v31/bubble.9.png');
    expect(() => normalizeAndroidArchivePath('../res/drawable/bubble.png'))
      .toThrow('안전하지 않은 Android 압축 경로');
    expect(() => normalizeAndroidArchivePath('/res/drawable/bubble.png'))
      .toThrow('안전하지 않은 Android 압축 경로');
  });

  it('derives one semantic identity from source and compiled paths', () => {
    expect(androidResourceIdentity('src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png'))
      .toMatchObject({
        key: 'drawable/theme_chatroom_bubble_me_01_image',
        semanticQualifier: 'drawable-xxhdpi',
        fileName: 'theme_chatroom_bubble_me_01_image.9.png',
      });
    expect(androidResourceIdentity('res/drawable-xxhdpi-v4/theme_chatroom_bubble_me_01_image.9.png'))
      .toMatchObject({
        key: 'drawable/theme_chatroom_bubble_me_01_image',
        semanticQualifier: 'drawable-xxhdpi',
      });
    expect(androidResourceIdentity('src/main/ic_launcher-web.png')).toBeUndefined();
  });

  it('rejects traversal preserved by JSZip after load sanitizes the entry name', async () => {
    const source = new JSZip();
    source.file('../res/drawable/theme_background_image.png', 'unsafe');
    const loaded = await JSZip.loadAsync(await source.generateAsync({ type: 'nodebuffer' }));
    expect(loaded.file('res/drawable/theme_background_image.png')).toBeDefined();
    expect(() => createAndroidArchiveIndex(loaded, 'apk'))
      .toThrow('안전하지 않은 Android 압축 경로');
  });

  it('finds a case-varied backslash entry through a metadata path', async () => {
    const zip = new JSZip();
    zip.file('RES\\DRAWABLE-XXHDPI-V31\\THEME_BACKGROUND_IMAGE.PNG', Buffer.from('png'));
    const index = createAndroidArchiveIndex(zip, 'apk');
    const candidates = androidPngCandidates({
      index,
      kind: 'apk',
      bindingFiles: ['src/main/theme/drawable-xxhdpi/theme_background_image.png'],
      resourceFiles: {
        'drawable/theme_background_image': [
          'res/drawable/theme_background_image.xml',
          'res/drawable-xxhdpi-v31/theme_background_image.png',
        ],
      },
    });
    expect(candidates.map(({ path }) => path)).toEqual([
      'RES/DRAWABLE-XXHDPI-V31/THEME_BACKGROUND_IMAGE.PNG',
    ]);
  });

  it('accepts one source wrapper root and rejects normalized collisions', () => {
    const wrapped = new JSZip();
    wrapped.file('theme-project/src/main/theme/drawable-xxhdpi/theme_background_image.png', 'png');
    const wrappedIndex = createAndroidArchiveIndex(wrapped, 'source');
    expect(wrappedIndex.find('src/main/theme/drawable-xxhdpi/theme_background_image.png')).toBeDefined();
    expect(wrappedIndex.resourceEntries('drawable', 'theme_background_image')[0]?.identity)
      .toMatchObject({ sourcePath: 'src/main/theme/drawable-xxhdpi/theme_background_image.png' });

    const collided = new JSZip();
    collided.file('res/drawable/Icon.png', 'one');
    collided.file('RES/DRAWABLE/icon.png', 'two');
    expect(() => createAndroidArchiveIndex(collided, 'apk')).toThrow('Android 압축 경로가 충돌');
  });

  it('never returns the same basename from a different resource type', () => {
    const zip = new JSZip();
    zip.file('res/mipmap-xxhdpi-v4/theme_background_image.png', 'wrong type');
    const index = createAndroidArchiveIndex(zip, 'apk');
    expect(index.resourceEntries('drawable', 'theme_background_image')).toEqual([]);
  });

  it('keeps ARSC references ahead of a preferred binding qualifier fallback', () => {
    const zip = new JSZip();
    zip.file('res/drawable-xxhdpi-v4/theme_background_image.png', 'fallback');
    zip.file('res/drawable-sw600dp-v31/theme_background_image.png', 'metadata');
    const index = createAndroidArchiveIndex(zip, 'apk');
    const candidates = androidPngCandidates({
      index,
      kind: 'apk',
      bindingFiles: [
        'src/main/theme/drawable-xxhdpi/theme_background_image.png',
        'src/main/theme/drawable-sw600dp/theme_background_image.png',
      ],
      resourceFiles: { 'drawable/theme_background_image': [
        'res/drawable-sw600dp-v31/theme_background_image.png',
      ] },
    });
    expect(candidates.map(({ path }) => path)).toEqual([
      'res/drawable-sw600dp-v31/theme_background_image.png',
      'res/drawable-xxhdpi-v4/theme_background_image.png',
    ]);
  });

  it('rejects a source root nested below two wrapper directories', () => {
    const zip = new JSZip();
    zip.file('outer/inner/src/main/theme/drawable-xxhdpi/theme_background_image.png', 'png');
    expect(() => createAndroidArchiveIndex(zip, 'source')).toThrow('Android 소스 ZIP 루트');
  });

  it('ignores unrelated nested files while accepting one source wrapper', () => {
    const zip = new JSZip();
    zip.file('docs/outer/inner/readme.txt', 'notes');
    zip.file('theme-project/src/main/theme/drawable-xxhdpi/theme_background_image.png', 'png');
    expect(createAndroidArchiveIndex(zip, 'source')
      .find('src/main/theme/drawable-xxhdpi/theme_background_image.png')).toBeDefined();
  });

  it('rejects two distinct Android source wrapper roots', () => {
    const zip = new JSZip();
    zip.file('first/src/main/theme/drawable-xxhdpi/theme_background_image.png', 'one');
    zip.file('second/src/main/theme/drawable-xxhdpi/theme_chatroom_background_image.png', 'two');
    expect(() => createAndroidArchiveIndex(zip, 'source')).toThrow('Android 소스 ZIP 루트');
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
npm test -- src/io/androidArchiveResources.test.ts
```

Expected: FAIL because `androidArchiveResources.ts` does not exist.

- [ ] **Step 3: Implement identity and safe indexing**

Create these public types and functions in `src/io/androidArchiveResources.ts`:

```ts
import JSZip from 'jszip';

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
```

Implement `createAndroidArchiveIndex` with one normalized lowercase lookup map. Skip directory entries. Before using the sanitized `entry.name`, read `(entry as JSZip.JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName`; when present, pass it through `normalizeAndroidArchivePath` so a traversal that JSZip sanitized is still rejected. Add an alias that removes the single common prefix before `src/main/` for source archives. Store each source alias with the identity derived from its canonical `src/main/...` path so `identity(actualWrappedPath)` and `resourceEntries(...)` work for wrapped archives. Reject a second object claiming the same normalized lowercase key. Implement `resourceEntries` by exact `type` plus `name` equality against the stored identity, sorted by normalized path.

```ts
interface IndexedAndroidEntry {
  path: string;
  entry: JSZip.JSZipObject;
  identity?: AndroidResourceIdentity;
}

export function createAndroidArchiveIndex(
  zip: JSZip,
  kind: AndroidArchiveKind,
): AndroidArchiveIndex {
  const files = Object.values(zip.files).filter((entry) => !entry.dir);
  const normalized = files.map((entry) => {
    const unsafe = (entry as JSZip.JSZipObject & { unsafeOriginalName?: string })
      .unsafeOriginalName;
    if (unsafe !== undefined) normalizeAndroidArchivePath(unsafe);
    return { entry, path: normalizeAndroidArchivePath(entry.name) };
  });
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
    lookup.set(key, { path, entry, identity: androidResourceIdentity(identityPath) });
  };

  for (const { entry, path } of normalized) {
    const prefix = wrapper ? `${wrapper}/` : '';
    const canonical = kind === 'source'
      && prefix
      && path.toLowerCase().startsWith(`${prefix}src/main/`)
      ? path.slice(prefix.length)
      : path;
    const record = { path, entry, identity: androidResourceIdentity(canonical) };
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
```

Inspect only paths that actually contain a `src/main/` source-root candidate when deriving wrappers; unrelated nested documentation or metadata files do not invalidate the archive. The source alias may remove either no prefix or exactly one directory segment. Reject an Android source root shaped like `outer/inner/src/main/...`, and reject archives that advertise more than one distinct wrapper root; do not silently collapse an arbitrary-depth wrapper.

- [ ] **Step 4: Implement qualifier-aware PNG candidate ordering**

Use the binding order as the density and orientation preference. Metadata paths come first for APKs, exact source paths come first for source ZIPs, and constrained resource entries come last:

```ts
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
      const identity = index.identity(path) ?? androidResourceIdentity(path);
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
```

`originRank` is compared before qualifier preference, so no binding-derived xxhdpi fallback can outrank an ARSC-referenced sw600dp PNG. Qualifier preference applies only within the same origin group.

- [ ] **Step 5: Add decoded-pixel fingerprint tests and implementation**

Add these cases to `androidArchiveResources.test.ts` using `PNG.sync.write`:

```ts
function rgbaPng(pixels: number[][], width: number, height: number) {
  const image = new PNG({ width, height });
  pixels.forEach((pixel, index) => image.data.set(pixel, index * 4));
  return PNG.sync.write(image);
}

it('fingerprints re-encoded pixels identically and ignores transparent RGB noise', () => {
  const left = rgbaPng([[10, 20, 30, 0], [40, 50, 60, 255]], 2, 1);
  const right = rgbaPng([[200, 210, 220, 0], [40, 50, 60, 255]], 2, 1);
  expect(fingerprintAndroidPng(left, false)).toEqual(fingerprintAndroidPng(right, false));
});

it('fingerprints a source nine-patch by its visible interior', () => {
  const interior = rgbaPng([[90, 20, 30, 255]], 1, 1);
  const source = buildNinePatchPng(interior, {
    stretch: { x: [0, 1], y: [0, 1] },
    content: { left: 0, top: 0, right: 1, bottom: 1 },
  });
  expect(fingerprintAndroidPng(source, true)).toEqual(fingerprintAndroidPng(interior, false));
});
```

Import `PNG` from `pngjs`, `buildNinePatchPng` from `ninePatchPng`, and `fingerprintAndroidPng` from the module under test before running RED.

Implement in `androidArchiveResources.ts` with `node:crypto`, `pngjs`, and `stripNinePatchBorder`:

```ts
export interface AndroidPixelFingerprint {
  width: number;
  height: number;
  sha256: string;
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
```

- [ ] **Step 6: Run resolver tests and typecheck**

Run:

```bash
npm test -- src/io/androidArchiveResources.test.ts
npm run typecheck
```

Expected: all resolver tests PASS and typecheck exits 0.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/io/androidArchiveResources.ts src/io/androidArchiveResources.test.ts
git commit -m "Add safe Android archive resource lookup"
```

### Task 3: Route APK imports through actual resource references

**Files:**
- Modify: `src/io/themeImport.ts:25-49,132-190,347-401`
- Modify: `src/io/themeImport.test.ts:260-395`
- Modify: `electron/main.ts:354-363`

**Interfaces:**
- Consumes: `AndroidCompiledMetadata.resourceFiles`
- Consumes: `createAndroidArchiveIndex` and `androidPngCandidates`
- Produces internally: `MappedImageImportResult { mappedIds: Set<string>; failedResources: FailedAndroidResource[] }`
- Keeps public functions: `importAndroidSourceZip` and `importAndroidThemeArchive`

- [ ] **Step 1: Add failing tests for metadata paths and archive-kind validation**

Add tests that use real PNG buffers and no mocks:

```ts
it('uses resources.arsc paths across qualifier, case, and separator differences', async () => {
  const image = solidPng(12, 34, 56, 4, 8);
  const apk = new JSZip();
  apk.file('RES\\DRAWABLE-XXHDPI-V31\\THEME_BACKGROUND_IMAGE.PNG', image);
  const project = await importAndroidThemeArchive(
    await apk.generateAsync({ type: 'nodebuffer' }),
    'variant.apk',
    {
      colors: { theme_background_color: '#123456' },
      resourceFiles: {
        'drawable/theme_background_image': [
          'res/drawable/theme_background_image.xml',
          'res/drawable-xxhdpi-v31/theme_background_image.png',
        ],
      },
    },
  );
  expect(project.platformResources.android['main.background']?.dataUrl)
    .toBe(`data:image/png;base64,${image.toString('base64')}`);
});

it('tries every referenced PNG after XML, missing, and corrupt candidates', async () => {
  const image = solidPng(12, 34, 56, 4, 8);
  const apk = new JSZip();
  apk.file('res/drawable-xxhdpi-v31/theme_background_image.png', Buffer.from('not a png'));
  apk.file('res/drawable-sw600dp-v31/theme_background_image.png', image);
  const project = await importAndroidThemeArchive(
    await apk.generateAsync({ type: 'nodebuffer' }),
    'candidate-exhaustion.apk',
    { resourceFiles: { 'drawable/theme_background_image': [
      'res/drawable/theme_background_image.xml',
      'res/drawable-xhdpi-v4/theme_background_image.png',
      'res/drawable-xxhdpi-v31/theme_background_image.png',
      'res/drawable-sw600dp-v31/theme_background_image.png',
    ] } },
  );
  expect(project.platformResources.android['main.background']?.dataUrl)
    .toBe(`data:image/png;base64,${image.toString('base64')}`);
});

it('names the advertised resource after every APK candidate fails', async () => {
  const apk = new JSZip();
  apk.file('res/drawable-xxhdpi-v31/theme_background_image.png', Buffer.from('broken'));
  await expect(importAndroidThemeArchive(
    await apk.generateAsync({ type: 'nodebuffer' }),
    'broken.apk',
    { resourceFiles: { 'drawable/theme_background_image': [
      'res/drawable-xxhdpi-v31/theme_background_image.png',
    ] } },
  )).rejects.toThrow('drawable/theme_background_image');
});

it('does not report an XML-only compiled reference as a failed PNG', async () => {
  const image = solidPng(12, 34, 56, 4, 8);
  const apk = new JSZip();
  apk.file('res/drawable-xxhdpi-v31/theme_background_image.png', image);
  await expect(importAndroidThemeArchive(
    await apk.generateAsync({ type: 'nodebuffer' }),
    'xml-wrapper.apk',
    { resourceFiles: {
      'drawable/theme_background_image': ['res/drawable-xxhdpi-v31/theme_background_image.png'],
      'mipmap/ic_launcher_foreground': ['res/mipmap-anydpi-v26/ic_launcher_foreground.xml'],
    } },
  )).resolves.toMatchObject({ meta: { name: 'xml-wrapper' } });
});

it('imports source images below exactly one common wrapper directory', async () => {
  const image = solidPng(12, 34, 56, 4, 8);
  const source = new JSZip();
  source.file('theme-project/src/main/theme/drawable-xxhdpi/theme_background_image.png', image);
  const project = await importAndroidSourceZip(
    await source.generateAsync({ type: 'nodebuffer' }),
    'wrapped.zip',
  );
  expect(project.platformResources.android['main.background']?.dataUrl)
    .toBe(`data:image/png;base64,${image.toString('base64')}`);
});

it('rejects an APK when colors load but no image can be restored', async () => {
  const apk = await new JSZip().generateAsync({ type: 'nodebuffer' });
  await expect(importAndroidThemeArchive(apk, 'colors-only.apk', {
    colors: { theme_background_color: '#123456' },
  })).rejects.toThrow('색상은 읽었지만 이미지 리소스를 복원하지 못했습니다');
});

it('keeps color-only Android source ZIP support', async () => {
  const source = new JSZip();
  source.file('src/main/theme/values/colors.xml', '<resources><color name="theme_background_color">#123456</color></resources>');
  await expect(importAndroidSourceZip(
    await source.generateAsync({ type: 'nodebuffer' }),
    'colors-only.zip',
  )).resolves.toMatchObject({ screens: { friends: { background: { color: '#123456' } } } });
});
```

The real AAPT2 round trip in Task 5 asserts both `chat.bubble.me.first.normal` and `chat.bubble.you.first.normal`. Do not put an ordinary PNG at a compiled `.9.png` path in this unit test: `parseCompiledNinePatchPng` correctly rejects a PNG without an `npTc` chunk.

- [ ] **Step 2: Run the focused importer tests and verify RED**

Run:

```bash
npm test -- src/io/themeImport.test.ts -t "resources.arsc paths|every referenced PNG|advertised resource|XML-only compiled|common wrapper|colors load but no image|color-only Android source"
```

Expected: metadata-path restoration, candidate exhaustion, wrapper lookup, named failure, and zero-image rejection FAIL under the current importer.

- [ ] **Step 3: Convert existing synthetic APK tests to the strict APK entry point**

The current compiled-path, adaptive-icon, dark-metadata, and compiled-color tests call `importAndroidSourceZip` even though their suggested file is `.apk`. Keep source ZIP tests on the two-argument `importAndroidSourceZip`, but change every synthetic APK test to `importAndroidThemeArchive` and supply exact `resourceFiles` metadata for the files placed in its ZIP.

For dark metadata and compiled colors, put one ordinary background PNG in the synthetic APK so these tests exercise the strict public APK path:

```ts
const image = solidPng(12, 34, 56, 4, 8);
const apk = new JSZip();
apk.file('res/drawable-xxhdpi-v31/theme_background_image.png', image);
const resourceFiles = {
  'drawable/theme_background_image': [
    'res/drawable-xxhdpi-v31/theme_background_image.png',
  ],
};

const dark = await importAndroidThemeArchive(
  await apk.generateAsync({ type: 'nodebuffer' }),
  'dark.apk',
  { appearance: 'dark', resourceFiles },
);
expect(dark.meta.appearance).toBe('dark');

const colored = await importAndroidThemeArchive(
  await apk.generateAsync({ type: 'nodebuffer' }),
  'colors.apk',
  {
    resourceFiles,
    colors: {
      theme_header_color: '#102030',
      theme_background_color: '#203040',
      theme_chatroom_background_color: '#304050',
      theme_passcode_background_color: '#405060',
      theme_chatroom_input_bar_send_button_color: '#506070',
    },
  },
);
```

Retain the current color and background assertions against `colored`. Add one separate empty APK assertion without colors:

```ts
await expect(importAndroidThemeArchive(
  await new JSZip().generateAsync({ type: 'nodebuffer' }),
  'empty.apk',
  {},
)).rejects.toThrow('카카오톡 Android 테마 리소스를 찾지 못했습니다');
```

Expected: the source entry point remains a two-argument source-only API, while all compiled metadata and strict validation are exercised through the APK entry point.

- [ ] **Step 4: Refactor image lookup around the shared resolver**

Replace exact `zip.file` probing with this control flow while retaining the existing PNG, source nine-patch, compiled nine-patch, asset, and guide construction code in one `decodeMappedImage` helper:

```ts
interface MappedImageImportResult {
  mappedIds: Set<string>;
  failedResources: FailedAndroidResource[];
}

interface FailedAndroidResource {
  resourceKey: string;
  referencedPaths: string[];
  errors: string[];
}

interface MappedImageCandidate {
  path: string;
  entry: JSZip.JSZipObject;
  compiled: boolean;
}

interface DecodedMappedImage {
  asset: ImageAsset;
  guides?: NinePatchGuides;
}

function iosImageCandidates(
  zip: JSZip,
  resourceId: string,
  binding: PlatformResourceBinding,
  iosCss?: string,
): MappedImageCandidate[] {
  return [...new Set([
    ...iosReferencedFiles(resourceId, binding, iosCss),
    ...orderedFiles(binding, 'ios'),
  ])].flatMap((candidate) => {
    const entry = zip.file(candidate);
    return entry ? [{ path: candidate, entry, compiled: false }] : [];
  });
}

async function importMappedImages(
  zip: JSZip,
  project: ThemeProject,
  platform: 'ios' | 'android',
  options: {
    archiveKind: 'ios' | 'source' | 'apk';
    resourceFiles?: Record<string, string[]>;
    iosCss?: string;
  },
): Promise<MappedImageImportResult> {
  const mappedIds = new Set<string>();
  const failedResources: FailedAndroidResource[] = [];
  const androidIndex = platform === 'android'
    ? createAndroidArchiveIndex(zip, options.archiveKind === 'apk' ? 'apk' : 'source')
    : undefined;

  for (const slot of KAKAO_RESOURCE_SLOTS) {
    const binding = slot[platform];
    if (!binding || binding.files.length === 0) continue;
    const candidates = platform === 'android'
      ? androidPngCandidates({
        index: androidIndex!,
        kind: options.archiveKind === 'apk' ? 'apk' : 'source',
        bindingFiles: orderedFiles(binding, platform),
        resourceFiles: options.resourceFiles,
      })
      : iosImageCandidates(zip, slot.id, binding, options.iosCss);
    const decodeErrors: string[] = [];
    let restored = false;
    for (const candidate of candidates) {
      let decoded: DecodedMappedImage;
      try {
        decoded = await decodeMappedImage(platform, slot, candidate);
      } catch (error) {
        decodeErrors.push(`${candidate.path}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      applyDecodedMappedImage(project, platform, slot.id, decoded);
      mappedIds.add(slot.id);
      restored = true;
      break;
    }
    if (!restored && platform === 'android') {
      const referencesByKey = new Map<string, string[]>();
      for (const file of binding.files) {
        const key = androidResourceIdentity(file)?.key;
        if (!key) continue;
        const paths = (options.resourceFiles?.[key] ?? []).filter(isAndroidPngPath);
        if (paths.length) referencesByKey.set(key, paths);
      }
      for (const [resourceKey, referencedPaths] of referencesByKey) {
        failedResources.push({
          resourceKey,
          referencedPaths,
          errors: [
            ...referencedPaths
              .filter((path) => !androidIndex!.find(path))
              .map((path) => `${path}: ZIP 엔트리 없음`),
            ...decodeErrors,
          ],
        });
      }
    }
  }
  return { mappedIds, failedResources };
}
```

Define `decodeMappedImage(platform, slot, candidate: MappedImageCandidate)` so it only reads and parses bytes and returns `{ asset, guides? }`. Define `applyDecodedMappedImage(project, platform, resourceId, decoded)` to set bubble guides and both resource maps. `AndroidArchiveCandidate` is structurally assignable to `MappedImageCandidate`; the decoder must use `candidate.path` for file name and scale calculation and `candidate.compiled` to choose compiled nine-patch parsing. Only entry reading and PNG/9-patch decoding are inside `try/catch`; project mutation happens after the catch so programming errors are not silently treated as corrupt candidates.

```ts
async function decodeMappedImage(
  platform: 'ios' | 'android',
  slot: KakaoResourceSlot,
  candidate: MappedImageCandidate,
): Promise<DecodedMappedImage> {
  const binding = slot[platform]!;
  const source = await candidate.entry.async('nodebuffer');
  if (platform === 'android' && binding.ninePatch) {
    const png = PNG.sync.read(source);
    const parsed = candidate.compiled && slot.id.startsWith('chat.bubble.')
      ? parseCompiledNinePatchPng(source)
      : candidate.compiled
        ? { width: png.width, height: png.height, guides: undefined }
        : parseNinePatchPng(source);
    const preview = candidate.compiled ? source : stripNinePatchBorder(source);
    return {
      asset: {
        fileName: path.basename(candidate.path).replace('.9.png', '.png'),
        dataUrl: dataUrl(preview),
        width: parsed.width,
        height: parsed.height,
        sourceScale: importedSourceScale(slot.id, platform, candidate.path),
        rawNinePatch: false,
      },
      guides: parsed.guides,
    };
  }
  const png = PNG.sync.read(source);
  return {
    asset: {
      fileName: path.basename(candidate.path),
      dataUrl: dataUrl(source),
      width: png.width,
      height: png.height,
      sourceScale: importedSourceScale(slot.id, platform, candidate.path),
      rawNinePatch: false,
    },
  };
}

function applyDecodedMappedImage(
  project: ThemeProject,
  platform: 'ios' | 'android',
  resourceId: string,
  decoded: DecodedMappedImage,
) {
  if (decoded.guides) setBubbleGuides(project, resourceId, decoded.guides, platform);
  project.resources[resourceId] = decoded.asset;
  project.platformResources[platform][resourceId] = decoded.asset;
}
```

Add `type ImageAsset` to the theme import and `type KakaoResourceSlot` to the resource-manifest import used by these interfaces.

- [ ] **Step 5: Separate APK and source validation paths**

Create one private Android import body and keep two public wrappers:

```ts
interface AndroidArchiveImport {
  zip: JSZip;
  project: ThemeProject;
  images: MappedImageImportResult;
  archiveKind: 'apk' | 'source';
  compiledMetadata?: AndroidCompiledMetadata;
}

async function importAndroidArchive(
  source: Buffer,
  suggestedName: string,
  archiveKind: 'apk' | 'source',
  compiledMetadata?: AndroidCompiledMetadata,
) {
  const zip = await JSZip.loadAsync(source);
  const project = createDefaultTheme(suggestedName.replace(/\.(zip|apk)$/i, ''), false);
  const images = await importMappedImages(zip, project, 'android', {
    archiveKind,
    resourceFiles: compiledMetadata?.resourceFiles,
  });
  return { zip, project, images, archiveKind, compiledMetadata } satisfies AndroidArchiveImport;
}

export async function importAndroidSourceZip(
  source: Buffer,
  suggestedName: string,
) {
  const imported = await importAndroidArchive(source, suggestedName, 'source');
  return finishAndroidImport(imported);
}

export async function importAndroidThemeArchive(
  source: Buffer,
  suggestedName: string,
  compiledMetadata?: AndroidCompiledMetadata,
) {
  const imported = await importAndroidArchive(source, suggestedName, 'apk', compiledMetadata);
  const project = await finishAndroidImport(imported);
  if (imported.images.failedResources.length) {
    const details = imported.images.failedResources.map(({ resourceKey, referencedPaths, errors }) =>
      `${resourceKey} [${referencedPaths.join(', ')}]${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    throw new Error(`Android APK 이미지 리소스를 읽지 못했습니다: ${details.join('; ')}`);
  }
  if (imported.images.mappedIds.size === 0) {
    const hasCompiledThemeColor = Object.keys(compiledMetadata?.colors ?? {})
      .some((name) => name in ANDROID_SAMPLE_COLORS);
    if (hasCompiledThemeColor) {
      throw new Error('Android APK에서 테마 색상은 읽었지만 이미지 리소스를 복원하지 못했습니다. 원본 APK를 확인해 주세요.');
    }
    throw new Error('카카오톡 Android 테마 리소스를 찾지 못했습니다. APK 또는 Android 테마 소스 ZIP을 확인해 주세요.');
  }
  return project;
}
```

Move the existing color, manifest, strings, identity, mirror, and Now-tab migration logic into this exact archive-kind-aware helper. It receives the already-loaded ZIP and does not load the archive again:

```ts
async function finishAndroidImport({
  zip,
  project,
  archiveKind,
  compiledMetadata,
}: AndroidArchiveImport): Promise<ThemeProject> {
  migrateLegacyNowTabAssets(project);
  let importedColors = new Set<string>();

  if (archiveKind === 'apk') {
    if (compiledMetadata?.appearance) project.meta.appearance = compiledMetadata.appearance;
    if (compiledMetadata?.colors) {
      importedColors = applyAndroidColors(project, compiledMetadata.colors);
    }
    if (compiledMetadata?.name) project.meta.name = compiledMetadata.name;
    if (compiledMetadata?.version) project.meta.version = compiledMetadata.version;
    if (compiledMetadata?.themeId) project.meta.themeId = compiledMetadata.themeId;
  } else {
    const manifest = await zip.file('src/main/AndroidManifest.xml')?.async('string');
    project.meta.appearance = manifest
      && /<meta-data\b(?=[^>]*android:name=["']com\.kakao\.talk\.theme_style["'])(?=[^>]*android:value=["']dark["'])[^>]*\/>/i.test(manifest)
      ? 'dark'
      : 'light';
    const colors = await zip.file('src/main/theme/values/colors.xml')?.async('string');
    if (colors) {
      const parsedColors: Record<string, string> = {};
      for (const name of Object.keys(ANDROID_SAMPLE_COLORS)) {
        const parsed = xmlColor(colors, name);
        if (parsed) parsedColors[name] = parsed;
      }
      importedColors = applyAndroidColors(project, parsedColors);
    }
    const strings = await zip.file('src/main/theme/values/strings.xml')?.async('string');
    const title = decodeXmlText(
      strings?.match(/<string\s+name=["']theme_title["']>([^<]+)</)?.[1],
    );
    const gradle = await (zip.file('build.gradle.kts') ?? zip.file('build.gradle'))?.async('string');
    const sourceVersion = gradle?.match(/\bversionName\s*(?:=\s*)?["']([^"']+)["']/)?.[1]
      ?? manifest?.match(/\bandroid:versionName=["']([^"']+)["']/)?.[1];
    const sourceThemeId = gradle?.match(/\bapplicationId\s*(?:=\s*)?["']([^"']+)["']/)?.[1]
      ?? manifest?.match(/\bpackage=["']([^"']+)["']/)?.[1]
      ?? gradle?.match(/\bnamespace\s*(?:=\s*)?["']([^"']+)["']/)?.[1];
    if (title) project.meta.name = title;
    if (sourceVersion) project.meta.version = sourceVersion;
    if (sourceThemeId) project.meta.themeId = sourceThemeId;
  }

  mirrorSemanticResources(project, 'android');
  mirrorSemanticColors(project, 'android', importedColors);
  return project;
}
```

- [ ] **Step 6: Route Electron by detected archive kind**

Replace the shared call in `electron/main.ts` with explicit functions:

```ts
if (kind === 'android-apk') {
  const metadata = await inspectAndroidApk(file);
  return {
    kind: 'android' as const,
    project: await importAndroidThemeArchive(await readFile(file), path.basename(file), metadata),
  };
}
return {
  kind: 'android' as const,
  project: await importAndroidSourceZip(await readFile(file), path.basename(file)),
};
```

- [ ] **Step 7: Run importer tests and verify GREEN**

Run:

```bash
npm test -- src/io/androidArchiveResources.test.ts src/io/themeImport.test.ts
npm run typecheck
```

Expected: both files PASS and typecheck exits 0.

- [ ] **Step 8: Commit Task 3**

```bash
git add src/io/themeImport.ts src/io/themeImport.test.ts electron/main.ts
git commit -m "Restore Android APK images from compiled paths"
```

### Task 4: Verify exported pixels and 9-patch guides

**Files:**
- Create: `src/io/androidImageVerification.ts`
- Create: `src/io/androidImageVerification.test.ts`
- Modify: `src/io/androidStandaloneBuild.ts:20-65,270-340`
- Modify: `src/io/androidStandaloneBuild.test.ts`
- Modify: `electron/main.ts:180-227,250-286`

**Interfaces:**
- Consumes: `AndroidCompiledMetadata.resourceFiles`
- Produces: `AndroidImageExpectation`
- Produces: `createAndroidImageExpectation(resourceId, sourcePath, png, ninePatch)`
- Produces: `verifyCompiledAndroidImages(apk, metadata, expectations)`
- Produces: `assertAndroidImageOutputPossible(options)`
- Extends: `buildStandaloneAndroidApk({ expectedImages?: AndroidImageExpectation[] })`

- [ ] **Step 1: Write failing pixel, qualifier, and guide verification tests**

Decoded-pixel fingerprint behavior is already RED/GREEN in Task 2. Create `src/io/androidImageVerification.test.ts` for expectation construction, wrong pixels, exact qualifier matching, and integrated compiled 9-patch guides:

```ts
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { guidesToAndroidMarkers, type NinePatchGuides } from '../domain/ninePatch';
import {
  assertAndroidImageOutputPossible,
  createAndroidImageExpectation,
  verifyCompiledAndroidImages,
} from './androidImageVerification';
import { buildNinePatchPng } from './ninePatchPng';

function png(red: number, alpha = 255, width = 2, height = 2) {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) image.data.set([red, 20, 30, alpha], offset);
  return PNG.sync.write(image);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function compiledNinePatchPng(interior: Buffer, guides: NinePatchGuides) {
  const decoded = PNG.sync.read(interior);
  const markers = guidesToAndroidMarkers(guides, decoded.width, decoded.height);
  const payload = Buffer.alloc(52);
  payload[0] = 1;
  payload[1] = 2;
  payload[2] = 2;
  payload[3] = 1;
  payload.writeUInt32BE(markers.contentX[0], 12);
  payload.writeUInt32BE(decoded.width - markers.contentX[1], 16);
  payload.writeUInt32BE(markers.contentY[0], 20);
  payload.writeUInt32BE(decoded.height - markers.contentY[1], 24);
  payload.writeUInt32BE(markers.stretchX[0], 32);
  payload.writeUInt32BE(markers.stretchX[1], 36);
  payload.writeUInt32BE(markers.stretchY[0], 40);
  payload.writeUInt32BE(markers.stretchY[1], 44);
  payload.writeUInt32BE(1, 48);
  const type = Buffer.from('npTc');
  const chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length, 0);
  type.copy(chunk, 4);
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, payload])), payload.length + 8);
  const encoded = PNG.sync.write(decoded);
  let iendOffset = 8;
  while (encoded.toString('ascii', iendOffset + 4, iendOffset + 8) !== 'IEND') {
    iendOffset += encoded.readUInt32BE(iendOffset) + 12;
  }
  return Buffer.concat([encoded.subarray(0, iendOffset), chunk, encoded.subarray(iendOffset)]);
}

describe('compiled Android image verification', () => {
  it('names a mapped resource whose output size cannot be determined', () => {
    expect(() => assertAndroidImageOutputPossible({
      resourceId: 'main.background',
      sourcePath: 'src/main/theme/drawable-xxhdpi/theme_background_image.png',
      hasTemplate: false,
      hasOutputSize: false,
      flexibleBubble: false,
    })).toThrow('main.background');
  });

  it('keeps separate expectations for the same key in two qualifiers', () => {
    const phone = createAndroidImageExpectation(
      'main.background',
      'src/main/theme/drawable-xxhdpi/theme_background_image.png',
      png(40),
      false,
    )!;
    const tablet = createAndroidImageExpectation(
      'main.background',
      'src/main/theme/drawable-sw600dp/theme_background_image.png',
      png(40),
      false,
    )!;
    expect(phone.resourceKey).toBe(tablet.resourceKey);
    expect(phone.semanticQualifier).toBe('drawable-xxhdpi');
    expect(tablet.semanticQualifier).toBe('drawable-sw600dp');
  });

  it('rejects the correct resource key when compiled pixels differ', async () => {
    const source = png(40);
    const compiled = png(80);
    const expected = createAndroidImageExpectation(
      'main.background',
      'src/main/theme/drawable-xxhdpi/theme_background_image.png',
      source,
      false,
    )!;
    const zip = new JSZip();
    zip.file('res/drawable-xxhdpi-v4/theme_background_image.png', compiled);
    const apk = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(verifyCompiledAndroidImages(apk, {
      resourceFiles: {
        'drawable/theme_background_image': ['res/drawable-xxhdpi-v4/theme_background_image.png'],
      },
    }, [expected])).rejects.toThrow('main.background');
  });

  it('does not let another qualifier satisfy a path-specific expectation', async () => {
    const source = png(40);
    const expected = createAndroidImageExpectation(
      'main.background',
      'src/main/theme/drawable-xxhdpi/theme_background_image.png',
      source,
      false,
    )!;
    const zip = new JSZip();
    zip.file('res/drawable-sw600dp-v13/theme_background_image.png', source);
    await expect(verifyCompiledAndroidImages(
      await zip.generateAsync({ type: 'nodebuffer' }),
      { resourceFiles: { 'drawable/theme_background_image': [
        'res/drawable-sw600dp-v13/theme_background_image.png',
      ] } },
      [expected],
    )).rejects.toThrow('main.background');
  });

  it('accepts compiled nine-patch guides within one pixel and rejects a larger shift', async () => {
    const interior = png(90, 255, 10, 10);
    const guides: NinePatchGuides = {
      stretch: { x: [0, 0.5], y: [0, 0.5] },
      content: { left: 0, top: 0, right: 1, bottom: 1 },
    };
    const source = buildNinePatchPng(interior, guides);
    const compiled = compiledNinePatchPng(interior, guides);
    const expected = createAndroidImageExpectation(
      'chat.bubble.me.first.normal',
      'src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png',
      source,
      true,
    )!;
    const zip = new JSZip();
    zip.file('res/drawable-xxhdpi-v4/theme_chatroom_bubble_me_01_image.9.png', compiled);
    const apk = await zip.generateAsync({ type: 'nodebuffer' });
    const metadata = { resourceFiles: { 'drawable/theme_chatroom_bubble_me_01_image': [
      'res/drawable-xxhdpi-v4/theme_chatroom_bubble_me_01_image.9.png',
    ] } };
    await expect(verifyCompiledAndroidImages(apk, metadata, [expected])).resolves.toBeUndefined();
    const withinOnePixel = structuredClone(expected);
    withinOnePixel.guides!.stretch.x[0] += 1 / expected.width;
    await expect(verifyCompiledAndroidImages(apk, metadata, [withinOnePixel])).resolves.toBeUndefined();
    const outsideTolerance = structuredClone(expected);
    outsideTolerance.guides!.stretch.x[0] += 2 / expected.width;
    await expect(verifyCompiledAndroidImages(apk, metadata, [outsideTolerance]))
      .rejects.toThrow('chat.bubble.me.first.normal');
  });
});
```

- [ ] **Step 2: Run the verification test and verify RED**

Run:

```bash
npm test -- src/io/androidImageVerification.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement expectation records using the shared pixel fingerprint**

Use decoded pixels instead of compressed PNG bytes:

```ts
import JSZip from 'jszip';
import type { NinePatchGuides } from '../domain/ninePatch';
import {
  androidResourceIdentity,
  createAndroidArchiveIndex,
  fingerprintAndroidPng,
  isAndroidPngPath,
} from './androidArchiveResources';
import { parseCompiledNinePatchPng, parseNinePatchPng } from './ninePatchPng';
import type { AndroidCompiledMetadata } from './androidCompiledMetadata';

export interface AndroidImageExpectation {
  resourceId: string;
  sourcePath: string;
  resourceKey: string;
  semanticQualifier: string;
  ninePatch: boolean;
  width: number;
  height: number;
  pixelFingerprint: string;
  guides?: NinePatchGuides;
}

export function assertAndroidImageOutputPossible(options: {
  resourceId: string;
  sourcePath: string;
  hasTemplate: boolean;
  hasOutputSize: boolean;
  flexibleBubble: boolean;
}) {
  if (!options.hasTemplate && !options.hasOutputSize && !options.flexibleBubble) {
    throw new Error(`Android 이미지 출력 크기를 결정할 수 없습니다: ${options.resourceId} (${options.sourcePath})`);
  }
}

export function createAndroidImageExpectation(
  resourceId: string,
  sourcePath: string,
  png: Buffer,
  ninePatch: boolean,
): AndroidImageExpectation | undefined {
  const identity = androidResourceIdentity(sourcePath);
  if (!identity || !/^src\/main\/(?:res|theme|theme-adv)\//.test(identity.sourcePath)) return undefined;
  const fingerprint = fingerprintAndroidPng(png, ninePatch);
  return {
    resourceId,
    sourcePath: identity.sourcePath,
    resourceKey: identity.key,
    semanticQualifier: identity.semanticQualifier,
    ninePatch,
    width: fingerprint.width,
    height: fingerprint.height,
    pixelFingerprint: fingerprint.sha256,
    ...(ninePatch ? { guides: parseNinePatchPng(png).guides } : {}),
  };
}
```

- [ ] **Step 4: Implement compiled verification**

`verifyCompiledAndroidImages` loads the signed APK once, creates an APK index, and validates every expectation independently. Add these helpers and implementation:

```ts
function guidePixels(guides: NinePatchGuides, width: number, height: number) {
  return [
    guides.stretch.x[0] * width,
    guides.stretch.x[1] * width,
    guides.stretch.y[0] * height,
    guides.stretch.y[1] * height,
    guides.content.left * width,
    guides.content.top * height,
    guides.content.right * width,
    guides.content.bottom * height,
  ];
}

function guidesWithinOnePixel(
  expected: NinePatchGuides,
  actual: NinePatchGuides,
  width: number,
  height: number,
) {
  const expectedPixels = guidePixels(expected, width, height);
  const actualPixels = guidePixels(actual, width, height);
  return expectedPixels.every((value, index) => Math.abs(value - actualPixels[index]) <= 1);
}

export async function verifyCompiledAndroidImages(
  apk: Buffer,
  metadata: AndroidCompiledMetadata,
  expectations: readonly AndroidImageExpectation[],
) {
  const zip = await JSZip.loadAsync(apk);
  const index = createAndroidArchiveIndex(zip, 'apk');
  const mismatches: string[] = [];
  for (const expected of expectations) {
    const paths = (metadata.resourceFiles?.[expected.resourceKey] ?? [])
      .filter(isAndroidPngPath)
      .filter((path) => {
        const identity = androidResourceIdentity(path);
        return identity?.key === expected.resourceKey
          && identity.semanticQualifier === expected.semanticQualifier;
      });
    if (paths.length === 0) {
      mismatches.push(`${expected.resourceId}:${expected.sourcePath}: compiled reference missing`);
      continue;
    }
    const errors: string[] = [];
    let matched = false;
    for (const path of paths) {
      const entry = index.find(path);
      if (!entry) {
        errors.push(`${path}: ZIP entry missing`);
        continue;
      }
      try {
        const compiled = await entry.async('nodebuffer');
        const fingerprint = fingerprintAndroidPng(compiled, false);
        if (fingerprint.width !== expected.width
          || fingerprint.height !== expected.height
          || fingerprint.sha256 !== expected.pixelFingerprint) {
          errors.push(`${path}: decoded pixels differ`);
          continue;
        }
        if (expected.ninePatch) {
          const actual = parseCompiledNinePatchPng(compiled);
          if (!expected.guides
            || !guidesWithinOnePixel(expected.guides, actual.guides, expected.width, expected.height)) {
            errors.push(`${path}: nine-patch guides differ`);
            continue;
          }
        }
        matched = true;
        break;
      } catch (error) {
        errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!matched) {
      mismatches.push(`${expected.resourceId}:${expected.sourcePath}: ${errors.join(' | ')}`);
    }
  }
  if (mismatches.length) {
    throw new Error(`Android APK 이미지 검증에 실패했습니다 (${mismatches.join('; ')}).`);
  }
}
```

Do not import `themeImport` from this module or from `androidStandaloneBuild`.

- [ ] **Step 5: Add a failing standalone write-order test**

In `src/io/androidStandaloneBuild.test.ts`, clone the setup used by `runs AAPT2, injects the runtime, signs, validates, and writes one final APK`. Pass one valid ordinary `AndroidImageExpectation`, but have the fake link step return `compiled-theme-metadata.apk.b64`, whose ARSC advertises the key while its ZIP intentionally lacks the PNG. Name the test:

```ts
it('stops before writing when an expected compiled image is absent', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'kakao-standalone-image-check-'));
  const buildDir = path.join(directory, 'source');
  const runtimeDir = path.join(directory, 'runtime');
  const outputPath = path.join(directory, 'must-not-exist.apk');
  for (const resourceRoot of ['res', 'theme', 'theme-adv']) {
    await mkdir(path.join(buildDir, 'src', 'main', resourceRoot), { recursive: true });
  }
  await writeFile(path.join(buildDir, 'src', 'main', 'AndroidManifest.xml'), '<manifest />');
  await mkdir(path.join(runtimeDir, 'bin', 'darwin'), { recursive: true });
  await writeFile(path.join(runtimeDir, 'bin', 'darwin', 'aapt2'), 'binary');
  await writeFile(path.join(runtimeDir, 'android.jar'), 'android');
  await writeFile(path.join(runtimeDir, 'classes.dex'), 'dex\n035\0runtime');
  const compiledFixture = Buffer.from(
    (await readFile(path.join(process.cwd(), 'src/io/fixtures/compiled-theme-metadata.apk.b64'), 'utf8'))
      .replace(/\s/g, ''),
    'base64',
  );
  const sourcePng = await readFile(path.join(
    process.cwd(),
    'public/sample/apeach/android/theme_background_image.png',
  ));
  const expectation = createAndroidImageExpectation(
    'main.background',
    'src/main/theme/drawable-xxhdpi/theme_background_image.png',
    sourcePng,
    false,
  )!;
  const run = vi.fn(async (_executable: string, args: string[]) => {
    if (args[0] === 'link') await writeFile(args[args.indexOf('-o') + 1], compiledFixture);
  });

  await expect(buildStandaloneAndroidApk({
    buildDir,
    outputPath,
    runtimeDir,
    identityPath: path.join(directory, 'identity.json'),
    packageName: 'com.example.standalonefixture',
    versionCode: 70_809,
    versionName: '7.8.9',
    expectedMetadata: { name: '독립 테마', appearance: 'dark' },
    expectedImages: [expectation],
    platform: 'darwin',
    run,
  })).rejects.toThrow('main.background');
  await expect(readFile(outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
});
```

Import `createAndroidImageExpectation` from `androidImageVerification`. Run just this test and record RED because the current build has no `expectedImages` validation.

- [ ] **Step 6: Integrate expectations into standalone build and Electron export**

Extend the build arguments:

```ts
expectedImages?: AndroidImageExpectation[];
```

Inspect metadata once and run both verification layers before writing the output:

```ts
const metadata = await inspectCompiledAndroidApk(signed);
verifyStandaloneAndroidMetadata(metadata, {
  packageName,
  versionName,
  ...expectedMetadata,
});
await verifyCompiledAndroidImages(signed, metadata, expectedImages ?? []);
await writeFile(outputPath, signed);
```

Change `replaceMappedAndroidImages` to return `AndroidImageExpectation[]`. After each successful `writeFile(targetPath, output)`, call:

```ts
const expectation = createAndroidImageExpectation(write.resourceId, write.path, output, write.ninePatch);
if (expectation) expectations.push(expectation);
```

Replace the current silent skip for an impossible compiled write with the tested helper. The web icon is outside the AAPT2 resource roots: replace it when its template file exists, but keep the old skip when that noncompiled file is absent.

```ts
const compiledIdentity = androidResourceIdentity(write.path);
if (!compiledIdentity && !target && !outputSize && !flexibleBubble) continue;
if (compiledIdentity) {
  assertAndroidImageOutputPossible({
    resourceId: write.resourceId,
    sourcePath: write.path,
    hasTemplate: Boolean(target),
    hasOutputSize: Boolean(outputSize),
    flexibleBubble,
  });
}
```

After writing any available web icon, `createAndroidImageExpectation` returns `undefined` for `src/main/ic_launcher-web.png`; `assertAndroidImageOutputPossible` itself returns `void`. Return every accumulated compiled expectation, assign the result in `exportAndroid`, and pass it to `buildStandaloneAndroidApk` as `expectedImages`.

```ts
const expectedImages = await replaceMappedAndroidImages(buildDir, project);
await buildStandaloneAndroidApk({
  buildDir,
  outputPath: verifiedApk,
  runtimeDir: templatePath('android-runtime'),
  identityPath: path.join(app.getPath('userData'), 'android-signing-identity.json'),
  packageName: identifier,
  versionCode: androidVersionCode(project.meta.version),
  versionName,
  expectedMetadata: {
    name: project.meta.name,
    appearance: project.meta.appearance,
    colors: project.colorValues.android,
  },
  platform: process.platform as 'darwin' | 'win32',
  expectedImages,
});
```

- [ ] **Step 7: Verify GREEN with unit and standalone build tests**

Run:

```bash
npm test -- src/io/androidArchiveResources.test.ts src/io/androidImageVerification.test.ts src/io/androidStandaloneBuild.test.ts
npm run typecheck
```

Expected: all selected tests PASS and typecheck exits 0.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/io/androidImageVerification.ts src/io/androidImageVerification.test.ts src/io/androidStandaloneBuild.ts src/io/androidStandaloneBuild.test.ts electron/main.ts
git commit -m "Verify compiled Android image content"
```

### Task 5: Prove real AAPT2 round-trip recovery

**Files:**
- Modify: `scripts/verify-standalone-android-export.ts`

**Interfaces:**
- Consumes: `inspectCompiledAndroidApk`, `createAndroidImageExpectation`, and `importAndroidThemeArchive`
- Produces diagnostic output fields: `images`, `colors`, and `verifiedImages`

- [ ] **Step 1: Record the current runtime verifier output**

Run the current script once before editing it:

```bash
npm run verify:android-runtime -- /tmp/bear-android-image-recovery-before.apk
```

Record its JSON fields in the task notes. It may pass: this task adds an integration proof for production behavior already developed RED-first in Tasks 1 through 4, rather than introducing another production branch.

- [ ] **Step 2: Extend runtime verification with importer and bubble invariants**

Make the script require these post-build invariants:

```ts
const metadata = await inspectCompiledAndroidApk(output);
if (!metadata.resourceFiles?.['drawable/theme_background_image']?.some((file) => file.endsWith('.png'))) {
  throw new Error('Compiled background image references are missing.');
}
const imported = await importAndroidThemeArchive(output, 'standalone-verification.apk', metadata);
const imageCount = Object.keys(imported.platformResources.android).length;
const colorCount = Object.keys(metadata.colors ?? {}).length;
if (imageCount !== 37) throw new Error(`Expected 37 imported Android images, got ${imageCount}.`);
if (colorCount !== 44) throw new Error(`Expected 44 compiled Android colors, got ${colorCount}.`);
const importedBackground = imported.platformResources.android['main.background'];
if (!importedBackground) throw new Error('Imported Android background image is missing.');
const importedBackgroundFingerprint = fingerprintAndroidPng(
  Buffer.from(importedBackground.dataUrl.split(',')[1], 'base64'),
  false,
);
if (importedBackgroundFingerprint.sha256 !== backgroundExpectation.pixelFingerprint) {
  throw new Error('Imported Android background pixels differ from the exported expectation.');
}
for (const resourceId of [
  'chat.bubble.me.first.normal',
  'chat.bubble.you.first.normal',
] as const) {
  const asset = imported.platformResources.android[resourceId];
  if (!asset?.dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error(`Expected compiled bubble recovery for ${resourceId}.`);
  }
}
```

Import `fingerprintAndroidPng` from `androidArchiveResources`. Before the build, change one ordinary PNG and retain one source nine-patch, then create `backgroundExpectation` and `bubbleExpectation` from their exact written buffers and pass `[backgroundExpectation, bubbleExpectation]` as `expectedImages`. Print the counts and expectation length in the final JSON.

- [ ] **Step 3: Complete the runtime script and verify the enhanced proof**

Use `PNG.sync.read` and `PNG.sync.write` to change a visible pixel in `src/main/theme/drawable-xxhdpi/theme_background_image.png`. Read `src/main/theme/drawable-xxhdpi/theme_chatroom_bubble_me_01_image.9.png` unchanged for the nine-patch expectation. Pass both records to `buildStandaloneAndroidApk`.

Run:

```bash
npm run verify:android-runtime -- /tmp/bear-android-image-recovery.apk
```

Expected: exit 0 with JSON containing `images: 37`, `colors: 44`, `verifiedImages: 2`, valid structure flags, and the output path.

- [ ] **Step 4: Run the complete Android-focused suite**

Run:

```bash
npm test -- src/io/androidArchiveResources.test.ts src/io/androidImageVerification.test.ts src/io/androidStandaloneBuild.test.ts src/io/themeImport.test.ts
npm run typecheck
npm run audit:theme
```

Expected: all selected tests PASS, typecheck exits 0, and the resource audit reports no missing required files.

- [ ] **Step 5: Commit Task 5**

```bash
git add scripts/verify-standalone-android-export.ts
git commit -m "Verify Android image export round trips"
```
