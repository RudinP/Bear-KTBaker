# Legacy Project Image Migration and 0.1.2 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover every unambiguous image from schema-v1 project files, keep explicit iOS and Android values authoritative, make ThemeSettings safe for incomplete raw objects, and ship the combined Android and legacy fixes as version 0.1.2.

**Architecture:** Capture all legacy image candidates before parser defaults alter the source shape. Normalize only valid images into platform-owned resource buckets according to slot support and a state-aware flat-resource table, while leaving legacy fields available for compatibility. Keep the renderer and exporter dependent on normalized `platformResources`, then guard ThemeSettings at its raw-object boundary.

**Tech Stack:** TypeScript, React 19, Testing Library, Vitest, Electron Builder, npm.

## Global Constraints

- Execute this plan after `2026-07-16-android-apk-image-recovery.md` on the same isolated feature branch.
- The approved spec and both ignored plan files are force-added and committed before the implementation branch is created, so they remain in the final remote delta.
- Every production behavior change begins with a failing regression test and a recorded RED result.
- Current valid `platformResources.<platform>[resourceId]` values always win.
- `resources` remains compatibility data and does not become a renderer or exporter fallback.
- Only slots whose platform binding has at least one output file receive migrated images.
- Sent and received bubbles use one mapping helper and differ only by side.
- Unknown legacy fields remain in the parsed object; invalid image placeholders are excluded from normalized platform buckets.
- The only version bump for the final push is `0.1.1` to `0.1.2`, after all behavior tests are green.
- Build `release/`, `dist/`, and `dist-electron/` artifacts locally but never commit them.
- Never stage signing credentials, user exports, or files outside the reviewed source, test, documentation, and package-version set.

---

### Task 1: Capture valid current, shared, nested, and inline image candidates

**Files:**
- Create: `src/domain/legacyProjectImages.ts`
- Create: `src/test/fixtures/legacyThemeProjects.ts`
- Modify: `src/domain/theme.test.ts`
- Read: `src/manifest/kakaoResources.ts`

**Interfaces:**
- Produces: `LegacyImageMap`
- Produces: `LegacyProjectImageCandidates`
- Produces: `isUsableImageAsset(value)`
- Produces: `collectLegacyProjectImageCandidates(source)`
- Fixture helpers return raw schema-v1 objects rather than `ThemeProject`, so tests exercise genuinely missing fields.

- [ ] **Step 1: Add raw legacy fixture builders**

Create `src/test/fixtures/legacyThemeProjects.ts`. Do not call `createDefaultTheme`; that would silently add the current fields under test.

```ts
import type { ImageAsset, Platform } from '../../domain/theme';

export function legacyAsset(name: string, overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    fileName: `${name}.png`,
    dataUrl: `data:image/png;base64,${Buffer.from(name).toString('base64')}`,
    width: 30,
    height: 30,
    ...overrides,
  };
}

function baseLegacyProject(name: string) {
  return {
    schema: 'kakao-theme-studio',
    schemaVersion: 1,
    meta: { name },
  };
}

export function flatResourcesV1Fixture(
  platformResources?: Partial<Record<Platform, Record<string, unknown>>>,
) {
  return {
    ...baseLegacyProject('flat-v1'),
    resources: {
      'common.theme-icon': legacyAsset('shared-theme-icon'),
      'main.background': legacyAsset('shared-main-background'),
    },
    ...(platformResources === undefined ? {} : { platformResources }),
  };
}

export function nestedAssetsV1Fixture() {
  const icons = Object.fromEntries(
    ['friends', 'chats', 'now', 'shopping', 'more', 'call'].map((tab) => [tab, {
      normal: legacyAsset(`${tab}-normal`),
      selected: legacyAsset(`${tab}-selected`),
    }]),
  );
  return {
    ...baseLegacyProject('nested-v1'),
    assets: {
      themeIcon: legacyAsset('theme-icon'),
      tabBar: { background: legacyAsset('tab-background'), icons },
      profile: legacyAsset('profile'),
      profileFull: legacyAsset('profile-full'),
      addFriendButton: legacyAsset('add-friend'),
      splash: legacyAsset('nested-splash'),
      passcode: {
        bullets: {
          normal: Array.from({ length: 4 }, (_, index) => legacyAsset(`bullet-${index + 1}-normal`)),
          selected: Array.from({ length: 4 }, (_, index) => legacyAsset(`bullet-${index + 1}-selected`)),
        },
        keypadPressed: legacyAsset('keypad-pressed'),
      },
    },
  };
}

export function inlineImagesV1Fixture(options: {
  equalMainBackgrounds?: boolean;
  conflictSplash?: boolean;
} = {}) {
  const sharedMain = legacyAsset('shared-inline-main');
  const screenImage = (screen: string) => options.equalMainBackgrounds
    ? { ...sharedMain, fileName: `inline-${screen}.png` }
    : legacyAsset(`inline-${screen}`);
  const bubble = (side: 'me' | 'you', variant: string) => ({
    color: '#FFFFFF',
    textColor: '#000000',
    image: legacyAsset(`${side}-${variant}`),
  });
  return {
    ...baseLegacyProject('inline-v1'),
    ...(options.conflictSplash ? { assets: { splash: legacyAsset('nested-splash') } } : {}),
    screens: {
      friends: { background: { kind: 'image', color: '#FFFFFF', image: screenImage('friends') } },
      chats: { background: { kind: 'image', color: '#FFFFFF', image: screenImage('chats') } },
      now: { background: { kind: 'image', color: '#FFFFFF', image: screenImage('now') } },
      more: { background: { kind: 'image', color: '#FFFFFF', image: screenImage('more') } },
      chatroom: { background: { kind: 'image', color: '#FFFFFF', image: legacyAsset('inline-chat') } },
      passcode: { background: { kind: 'image', color: '#FFFFFF', image: legacyAsset('inline-passcode') } },
      splash: { background: { kind: 'image', color: '#FFFFFF', image: legacyAsset('inline-splash') } },
    },
    chat: {
      bubbles: Object.fromEntries(['me', 'you'].map((side) => [side, Object.fromEntries(
        ['normal', 'pressed', 'grouped', 'groupedPressed']
          .map((variant) => [variant, bubble(side as 'me' | 'you', variant)]),
      )])),
      unreadColor: '#FF0000',
    },
  };
}
```

- [ ] **Step 2: Write failing candidate-capture tests**

Add a new `describe('legacy schema-v1 image migration', ...)` block to `src/domain/theme.test.ts`. Import `collectLegacyProjectImageCandidates`, `isUsableImageAsset`, and the fixture helpers. Begin with tests that do not call `parseThemeProject`:

