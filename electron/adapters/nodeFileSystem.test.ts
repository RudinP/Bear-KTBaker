import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeFileSystemPort } from './nodeFileSystem';

const node = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  mkdtemp: vi.fn(),
  rm: vi.fn(),
  tmpdir: vi.fn(),
  join: vi.fn(),
  dirname: vi.fn(),
  basename: vi.fn(),
  isAbsolute: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: node.readFile,
    writeFile: node.writeFile,
    copyFile: node.copyFile,
    mkdir: node.mkdir,
    mkdtemp: node.mkdtemp,
    rm: node.rm,
  },
  readFile: node.readFile,
  writeFile: node.writeFile,
  copyFile: node.copyFile,
  mkdir: node.mkdir,
  mkdtemp: node.mkdtemp,
  rm: node.rm,
}));

vi.mock('node:os', () => ({
  default: { tmpdir: node.tmpdir },
  tmpdir: node.tmpdir,
}));

vi.mock('node:path', () => ({
  default: {
    join: node.join,
    dirname: node.dirname,
    basename: node.basename,
    isAbsolute: node.isAbsolute,
  },
  join: node.join,
  dirname: node.dirname,
  basename: node.basename,
  isAbsolute: node.isAbsolute,
}));

describe('Node file-system adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    node.tmpdir.mockReturnValue('/system/tmp');
    node.join.mockImplementation((...parts: string[]) => parts.join('/'));
    node.dirname.mockReturnValue('/themes');
    node.basename.mockReturnValue('theme.ktstudio');
    node.isAbsolute.mockReturnValue(true);
  });

  it('returns null only when an optional file is missing', async () => {
    const missingPath = '/themes/missing.png';
    node.readFile.mockRejectedValueOnce(Object.assign(
      new Error('missing'),
      { code: 'ENOENT' },
    ));
    const { files } = createNodeFileSystemPort();

    await expect(files.readOptionalBytes(missingPath)).resolves.toBeNull();
  });

  it('preserves non-missing optional-read failures', async () => {
    const forbiddenPath = '/themes/forbidden.png';
    node.readFile.mockRejectedValueOnce(Object.assign(
      new Error('forbidden'),
      { code: 'EACCES' },
    ));
    const { files } = createNodeFileSystemPort();

    await expect(files.readOptionalBytes(forbiddenPath))
      .rejects.toMatchObject({ code: 'EACCES' });
  });

  it('reads text and bytes through byte-oriented boundaries', async () => {
    node.readFile
      .mockResolvedValueOnce('project text')
      .mockResolvedValueOnce(Buffer.from([1, 2, 3]))
      .mockResolvedValueOnce(Buffer.from([4, 5]));
    const { files } = createNodeFileSystemPort();

    await expect(files.readText('/themes/project.ktstudio'))
      .resolves.toBe('project text');
    await expect(files.readBytes('/themes/image.png'))
      .resolves.toEqual(new Uint8Array([1, 2, 3]));
    await expect(files.readOptionalBytes('/themes/optional.png'))
      .resolves.toEqual(new Uint8Array([4, 5]));
    expect(node.readFile).toHaveBeenNthCalledWith(
      1,
      '/themes/project.ktstudio',
      'utf8',
    );
  });

  it('forwards write, copy, and directory operations', async () => {
    const { files } = createNodeFileSystemPort();
    const bytes = new Uint8Array([7, 8]);

    await files.writeText('/themes/project.ktstudio', 'project text');
    await files.writeBytes('/themes/image.png', bytes);
    await files.copyFile('/themes/source', '/themes/destination');
    await files.ensureDirectory('/themes/output');

    expect(node.writeFile).toHaveBeenNthCalledWith(
      1,
      '/themes/project.ktstudio',
      'project text',
      'utf8',
    );
    expect(node.writeFile).toHaveBeenNthCalledWith(
      2,
      '/themes/image.png',
      bytes,
    );
    expect(node.copyFile).toHaveBeenCalledWith(
      '/themes/source',
      '/themes/destination',
    );
    expect(node.mkdir).toHaveBeenCalledWith('/themes/output', {
      recursive: true,
    });
  });

  it('creates a unique temporary directory below the system temp path', async () => {
    node.mkdtemp.mockResolvedValue('/system/tmp/ktbaker-android-unique');
    const { files } = createNodeFileSystemPort();

    await expect(files.createTemporaryDirectory('ktbaker-android-'))
      .resolves.toBe('/system/tmp/ktbaker-android-unique');
    expect(node.join).toHaveBeenCalledWith(
      '/system/tmp',
      'ktbaker-android-',
    );
    expect(node.mkdtemp).toHaveBeenCalledWith(
      '/system/tmp/ktbaker-android-',
    );
  });

  it('removes directories recursively and forcibly', async () => {
    const { files } = createNodeFileSystemPort();

    await files.removeDirectory('/system/tmp/ktbaker-android-unique');

    expect(node.rm).toHaveBeenCalledWith(
      '/system/tmp/ktbaker-android-unique',
      { recursive: true, force: true },
    );
  });

  it('delegates path operations to Node path', () => {
    const { paths } = createNodeFileSystemPort();

    expect(paths.join('/themes', 'image.png')).toBe('/themes/image.png');
    expect(paths.dirname('/themes/theme.ktstudio')).toBe('/themes');
    expect(paths.basename('/themes/theme.ktstudio')).toBe('theme.ktstudio');
    expect(paths.isAbsolute('/themes/theme.ktstudio')).toBe(true);
  });
});
