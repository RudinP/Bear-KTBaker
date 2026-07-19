import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { SchemaV1ProjectEnvelope } from './migrations';

const migrationControl = vi.hoisted(() => ({
  failure: undefined as unknown,
}));

vi.mock('./migrations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./migrations')>();
  return {
    ...actual,
    migrateSchemaV1Project(source: SchemaV1ProjectEnvelope) {
      if (migrationControl.failure !== undefined) {
        throw migrationControl.failure;
      }
      return actual.migrateSchemaV1Project(source);
    },
  };
});

import { parseThemeProject, serializeThemeProject } from './codec';
import { ThemeProjectCodecFailure } from './codecFailure';
import { createDefaultTheme } from './defaults';

const partialFixture = resolve(
  'src/test/fixtures/projects/partial-schema-v1.ktstudio',
);
const flatResourcesFixture = resolve(
  'src/test/fixtures/projects/flat-resources-0.1.1.ktstudio',
);
const unknownPlatformResourcesFixture = resolve(
  'src/test/fixtures/projects/unknown-platform-resources.ktstudio',
);

describe('theme project codec', () => {
  it('repairs a partial schema-v1 file and preserves unknown fields across serialization', async () => {
    const source = await readFile(partialFixture, 'utf8');
    const first = parseThemeProject(source);
    const second = parseThemeProject(serializeThemeProject(first));

    expect(first.meta.name).toBe('예전 부분 프로젝트');
    expect(first.meta.author).toBe('');
    expect(first.schemaVersion).toBe(1);
    expect((first.colorValues as Record<string, unknown>).legacyDesktop)
      .toEqual({ legacyAccent: '#123456' });
    expect((first.screens.friends as unknown as Record<string, unknown>).legacyScreenField)
      .toEqual({ keep: 'screen' });
    expect(second).toEqual(first);
  });

  it('migrates flat 0.1.1 resources into both platform buckets', async () => {
    const source = await readFile(flatResourcesFixture, 'utf8');
    const first = parseThemeProject(source);
    const second = parseThemeProject(serializeThemeProject(first));
    const iosThemeIcon = second.platformResources.ios['common.theme-icon'];
    const androidThemeIcon = second.platformResources.android['common.theme-icon'];

    expect(second).toEqual(first);
    expect(iosThemeIcon?.fileName).toBe('theme-icon.png');
    expect(androidThemeIcon?.fileName).toBe('theme-icon.png');
    expect(iosThemeIcon).not.toBe(androidThemeIcon);
  });

  it('repairs every malformed known project field without exposing false runtime types', () => {
    const raw = createDefaultTheme('망가진 프로젝트') as unknown as Record<string, any>;
    raw.baseSample = 42;
    Object.assign(raw.meta, {
      name: 42,
      author: false,
      version: [],
      themeId: {},
      appearance: 'sepia',
      futureMeta: { keep: true },
    });
    Object.assign(raw.targets, { ios: 'yes', android: 1 });
    raw.resources = {
      invalid: { fileName: 7, dataUrl: true },
      repaired: {
        fileName: 'repaired.png',
        dataUrl: 'data:image/png;base64,cmVwYWlyZWQ=',
        width: 'wide',
        height: -1,
        sourceScale: Number.NaN,
        rawNinePatch: 'yes',
        userSelected: false,
        mirroredFromPlatform: 'desktop',
        futureAsset: { keep: true },
      },
    };
    raw.platformResources = {
      ios: {
        invalid: { fileName: null, dataUrl: [] },
      },
      android: 'not-a-record',
    };
    raw.colorValues = {
      ios: { valid: '#123456', invalid: 7 },
      android: ['not-a-record'],
    };
    raw.font = { family: 1, fileName: false, dataUrl: [] };
    for (const key of Object.keys(raw.colors)) raw.colors[key] = { invalid: key };
    for (const [index, screen] of Object.keys(raw.screens).entries()) {
      raw.screens[screen].background = index % 2 === 0
        ? { kind: 'color', color: 7 }
        : {
            kind: 'image',
            color: false,
            image: { fileName: 1, dataUrl: 2 },
          };
    }
    raw.chat.unreadColor = null;
    raw.chat.bubbles.me.normal = {
      color: 1,
      textColor: false,
      stretch: {
        stretch: { x: [0, 'bad'], y: 'bad' },
        content: { left: 0, top: 0, right: 1, bottom: Number.NaN },
      },
      stretchByPlatform: {
        ios: { stretch: null, content: null },
        android: 'bad',
      },
      guideEditedByPlatform: { ios: false, android: 'yes' },
      futureVariant: { keep: true },
    };
    raw.chat.bubbles.me.pressed = null;
    raw.chat.bubbles.me.grouped = [];
    raw.chat.bubbles.me.groupedPressed = 'bad';
    raw.chat.bubbles.you = false;

    const repaired = parseThemeProject(JSON.stringify(raw));
    const defaults = createDefaultTheme();

    expect(repaired.baseSample).toBeUndefined();
    expect(repaired.meta).toMatchObject({
      name: defaults.meta.name,
      author: defaults.meta.author,
      version: defaults.meta.version,
      appearance: defaults.meta.appearance,
      futureMeta: { keep: true },
    });
    expect(typeof repaired.meta.themeId).toBe('string');
    expect(repaired.targets).toEqual(defaults.targets);
    expect(repaired.resources.invalid).toBeUndefined();
    expect(repaired.resources.repaired).toEqual({
      fileName: 'repaired.png',
      dataUrl: 'data:image/png;base64,cmVwYWlyZWQ=',
      futureAsset: { keep: true },
    });
    expect(repaired.platformResources).toMatchObject({ ios: {}, android: {} });
    expect(repaired.colorValues.ios.valid).toBe('#123456');
    expect(repaired.colorValues.ios.invalid).toBeUndefined();
    expect(repaired.colorValues.android).toEqual(defaults.colorValues.android);
    expect(repaired.font).toBeUndefined();
    expect(repaired.colors).toEqual(defaults.colors);
    expect(repaired.screens).toEqual(defaults.screens);
    expect(repaired.chat.unreadColor).toBe(defaults.chat.unreadColor);
    expect(repaired.chat.bubbles.me.normal).toMatchObject({
      ...defaults.chat.bubbles.me.normal,
      futureVariant: { keep: true },
    });
    expect(repaired.chat.bubbles.me.normal.stretchByPlatform).toBeUndefined();
    expect(repaired.chat.bubbles.me.normal.guideEditedByPlatform).toBeUndefined();
    expect(repaired.chat.bubbles.me.pressed).toEqual(defaults.chat.bubbles.me.pressed);
    expect(repaired.chat.bubbles.me.grouped).toEqual(defaults.chat.bubbles.me.grouped);
    expect(repaired.chat.bubbles.me.groupedPressed)
      .toEqual(defaults.chat.bubbles.me.groupedPressed);
    expect(repaired.chat.bubbles.you).toEqual(defaults.chat.bubbles.you);
  });

  it('preserves unknown platform resource fields in their original locations across round trips', async () => {
    const source = await readFile(unknownPlatformResourcesFixture, 'utf8');
    const original = JSON.parse(source);
    const first = parseThemeProject(source);
    const firstSerialized = JSON.parse(serializeThemeProject(first));
    const second = parseThemeProject(JSON.stringify(firstSerialized));
    const secondSerialized = JSON.parse(serializeThemeProject(second));

    expect(firstSerialized.platformResources.legacyDesktop)
      .toEqual(original.platformResources.legacyDesktop);
    expect(Object.hasOwn(firstSerialized.platformResources, '__proto__'))
      .toBe(true);
    expect(firstSerialized.platformResources.__proto__)
      .toEqual(original.platformResources.__proto__);
    expect(Object.hasOwn(firstSerialized.platformResources.ios, '__proto__'))
      .toBe(true);
    expect(firstSerialized.platformResources.ios.__proto__)
      .toEqual(original.platformResources.ios.__proto__);
    expect(Object.hasOwn(firstSerialized.platformResources.android, '__proto__'))
      .toBe(true);
    expect(firstSerialized.platformResources.android.__proto__)
      .toEqual(original.platformResources.android.__proto__);
    expect(firstSerialized.platformResources.ios['future.ios.metadata'])
      .toEqual(original.platformResources.ios['future.ios.metadata']);
    expect(firstSerialized.platformResources.android['future.android.metadata'])
      .toEqual(original.platformResources.android['future.android.metadata']);
    expect(firstSerialized.platformResources.ios['main.background'])
      .toEqual(original.platformResources.ios['main.background']);
    expect(firstSerialized.platformResources.android['main.background'])
      .toEqual(original.platformResources.android['main.background']);
    expect(secondSerialized.platformResources).toEqual(firstSerialized.platformResources);
  });

  it.each([
    ['malformed JSON', '{"schema":'],
    ['unsupported envelope', '{"schema":"other","schemaVersion":1}'],
  ])('reports %s as an invalid-format failure', (_label, source) => {
    expect.assertions(2);
    try {
      parseThemeProject(source);
    } catch (error) {
      expect(error).toBeInstanceOf(ThemeProjectCodecFailure);
      expect((error as ThemeProjectCodecFailure).kind).toBe('invalid-format');
    }
  });

  it('wraps migration exceptions and retains their cause', () => {
    const cause = new Error('forced migration failure');
    migrationControl.failure = cause;

    try {
      expect(() => parseThemeProject(JSON.stringify({
        schema: 'kakao-theme-studio',
        schemaVersion: 1,
      }))).toThrow(
        expect.objectContaining({
          kind: 'migration',
          cause,
        }),
      );
    } finally {
      migrationControl.failure = undefined;
    }
  });
});