```ts
it('accepts only image assets with non-empty file names and data URLs', () => {
  expect(isUsableImageAsset(legacyAsset('valid'))).toBe(true);
  expect(isUsableImageAsset({ fileName: '', dataUrl: 'data:image/png;base64,eA==' })).toBe(false);
  expect(isUsableImageAsset({ fileName: 'x.png', dataUrl: '  ' })).toBe(false);
  expect(isUsableImageAsset({})).toBe(false);
});

it('captures current, shared, nested, and inline candidates before defaults are applied', () => {
  const raw = inlineImagesV1Fixture({ equalMainBackgrounds: true, conflictSplash: true });
  Object.assign(raw, {
    resources: { 'common.theme-icon': legacyAsset('shared-icon') },
    platformResources: {
      ios: { 'common.theme-icon': legacyAsset('ios-icon'), invalid: {} },
    },
  });
  const candidates = collectLegacyProjectImageCandidates(raw);
  expect(candidates.currentPlatformResources.ios['common.theme-icon']?.fileName).toBe('ios-icon.png');
  expect(candidates.currentPlatformResources.ios.invalid).toBeUndefined();
  expect(candidates.currentPlatformResources.android).toEqual({});
  expect(candidates.sharedResources['common.theme-icon']?.fileName).toBe('shared-icon.png');
  expect(candidates.nestedAssets['splash.image']?.fileName).toBe('nested-splash.png');
  expect(candidates.inlineAssets['splash.image']).toBeUndefined();
  expect(candidates.inlineAssets['main.background']?.fileName).toBe('inline-friends.png');
  expect(candidates.inlineAssets['main.background']?.dataUrl).toBe(legacyAsset('shared-inline-main').dataUrl);
  expect(candidates.inlineAssets['chat.bubble.me.first.normal']).toBeDefined();
  expect(candidates.inlineAssets['chat.bubble.you.grouped.pressed']).toBeDefined();
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
npm test -- src/domain/theme.test.ts -t "accepts only image assets|captures current, shared, nested, and inline"
```

Expected: FAIL because `legacyProjectImages.ts` does not exist.

- [ ] **Step 4: Implement validation, safe object access, and candidate collection**

Create `src/domain/legacyProjectImages.ts` with these public shapes and private primitives:

```ts
import { KAKAO_RESOURCE_SLOTS } from '../manifest/kakaoResources';
import type { ImageAsset, Platform, ThemeProject } from './theme';

export type LegacyImageMap = Record<string, ImageAsset>;

export interface LegacyProjectImageCandidates {
  currentPlatformResources: Record<Platform, LegacyImageMap>;
  sharedResources: LegacyImageMap;
  nestedAssets: LegacyImageMap;
  inlineAssets: LegacyImageMap;
}

type UnknownRecord = Record<string, unknown>;
const platforms = ['ios', 'android'] as const;

function record(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

function child(value: unknown, key: string) {
  return record(value)?.[key];
}

export function isUsableImageAsset(value: unknown): value is ImageAsset {
  const candidate = record(value);
  return typeof candidate?.fileName === 'string'
    && candidate.fileName.trim().length > 0
    && typeof candidate.dataUrl === 'string'
    && candidate.dataUrl.trim().length > 0;
}

function validAssetMap(value: unknown): LegacyImageMap {
  return Object.fromEntries(Object.entries(record(value) ?? {})
    .filter((entry): entry is [string, ImageAsset] => isUsableImageAsset(entry[1]))
    .map(([id, asset]) => [id, { ...asset }]));
}

function setCandidate(target: LegacyImageMap, id: string, value: unknown) {
  if (target[id] === undefined && isUsableImageAsset(value)) target[id] = { ...value };
}
```

Collect nested values with one table-driven helper. Restrict tab keys exactly to the old supported set:

```ts
const legacyTabs = ['friends', 'chats', 'now', 'shopping', 'more'] as const;
const bubbleVariants = {
  normal: 'first.normal',
  pressed: 'first.pressed',
  grouped: 'grouped.normal',
  groupedPressed: 'grouped.pressed',
} as const;
```

Map the nested fields exactly as follows. Do not collect `call`, arbitrary object keys, or array elements after index 3:

```ts
const assets = child(source, 'assets');
setCandidate(nestedAssets, 'common.theme-icon', child(assets, 'themeIcon'));
setCandidate(nestedAssets, 'main.tab.background', child(child(assets, 'tabBar'), 'background'));
setCandidate(nestedAssets, 'main.profile.01', child(assets, 'profile'));
setCandidate(nestedAssets, 'main.profile.01.full', child(assets, 'profileFull'));
setCandidate(nestedAssets, 'main.add-friend.normal', child(assets, 'addFriendButton'));
setCandidate(nestedAssets, 'splash.image', child(assets, 'splash'));
for (const tab of legacyTabs) {
  for (const state of ['normal', 'selected'] as const) {
    setCandidate(
      nestedAssets,
      `main.tab.${tab}.${state}`,
      child(child(child(child(assets, 'tabBar'), 'icons'), tab), state),
    );
  }
}
for (const state of ['normal', 'selected'] as const) {
  const bullets = child(child(child(assets, 'passcode'), 'bullets'), state);
  if (!Array.isArray(bullets)) continue;
  for (let index = 0; index < 4; index += 1) {
    setCandidate(nestedAssets, `passcode.bullet.${index + 1}.${state}`, bullets[index]);
  }
}
setCandidate(
  nestedAssets,
  'passcode.keypad.pressed',
  child(child(assets, 'passcode'), 'keypadPressed'),
);
```

Collect inline backgrounds from `screens.<screen>.background.image`. Assign `chat.background` and `passcode.background` directly. Assign inline `splash.image` only when the valid nested candidate is absent. Assign `main.background` only when all four `friends`, `chats`, `now`, and `more` images are valid and have the same `dataUrl`; legacy screen-specific file names may differ even when the encoded image data is identical:

```ts
function screenImage(source: unknown, screen: string) {
  return child(child(child(child(source, 'screens'), screen), 'background'), 'image');
}

function sameCandidateImageData(left: ImageAsset, right: ImageAsset) {
  return left.dataUrl === right.dataUrl;
}

setCandidate(inlineAssets, 'chat.background', screenImage(source, 'chatroom'));
setCandidate(inlineAssets, 'passcode.background', screenImage(source, 'passcode'));
if (!nestedAssets['splash.image']) {
  setCandidate(inlineAssets, 'splash.image', screenImage(source, 'splash'));
}
const mainImages = ['friends', 'chats', 'now', 'more']
  .map((screen) => screenImage(source, screen))
  .filter(isUsableImageAsset);
if (mainImages.length === 4
  && mainImages.slice(1).every((image) => sameCandidateImageData(mainImages[0], image))) {
  setCandidate(inlineAssets, 'main.background', mainImages[0]);
}
```

