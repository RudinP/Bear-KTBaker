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
});
