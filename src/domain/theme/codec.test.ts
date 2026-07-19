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

const partialFixture = resolve(
  'src/test/fixtures/projects/partial-schema-v1.ktstudio',
);
const flatResourcesFixture = resolve(
  'src/test/fixtures/projects/flat-resources-0.1.1.ktstudio',
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
    const project = parseThemeProject(source);

    expect(project.platformResources.ios['common.theme-icon']?.fileName)
      .toBe('theme-icon.png');
    expect(project.platformResources.android['common.theme-icon']?.fileName)
      .toBe('theme-icon.png');
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