Use the same loop for both bubble sides:

```ts
for (const side of ['me', 'you'] as const) {
  for (const [legacyVariant, currentVariant] of Object.entries(bubbleVariants)) {
    const appearance = child(
      child(child(child(source, 'chat'), 'bubbles'), side),
      legacyVariant,
    );
    setCandidate(
      inlineAssets,
      `chat.bubble.${side}.${currentVariant}`,
      child(appearance, 'image'),
    );
  }
}
```

Return candidates without changing `source`:

```ts
return {
  currentPlatformResources: {
    ios: validAssetMap(child(child(source, 'platformResources'), 'ios')),
    android: validAssetMap(child(child(source, 'platformResources'), 'android')),
  },
  sharedResources: validAssetMap(child(source, 'resources')),
  nestedAssets,
  inlineAssets,
};
```

Do not add or export `normalizeLegacyProjectImages` in Task 1. Task 2 introduces that function together with its first failing behavior test.

- [ ] **Step 5: Run the candidate tests and verify GREEN**

Run:

```bash
npm test -- src/domain/theme.test.ts -t "accepts only image assets|captures current, shared, nested, and inline"
npm run typecheck
```

Expected: both focused tests PASS and typecheck exits 0.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/domain/legacyProjectImages.ts src/test/fixtures/legacyThemeProjects.ts src/domain/theme.test.ts
git commit -m "Capture legacy project image candidates"
```

### Task 2: Normalize flat shared resources with state-aware platform rules

**Files:**
- Modify: `src/domain/legacyProjectImages.ts`
- Modify: `src/domain/theme.test.ts`

**Interfaces:**
- Produces: `normalizeLegacyProjectImages(project, candidates)`
- Preserves: existing valid platform assets without changing their provenance fields
- Uses: slot bindings from `KAKAO_RESOURCE_SLOTS` to prevent unsupported platform writes

- [ ] **Step 1: Add failing flat-resource state tests**

Import `resolveResourceAsset` from `src/manifest/resourceResolver.ts` and `getMappedResourceWrites` from `src/io/resourceWrites.ts`. Test all branches of the approved table. Use distinct resource IDs so one assertion failure identifies its rule:

```ts
it('recovers flat-only and 0.1.1 empty-bucket projects on both platforms', () => {
  for (const raw of [
    flatResourcesV1Fixture(),
    flatResourcesV1Fixture({ ios: {}, android: {} }),
  ]) {
    const restored = parseThemeProject(JSON.stringify(raw));
    for (const platform of ['ios', 'android'] as const) {
      expect(restored.platformResources[platform]['common.theme-icon']).toMatchObject({
        fileName: 'shared-theme-icon.png', userSelected: true,
      });
      expect(restored.platformResources[platform]['main.background']).toMatchObject({
        fileName: 'shared-main-background.png', userSelected: true,
      });
    }
    expect(restored.resources['common.theme-icon']?.fileName).toBe('shared-theme-icon.png');
    expect(restored.resources['main.background']?.fileName).toBe('shared-main-background.png');
  }
});

it('applies one-sided shared-resource rules without overwriting the existing platform', () => {
  const mirroredShared = legacyAsset('mirrored-shared');
  const selectedShared = legacyAsset('selected-shared');
  const sameShared = legacyAsset('same-shared');
  const ambiguousShared = legacyAsset('ambiguous-shared');
  const bothShared = legacyAsset('both-shared');
  const keypadShared = legacyAsset('keypad-shared');
  const raw = {
    schema: 'kakao-theme-studio', schemaVersion: 1, meta: { name: 'one-sided' },
    resources: {
      'main.background': mirroredShared,
      'chat.background': selectedShared,
      'passcode.background': sameShared,
      'common.theme-icon': ambiguousShared,
      'main.tab.background': bothShared,
      'passcode.keypad.pressed': keypadShared,
    },
    platformResources: { ios: {
      'main.background': { ...legacyAsset('android-mirror'), mirroredFromPlatform: 'android' },
      'chat.background': { ...legacyAsset('ios-selected'), userSelected: true },
      'passcode.background': { ...sameShared },
      'common.theme-icon': legacyAsset('unrelated-current'),
      'main.tab.background': legacyAsset('ios-tab-current'),
    }, android: {
      'main.tab.background': legacyAsset('android-tab-current'),
    } },
  };
  const restored = parseThemeProject(JSON.stringify(raw));
  expect(restored.platformResources.ios['main.background']?.fileName).toBe('android-mirror.png');
  expect(restored.platformResources.ios['main.background']?.mirroredFromPlatform).toBe('android');
  expect(restored.platformResources.android['main.background']?.fileName).toBe('mirrored-shared.png');
  expect(restored.platformResources.android['main.background']?.mirroredFromPlatform).toBeUndefined();
  expect(restored.platformResources.ios['chat.background']?.fileName).toBe('ios-selected.png');
  expect(restored.platformResources.ios['chat.background']?.userSelected).toBe(true);
  expect(restored.platformResources.android['chat.background']).toMatchObject({
    fileName: 'selected-shared.png', userSelected: true,
  });
  expect(restored.platformResources.android['passcode.background']).toMatchObject({
    fileName: 'same-shared.png', mirroredFromPlatform: 'ios',
  });
  expect(restored.platformResources.android['common.theme-icon']).toBeUndefined();
  expect(restored.platformResources.ios['main.tab.background']?.fileName).toBe('ios-tab-current.png');
  expect(restored.platformResources.android['main.tab.background']?.fileName).toBe('android-tab-current.png');
  expect(restored.platformResources.ios['passcode.keypad.pressed']).toMatchObject({
    fileName: 'keypad-shared.png', userSelected: true,
  });
  expect(restored.platformResources.android['passcode.keypad.pressed']).toBeUndefined();
});

