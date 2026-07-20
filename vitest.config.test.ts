import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import config from './vitest.config';

describe('Vitest configuration', () => {
  it('does not collect tests from nested Git worktrees', () => {
    expect(config).toMatchObject({
      test: {
        exclude: expect.arrayContaining(['**/.worktrees/**']),
      },
    });
  });

  it('defaults pure tests to Node', () => {
    expect(config).toMatchObject({
      test: {
        environment: 'node',
      },
    });
  });

  it('provides a non-mutating Prettier format check', () => {
    const packageJson = JSON.parse(readFileSync(
      path.join(process.cwd(), 'package.json'),
      'utf8',
    )) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.scripts['format:check']).toBe(
      'prettier --check package.json src/shared src/domain/android',
    );
    expect(packageJson.devDependencies.prettier).toBeDefined();
  });
});
