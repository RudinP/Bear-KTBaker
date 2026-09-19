import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { prepareAndroidBuildWorkspace } from './workspace';

describe('Windows AAPT2 staging workspace', () => {
  it('copies Korean paths into an ASCII directory and only cleans its own staging directory', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'ktb-workspace-'));
    const source = path.join(root, '한글-원본');
    await mkdir(path.join(source, 'src/main/res'), { recursive: true });
    await writeFile(path.join(source, 'src/main/res/values.xml'), 'original resource');
    try {
      const workspace = await prepareAndroidBuildWorkspace(source, 'win32', [source, root]);
      expect(workspace.buildDir).not.toMatch(/[^\x00-\x7f]/);
      expect(workspace.buildDir).not.toBe(source);
      expect(await readFile(path.join(workspace.buildDir, 'src/main/res/values.xml'), 'utf8')).toBe('original resource');
      await writeFile(path.join(workspace.buildDir, 'src/main/res/values.xml'), 'compiled resource');
      await workspace.cleanup();
      await expect(readFile(path.join(workspace.buildDir, 'src/main/res/values.xml'))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(path.join(source, 'src/main/res/values.xml'), 'utf8')).toBe('original resource');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('tries another root after an unwritable or missing root and cleans up if copying fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'ktb-workspace-'));
    try {
      await expect(prepareAndroidBuildWorkspace(path.join(root, '없는-소스'), 'win32', [path.join(root, 'missing'), root]))
        .rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not fall back to an unsafe working directory when no ASCII root is available', async () => {
    await expect(prepareAndroidBuildWorkspace('/한글/source', 'win32', []))
      .rejects.toThrow('영문 임시 폴더');
  });

  it.each([['/한글/source', 'darwin'], ['/ascii/source', 'win32']] as const)(
    'leaves %s on %s in place', async (source, platform) => {
      const workspace = await prepareAndroidBuildWorkspace(source, platform, []);
      expect(workspace.buildDir).toBe(source);
      await workspace.cleanup();
    },
  );
});