it('marks a one-sided shared bubble mirror without quarantining its target', () => {
  const id = 'chat.bubble.me.first.normal';
  const shared = legacyAsset('chatroomBubbleSend01@3x', { sourceScale: 3 });
  const raw = {
    schema: 'kakao-theme-studio', schemaVersion: 1, meta: { name: 'mixed-bubble' },
    resources: { [id]: shared },
    platformResources: { ios: { [id]: { ...shared } } },
  };
  const restored = parseThemeProject(JSON.stringify(raw));
  expect(restored.platformResources.ios[id]?.mirroredFromPlatform).toBeUndefined();
  expect(restored.platformResources.android[id]).toMatchObject({
    fileName: 'chatroomBubbleSend01@3x.png', mirroredFromPlatform: 'ios',
  });
  expect(resolveResourceAsset(restored, 'android', id)).toBeDefined();
  expect(getMappedResourceWrites(restored, 'android'))
    .toEqual(expect.arrayContaining([expect.objectContaining({ resourceId: id })]));
  const reparsed = parseThemeProject(serializeThemeProject(restored));
  expect(reparsed.platformResources.android[id]?.mirroredFromPlatform).toBe('ios');
});
```

- [ ] **Step 2: Run flat migration tests and verify RED**

Run:

```bash
npm test -- src/domain/theme.test.ts -t "flat-only|one-sided shared-resource|one-sided shared bubble"
```

Expected: FAIL because `parseThemeProject` still leaves shared values in `resources` only.

- [ ] **Step 3: Implement provenance-safe cloning and the ordered flat rules**

Add these helpers to `legacyProjectImages.ts`:

```ts
function cleanLegacyProvenance(asset: ImageAsset): ImageAsset {
  const { userSelected: _userSelected, mirroredFromPlatform: _mirrored, ...value } = asset;
  return { ...value };
}

function selected(asset: ImageAsset): ImageAsset {
  return { ...cleanLegacyProvenance(asset), userSelected: true };
}

function mirrored(asset: ImageAsset, source: Platform): ImageAsset {
  return { ...cleanLegacyProvenance(asset), mirroredFromPlatform: source };
}

function sameAssetContent(left: ImageAsset, right: ImageAsset) {
  return left.fileName === right.fileName
    && left.dataUrl === right.dataUrl
    && left.width === right.width
    && left.height === right.height
    && left.sourceScale === right.sourceScale
    && left.rawNinePatch === right.rawNinePatch;
}

function supportedPlatforms(resourceId: string) {
  const slot = KAKAO_RESOURCE_SLOTS.find(({ id }) => id === resourceId);
  return platforms.filter((platform) => (slot?.[platform]?.files.length ?? 0) > 0);
}
```

Implement one flat helper in the exact rule order:

```ts
function normalizeSharedResource(
  project: ThemeProject,
  resourceId: string,
  shared: ImageAsset,
) {
  const supported = supportedPlatforms(resourceId);
  if (supported.length === 0) return;
  if (supported.length === 1) {
    const platform = supported[0];
    project.platformResources[platform][resourceId] ??= selected(shared);
    return;
  }

  const ios = project.platformResources.ios[resourceId];
  const android = project.platformResources.android[resourceId];
  if (!ios && !android) {
    project.platformResources.ios[resourceId] = selected(shared);
    project.platformResources.android[resourceId] = selected(shared);
    return;
  }
  if (ios && android) return;

  const source: Platform = ios ? 'ios' : 'android';
  const target: Platform = source === 'ios' ? 'android' : 'ios';
  const current = ios ?? android!;
  if (current.mirroredFromPlatform === target) {
    project.platformResources[target][resourceId] = cleanLegacyProvenance(shared);
    return;
  }
  if (current.userSelected) {
    project.platformResources[target][resourceId] = selected(shared);
    return;
  }
  if (sameAssetContent(current, shared)) {
    project.platformResources[target][resourceId] = mirrored(shared, source);
  }
}
```

Export the normalization function. Shared candidate presence blocks lower-priority fallback even when its one-sided relation is ambiguous:

```ts
export function normalizeLegacyProjectImages(
  project: ThemeProject,
  candidates: LegacyProjectImageCandidates,
) {
  for (const slot of KAKAO_RESOURCE_SLOTS) {
    const shared = candidates.sharedResources[slot.id];
    if (shared) normalizeSharedResource(project, slot.id, shared);
  }
  return project;
}
```

The parser is the only owner of installing `candidates.currentPlatformResources`. The public normalizer only fills empty slots on the `project` it receives; it must not reset buckets from an older snapshot and erase edits made by its caller.

- [ ] **Step 4: Wire only the flat phase into the parser**

In `src/domain/theme.ts`, import `collectLegacyProjectImageCandidates` and `normalizeLegacyProjectImages`. Capture candidates immediately after schema validation and before `createDefaultTheme` or any `??=` assignment:

```ts
const candidates = collectLegacyProjectImageCandidates(value);
const project = value as ThemeProject;
```

Keep the current parser repairs in place for this step. Replace the current platform bucket construction with the candidate buckets. Move the existing `migrateLegacyNowTabAssets(project)` call from above `colorValues` to the final lines before `return project`, and insert normalization immediately before it:

```ts
project.platformResources = {
  ios: { ...candidates.currentPlatformResources.ios },
  android: { ...candidates.currentPlatformResources.android },
};
```

After the existing loops that repair both bubble sides and all four variants, add:

```ts
normalizeLegacyProjectImages(project, candidates);
migrateLegacyNowTabAssets(project);
```

This position makes Piccoma migration see normalized flat resources without changing the current screen, chat, color, or guide repair logic.

- [ ] **Step 5: Run flat tests and verify GREEN**

Run:

```bash
npm test -- src/domain/theme.test.ts -t "flat-only|one-sided shared-resource|round-trips both platform resources"
npm run typecheck
```

Expected: selected tests PASS, both explicit current platform values round-trip unchanged, and typecheck exits 0.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/domain/legacyProjectImages.ts src/domain/theme.ts src/domain/theme.test.ts
git commit -m "Normalize shared legacy project images"
```

### Task 3: Migrate nested and inline images without overriding higher-priority values

**Files:**
- Modify: `src/domain/legacyProjectImages.ts`
- Modify: `src/domain/theme.ts`
- Modify: `src/domain/theme.test.ts`
- Modify: `src/test/fixtures/legacyThemeProjects.ts`

**Interfaces:**
- Extends: `normalizeLegacyProjectImages` with nested then inline fallback
- Hardens: `migrateLegacyNowTabAssets` against invalid placeholders
- Guarantees: parsing an already normalized project is idempotent

- [ ] **Step 1: Add failing nested, inline, priority, and idempotence tests**

Add these named tests to `src/domain/theme.test.ts`:

```ts
it('migrates every supported nested v1 asset to eligible platform slots', () => {
  const restored = parseThemeProject(JSON.stringify(nestedAssetsV1Fixture()));
  for (const platform of ['ios', 'android'] as const) {
    expect(restored.platformResources[platform]['common.theme-icon']).toMatchObject({
      fileName: 'theme-icon.png', userSelected: true,
    });
    expect(restored.platformResources[platform]['main.tab.background']).toMatchObject({
      fileName: 'tab-background.png', userSelected: true,
    });
    expect(restored.platformResources[platform]['main.profile.01']).toMatchObject({
      fileName: 'profile.png', userSelected: true,
    });
    expect(restored.platformResources[platform]['main.add-friend.normal']).toMatchObject({
      fileName: 'add-friend.png', userSelected: true,
    });
    for (const tab of ['friends', 'chats', 'now', 'shopping', 'more'] as const) {
      expect(restored.platformResources[platform][`main.tab.${tab}.normal`]?.fileName)
        .toBe(`${tab}-normal.png`);
      expect(restored.platformResources[platform][`main.tab.${tab}.normal`]?.userSelected).toBe(true);
      expect(restored.platformResources[platform][`main.tab.${tab}.selected`]?.fileName)
        .toBe(`${tab}-selected.png`);
    }
    for (let index = 1; index <= 4; index += 1) {
      expect(restored.platformResources[platform][`passcode.bullet.${index}.normal`]?.fileName)
        .toBe(`bullet-${index}-normal.png`);
      expect(restored.platformResources[platform][`passcode.bullet.${index}.normal`]?.userSelected)
        .toBe(true);
      expect(restored.platformResources[platform][`passcode.bullet.${index}.selected`]?.fileName)
        .toBe(`bullet-${index}-selected.png`);
    }
    expect(restored.platformResources[platform]['main.tab.call.normal']).toBeUndefined();
  }
  expect(restored.platformResources.android['main.profile.01.full']?.fileName).toBe('profile-full.png');
  expect(restored.platformResources.ios['main.profile.01.full']).toBeUndefined();
  expect(restored.platformResources.android['splash.image']?.fileName).toBe('nested-splash.png');
  expect(restored.platformResources.ios['splash.image']).toBeUndefined();
  expect(restored.platformResources.ios['passcode.keypad.pressed']?.fileName).toBe('keypad-pressed.png');
  expect(restored.platformResources.android['passcode.keypad.pressed']).toBeUndefined();
});

it('migrates sent and received inline bubble variants through the same mapping', () => {
  const restored = parseThemeProject(JSON.stringify(inlineImagesV1Fixture({ equalMainBackgrounds: true })));
  for (const side of ['me', 'you'] as const) {
    for (const [legacy, current] of [
      ['normal', 'first.normal'],
      ['pressed', 'first.pressed'],
      ['grouped', 'grouped.normal'],
      ['groupedPressed', 'grouped.pressed'],
    ] as const) {
      expect(restored.platformResources.ios[`chat.bubble.${side}.${current}`]?.fileName)
        .toBe(`${side}-${legacy}.png`);
      expect(restored.platformResources.ios[`chat.bubble.${side}.${current}`]?.userSelected)
        .toBe(true);
      if (current.endsWith('.pressed')) {
        expect(restored.platformResources.android[`chat.bubble.${side}.${current}`]).toBeUndefined();
      } else {
        expect(restored.platformResources.android[`chat.bubble.${side}.${current}`]?.fileName)
          .toBe(`${side}-${legacy}.png`);
        expect(restored.platformResources.android[`chat.bubble.${side}.${current}`]?.userSelected)
          .toBe(true);
      }
    }
  }
  for (const platform of ['ios', 'android'] as const) {
    expect(restored.platformResources[platform]['main.background']).toMatchObject({
      fileName: 'inline-friends.png', userSelected: true,
    });
    expect(restored.platformResources[platform]['chat.background']).toMatchObject({
      fileName: 'inline-chat.png', userSelected: true,
    });
    expect(restored.platformResources[platform]['passcode.background']).toMatchObject({
      fileName: 'inline-passcode.png', userSelected: true,
    });
  }
  expect(restored.platformResources.android['splash.image']).toMatchObject({
    fileName: 'inline-splash.png', userSelected: true,
  });
  expect(restored.platformResources.ios['splash.image']).toBeUndefined();
});
```

Add the exact remaining priority, stability, conflict, validation, and Piccoma cases:

```ts
it('keeps current platform assets ahead of shared nested and inline candidates', () => {
  const currentRaw = inlineImagesV1Fixture({ conflictSplash: true });
  Object.assign(currentRaw, {
    resources: { 'splash.image': legacyAsset('shared-splash') },
    platformResources: { android: { 'splash.image': legacyAsset('current-splash') } },
  });
  const current = parseThemeProject(JSON.stringify(currentRaw));
  expect(current.platformResources.android['splash.image']?.fileName).toBe('current-splash.png');

  const sharedRaw = inlineImagesV1Fixture({ conflictSplash: true });
  Object.assign(sharedRaw, { resources: { 'splash.image': legacyAsset('shared-splash') } });
  const shared = parseThemeProject(JSON.stringify(sharedRaw));
  expect(shared.platformResources.android['splash.image']?.fileName).toBe('shared-splash.png');

  const iconRaw = nestedAssetsV1Fixture();
  Object.assign(iconRaw, {
    resources: { 'common.theme-icon': legacyAsset('shared-icon') },
    platformResources: { ios: { 'common.theme-icon': legacyAsset('current-ios-icon') } },
  });
  const icon = parseThemeProject(JSON.stringify(iconRaw));
  expect(icon.platformResources.ios['common.theme-icon']?.fileName).toBe('current-ios-icon.png');
  expect(icon.platformResources.android['common.theme-icon']).toBeUndefined();
});

it('produces the same platform resources when a normalized project is parsed again', () => {
  const first = parseThemeProject(JSON.stringify(nestedAssetsV1Fixture()));
  const second = parseThemeProject(serializeThemeProject(first));
  expect(second.platformResources).toEqual(first.platformResources);
});

it('preserves conflicting splash images and does not merge unequal main backgrounds', () => {
  const restored = parseThemeProject(JSON.stringify(
    inlineImagesV1Fixture({ conflictSplash: true }),
  ));
  expect(restored.platformResources.android['splash.image']?.fileName).toBe('nested-splash.png');
  expect(restored.platformResources.ios['splash.image']).toBeUndefined();
  expect(restored.screens.splash.background).toMatchObject({
    kind: 'image', image: { fileName: 'inline-splash.png' },
  });
  expect(restored.platformResources.ios['main.background']).toBeUndefined();
  expect(restored.platformResources.android['main.background']).toBeUndefined();
});

it('drops invalid image placeholders and ignores unknown legacy tab keys', () => {
  const raw = nestedAssetsV1Fixture();
  Object.assign(raw, {
    legacyMystery: { keep: true },
    resources: {
      'common.theme-icon': {},
      'main.profile.02': { fileName: '', dataUrl: '' },
    },
    platformResources: {
      ios: { 'common.theme-icon': {}, 'main.profile.02': {} },
      android: { 'common.theme-icon': {}, 'main.profile.02': {} },
    },
  });
  const restored = parseThemeProject(JSON.stringify(raw));
  expect(restored.platformResources.ios['common.theme-icon']?.fileName).toBe('theme-icon.png');
  expect(restored.platformResources.android['common.theme-icon']?.fileName).toBe('theme-icon.png');
  expect((restored as unknown as Record<string, unknown>).legacyMystery).toEqual({ keep: true });
  expect(restored.resources['main.profile.02']).toEqual({ fileName: '', dataUrl: '' });
  expect(restored.platformResources.ios['main.profile.02']).toBeUndefined();
  expect(restored.platformResources.android['main.profile.02']).toBeUndefined();
  expect(getMappedResourceWrites(restored, 'ios').some(({ resourceId }) => resourceId === 'main.profile.02'))
    .toBe(false);
  expect(getMappedResourceWrites(restored, 'android').some(({ resourceId }) => resourceId === 'main.profile.02'))
    .toBe(false);
  expect((restored as unknown as { assets: { tabBar: { icons: Record<string, unknown> } } })
    .assets.tabBar.icons.call).toBeDefined();
  for (const platform of ['ios', 'android'] as const) {
    expect(restored.platformResources[platform]['main.tab.call.normal']).toBeUndefined();
    expect(restored.platformResources[platform]['main.tab.call.selected']).toBeUndefined();
  }
});

it('repairs a non-record resources field before normalization', () => {
  const raw = nestedAssetsV1Fixture();
  Object.assign(raw, { resources: [] });
  const restored = parseThemeProject(JSON.stringify(raw));
  expect(restored.resources).toEqual({});
  expect(restored.platformResources.android['common.theme-icon']?.fileName).toBe('theme-icon.png');
});

it('migrates flat Piccoma resources after platform normalization', () => {
  const raw = {
    schema: 'kakao-theme-studio',
    schemaVersion: 1,
    meta: { name: 'flat-piccoma' },
    resources: {
      'main.tab.now.normal': {},
      'main.tab.piccoma.normal': legacyAsset('piccoma-normal'),
    },
  };
  const restored = parseThemeProject(JSON.stringify(raw));
  for (const platform of ['ios', 'android'] as const) {
    expect(restored.platformResources[platform]['main.tab.now.normal']?.fileName)
      .toBe('piccoma-normal.png');
  }
  expect(restored.resources['main.tab.now.normal']?.fileName).toBe('piccoma-normal.png');
});
```

- [ ] **Step 2: Run the migration group and verify RED**

Run:

```bash
npm test -- src/domain/theme.test.ts -t "supported nested v1|sent and received inline|ahead of shared|conflicting splash|invalid image placeholders|non-record resources|flat Piccoma"
```

Expected: nested, inline, invalid-placeholder fallback, non-record resources, and invalid-Now Piccoma tests FAIL. The idempotence test is intentionally excluded from the RED selection and runs in Step 5 as a regression invariant.

- [ ] **Step 3: Add lower-priority fallback for supported platform bindings**

Extend the loop in `normalizeLegacyProjectImages` after the shared branch:

```ts
for (const slot of KAKAO_RESOURCE_SLOTS) {
  const shared = candidates.sharedResources[slot.id];
  if (shared) {
    normalizeSharedResource(project, slot.id, shared);
    continue;
  }
  const fallback = candidates.nestedAssets[slot.id] ?? candidates.inlineAssets[slot.id];
  if (!fallback) continue;
  for (const platform of supportedPlatforms(slot.id)) {
    project.platformResources[platform][slot.id] ??= selected(fallback);
  }
}
```

This order means a shared candidate that cannot safely fill a missing side still prevents a lower candidate from overriding its semantics.

- [ ] **Step 4: Repair all required parser structures before normalization**

Reorder `parseThemeProject` into this sequence without dropping its current compatibility behavior:

1. Parse JSON and validate `schema` plus `schemaVersion`.
2. Capture `LegacyProjectImageCandidates` from the untouched raw object.
3. Repair `meta`, `targets`, and `resources`; replace a non-record `resources` value with `{}` but preserve a record verbatim.
4. Install the validated `currentPlatformResources` buckets.
5. Repair `colorValues`, `colors`, every required screen, `chat`, both bubble sides, and every bubble variant.
6. Call `normalizeLegacyProjectImages(project, candidates)`.
7. Call `migrateLegacyNowTabAssets(project)`.
8. Return the project.

The normalization call must occur after bubble and screen repair because inline raw fields remain on the object, while candidate capture already preserved their original image values.

Import `isUsableImageAsset` and harden Piccoma selection:

```ts
export function migrateLegacyNowTabAssets(project: ThemeProject): ThemeProject {
  for (const state of ['normal', 'selected'] as const) {
    const currentId = `main.tab.now.${state}`;
    const legacyId = `main.tab.piccoma.${state}`;
    const sharedCurrent = isUsableImageAsset(project.resources[currentId])
      ? project.resources[currentId]
      : undefined;
    let firstFallback: ImageAsset | undefined;
    for (const platform of ['ios', 'android'] as const) {
      const current = project.platformResources[platform][currentId];
      if (isUsableImageAsset(current) || sharedCurrent) continue;
      const platformLegacy = project.platformResources[platform][legacyId];
      const sharedLegacy = project.resources[legacyId];
      const legacy = isUsableImageAsset(platformLegacy)
        ? platformLegacy
        : isUsableImageAsset(sharedLegacy) ? sharedLegacy : undefined;
      if (!legacy) continue;
      project.platformResources[platform][currentId] = { ...legacy };
      firstFallback ??= legacy;
    }
    if (!sharedCurrent && firstFallback) {
      project.resources[currentId] = { ...firstFallback };
    }
  }
  return project;
}
```

Do not delete the original invalid or unknown keys from the flat `resources` compatibility object. They must simply be unable to block migration.

Add `objectRecord` at module scope immediately before `parseThemeProject`. Then replace the parser body after the existing JSON/schema rejection block with the code beginning at `const candidates`:

```ts
function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

const candidates = collectLegacyProjectImageCandidates(value);
const project = value as ThemeProject;
const defaults = createDefaultTheme(
  typeof project.meta?.name === 'string' ? project.meta.name : '새 카카오톡 테마',
);
project.meta = {
  ...defaults.meta,
  ...(objectRecord(project.meta) ?? {}),
} as ThemeProject['meta'];
project.targets = {
  ...defaults.targets,
  ...(objectRecord(project.targets) ?? {}),
} as ThemeProject['targets'];
project.resources = (objectRecord(project.resources) ?? {}) as ThemeProject['resources'];
project.platformResources = {
  ios: { ...candidates.currentPlatformResources.ios },
  android: { ...candidates.currentPlatformResources.android },
};

const rawColorValues = objectRecord(project.colorValues);
project.colorValues = {
  ios: {
    ...defaults.colorValues.ios,
    ...(objectRecord(rawColorValues?.ios) ?? {}),
  },
  android: {
    ...defaults.colorValues.android,
    ...(objectRecord(rawColorValues?.android) ?? {}),
  },
} as ThemeProject['colorValues'];
project.colors = {
  ...defaults.colors,
  ...(objectRecord(project.colors) ?? {}),
} as ThemeProject['colors'];

const rawScreens = objectRecord(project.screens) ?? {};
project.screens = rawScreens as ThemeProject['screens'];
for (const screen of Object.keys(defaults.screens) as ScreenId[]) {
  const existing = objectRecord(rawScreens[screen]);
  if (objectRecord(existing?.background)) continue;
  const chatroom = objectRecord(rawScreens.chatroom);
  const chatroomBackground = objectRecord(chatroom?.background);
  project.screens[screen] = screen === 'notification' && chatroomBackground
    ? { background: structuredClone(chatroomBackground) as VisualFill }
    : structuredClone(defaults.screens[screen]);
}

const rawChat = objectRecord(project.chat) ?? {};
const rawBubbles = objectRecord(rawChat.bubbles) ?? {};
project.chat = {
  ...rawChat,
  bubbles: {} as ThemeProject['chat']['bubbles'],
  unreadColor: typeof rawChat.unreadColor === 'string'
    ? rawChat.unreadColor
    : defaults.chat.unreadColor,
} as ThemeProject['chat'];
for (const side of ['me', 'you'] as const) {
  const rawSet = objectRecord(rawBubbles[side]) ?? {};
  const repairedSet = {} as BubbleSet;
  for (const variant of ['normal', 'pressed', 'grouped', 'groupedPressed'] as const) {
    const fallback = defaults.chat.bubbles[side][variant];
    const appearance = {
      ...structuredClone(fallback),
      ...(objectRecord(rawSet[variant]) ?? {}),
    } as BubbleAppearance;
    if (typeof appearance.color !== 'string') appearance.color = fallback.color;
    if (typeof appearance.textColor !== 'string') appearance.textColor = fallback.textColor;
    if (!objectRecord(appearance.stretch)) appearance.stretch = cloneGuides();
    repairedSet[variant] = appearance;
  }
  project.chat.bubbles[side] = repairedSet;
}

normalizeLegacyProjectImages(project, candidates);
migrateLegacyNowTabAssets(project);
return project;
```

- [ ] **Step 5: Run domain migration and compatibility tests**

Run:

```bash
npm test -- src/domain/theme.test.ts src/io/resourceWrites.test.ts src/manifest/resourceResolver.test.ts
npm run typecheck
```

Expected: all selected tests PASS, including existing platform round trips and legacy mirrored-bubble quarantine.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/domain/legacyProjectImages.ts src/domain/theme.ts src/domain/theme.test.ts src/test/fixtures/legacyThemeProjects.ts
git commit -m "Migrate nested and inline legacy images"
```

### Task 4: Make ThemeSettings safe for incomplete raw platform buckets

**Files:**
- Modify: `src/components/ThemeSettings.tsx:10-30`
- Modify: `src/components/ThemeSettings.test.tsx`

**Interfaces:**
- Reads: `project.platformResources?.[platform] ?? {}`
- Writes: a complete `{ ios, android }` shape while preserving both existing buckets
- Does not replace parser migration with a component-level fallback

- [ ] **Step 1: Add failing raw-object rendering and write-preservation tests**

Add `parseThemeProject`, `type ThemeProject`, and `flatResourcesV1Fixture` to the test imports. Use a data URL so the migrated preview can be inspected without loading an external asset:

```ts
it('renders the migrated legacy theme icon instead of the sample icon', () => {
  const raw = flatResourcesV1Fixture();
  Object.assign(raw, { baseSample: 'apeach' });
  const project = parseThemeProject(JSON.stringify(raw));
  const { container } = render(<ThemeSettings project={project} platform="android" onProject={vi.fn()} />);
  expect(container.querySelector('.app-icon-preview')).toHaveStyle({
    backgroundImage: `url(${project.platformResources.android['common.theme-icon'].dataUrl})`,
  });
});

it('renders a raw project without platformResources without crashing', () => {
  const project = createDefaultTheme();
  delete (project as Partial<ThemeProject>).platformResources;
  expect(() => render(
    <ThemeSettings project={project} platform="android" onProject={vi.fn()} />,
  )).not.toThrow();
});

it('initializes a missing platform bucket while preserving the other platform', async () => {
  const project = createDefaultTheme();
  const iosIcon = { fileName: 'ios.png', dataUrl: 'data:image/png;base64,aW9z', userSelected: true as const };
  project.platformResources = { ios: { 'common.theme-icon': iosIcon } } as typeof project.platformResources;
  const onProject = vi.fn();
  render(<ThemeSettings project={project} platform="android" onProject={onProject} />);
  fireEvent.change(screen.getByLabelText('Android 기본 앱 아이콘 이미지'), {
    target: { files: [new File(['android'], 'android.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(onProject).toHaveBeenCalled());
  const updated = onProject.mock.calls.at(-1)?.[0];
  expect(updated.platformResources.ios['common.theme-icon']).toEqual(iosIcon);
  expect(updated.platformResources.android['common.theme-icon']).toMatchObject({
    fileName: 'android.png', userSelected: true,
  });
});
```

If jsdom serializes `backgroundImage` differently, compare the element's `style.backgroundImage` to `url("...")` after observing the actual RED output; do not weaken the assertion to mere element presence.

- [ ] **Step 2: Run ThemeSettings tests and verify RED**

Run:

```bash
npm test -- src/components/ThemeSettings.test.tsx -t "without platformResources|missing platform bucket"
```

Expected: both selected raw-object tests FAIL on direct indexing. The migrated-icon preview is intentionally excluded from RED because Task 3 already makes it pass; Step 4 runs it as a regression assertion.

- [ ] **Step 3: Add optional reads and a complete two-bucket write**

Change `setPlatformResource` to build both buckets explicitly:

```ts
const setPlatformResource = (resourceId: string, asset: ImageAsset) => {
  const current = {
    ios: project.platformResources?.ios ?? {},
    android: project.platformResources?.android ?? {},
  };
  onProject({
    ...project,
    platformResources: {
      ios: { ...current.ios },
      android: { ...current.android },
      [platform]: { ...current[platform], [resourceId]: asset },
    },
  });
};
```

Change the icon read to:

```ts
const resources = project.platformResources?.[platform] ?? {};
const icon = resources[resourceId]?.dataUrl
  ?? resolveResourceUrl(project, platform, resourceId);
```

No other component should start reading shared `project.resources` as part of this task.

- [ ] **Step 4: Run UI and domain tests and verify GREEN**

Run:

```bash
npm test -- src/components/ThemeSettings.test.tsx src/domain/theme.test.ts
npm run typecheck
```

Expected: both files PASS and typecheck exits 0.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/components/ThemeSettings.tsx src/components/ThemeSettings.test.tsx
git commit -m "Guard legacy theme settings resources"
```

### Task 5: Verify, version, package, and publish 0.1.2 once

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Inspect only: `release/`, `dist/`, `dist-electron/`
- Inspect only: the complete Git diff and commit range

**Interfaces:**
- Consumes: all five Android tasks and the first four tasks in this plan
- Produces: matching root package versions `0.1.2`
- Produces locally: current macOS and Windows installer artifacts
- Produces remotely: exactly one final push containing the `0.1.2` source history

- [ ] **Step 1: Run all focused regression suites before changing the package version**

Run:

```bash
npm test -- src/io/androidArchiveResources.test.ts src/io/androidImageVerification.test.ts src/io/androidStandaloneBuild.test.ts src/io/themeImport.test.ts src/domain/theme.test.ts src/components/ThemeSettings.test.tsx src/io/resourceWrites.test.ts src/manifest/resourceResolver.test.ts
npm run typecheck
npm run audit:theme
npm run verify:android-runtime -- /tmp/bear-0.1.2-prepackage.apk
```

Expected: every test passes, typecheck exits 0, the resource audit has no missing required files, and runtime verification reports 37 restored Android images, 44 colors, and 2 verified image expectations.

- [ ] **Step 2: Run the complete application verification**

Run:

```bash
npm test
npm run verify
```

Expected: full Vitest, build, Android chatroom visual, and promotion export checks all exit 0. Inspect generated visual reports when a command reports a changed screenshot; do not approve a visual mismatch from exit status alone.

- [ ] **Step 3: Confirm the remote base and bump the package version exactly once**

Refresh the remote-tracking branch and confirm its root package version is still `0.1.1`:

```bash
git fetch origin main
git show origin/main:package.json | node -e "let value='';process.stdin.on('data',chunk=>value+=chunk).on('end',()=>{if(JSON.parse(value).version!=='0.1.1')process.exit(1)})"
```

If this check fails, stop before editing either package file because the required patch version must be recalculated from the new remote state. When it passes, run:

```bash
npm version 0.1.2 --no-git-tag-version
node -e "const p=require('./package.json');const l=require('./package-lock.json');if(p.version!=='0.1.2'||l.version!=='0.1.2'||l.packages[''].version!=='0.1.2')process.exit(1)"
```

Expected: only `package.json` and the root version fields in `package-lock.json` change. Do not create a Git tag.

- [ ] **Step 4: Build both installer families from the verified version**

Run:

```bash
npm run package:mac
npm run package:win
```

Expected: both commands exit 0 and current artifacts appear under `release/`. Record artifact names, sizes, and SHA-256 values with:

```bash
find release -maxdepth 2 -type f \( -name '*.dmg' -o -name '*.exe' -o -name '*.zip' \) -print0 | xargs -0 shasum -a 256
```

After confirming the `0.1.2` DMG, macOS ZIP, and Windows installer exist and have hashes, remove only the superseded top-level `0.1.1` installers and their blockmaps that are currently present:

```bash
rm -- \
  'release/Bear KTBaker Setup 0.1.1.exe' \
  'release/Bear KTBaker Setup 0.1.1.exe.blockmap' \
  'release/Bear KTBaker-0.1.1-universal-mac.zip' \
  'release/Bear KTBaker-0.1.1-universal-mac.zip.blockmap' \
  'release/Bear KTBaker-0.1.1-universal.dmg' \
  'release/Bear KTBaker-0.1.1-universal.dmg.blockmap'
```

Run the artifact listing again and confirm no top-level `0.1.1` installer remains. Do not stage any artifact.

- [ ] **Step 5: Perform a completion and sensitive-file review**

Use `superpowers:verification-before-completion`, then run fresh:

```bash
git status --short --ignored
git diff --check
git diff -- package.json package-lock.json
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
git ls-files release dist dist-electron
git diff --name-only origin/main...HEAD | rg '(\.env|\.jks|\.keystore|\.p12|\.pfx|\.pem|\.key|local\.properties|key\.properties)$' && exit 1 || true
```

Expected:

- `git diff --check` is silent.
- `git ls-files release dist dist-electron` is silent.
- No credential or local environment file appears in the commit range.
- The reviewed diff contains only the approved Android recovery, legacy migration, tests, plans, and version fields.

- [ ] **Step 6: Commit the version-only change**

```bash
git add package.json package-lock.json
git commit -m "Release version 0.1.2"
```

Do not amend earlier behavior commits and do not create a tag.

- [ ] **Step 7: Merge the isolated branch and push once**

Return to the primary checkout. The implementation branch name is `fix/android-image-recovery-0.1.2`. Confirm `main` has no tracked edits, refresh the remote state, and refuse integration if the implementation branch does not contain the current remote tip:

```bash
git status --short
git fetch origin main
git merge-base --is-ancestor origin/main fix/android-image-recovery-0.1.2
git merge --ff-only fix/android-image-recovery-0.1.2
git status --short
node -e "const p=require('./package.json');const l=require('./package-lock.json');if(p.version!=='0.1.2'||l.version!=='0.1.2'||l.packages[''].version!=='0.1.2')process.exit(1)"
git merge-base --is-ancestor origin/main HEAD
git diff --check origin/main...HEAD
git push origin HEAD:main
```

Expected: both ancestry checks and the fast-forward merge exit 0, the primary worktree is clean, `HEAD` contains matching `0.1.2` versions, and the remote advances from `0.1.1` to `0.1.2` in one push. If either ancestry check or the fast-forward merge fails, stop without pushing. Report the pushed commit, installer artifact names and hashes, and every verification command actually run.
