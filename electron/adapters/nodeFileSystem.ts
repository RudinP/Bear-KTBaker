import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import type {
  FileSystemPort,
  PathPort,
} from '../../src/application/ports/fileSystem';

const NON_ASCII_PATTERN = /[^\x00-\x7f]/;

// Some Windows-only command-line tools (bundled aapt2 among them) mishandle
// non-ASCII characters in absolute paths built from %TEMP%, which is
// user-specific and often contains the Windows account name. When that
// happens, prefer an ASCII machine-wide temp root instead of the user's.
function preferredTemporaryRoot(): string {
  const defaultRoot = tmpdir();
  if (process.platform !== 'win32' || !NON_ASCII_PATTERN.test(defaultRoot)) {
    return defaultRoot;
  }
  return process.env.ProgramData
    ? path.join(process.env.ProgramData, 'BearKTBaker', 'Temp')
    : path.join(path.parse(defaultRoot).root, 'BearKTBaker', 'Temp');
}

async function createTemporaryDirectory(prefix: string): Promise<string> {
  const defaultRoot = tmpdir();
  const preferredRoot = preferredTemporaryRoot();
  if (preferredRoot !== defaultRoot) {
    try {
      await mkdir(preferredRoot, { recursive: true });
      return await mkdtemp(path.join(preferredRoot, prefix));
    } catch {
      // Fall back to the OS default temp root below.
    }
  }
  return mkdtemp(path.join(defaultRoot, prefix));
}

export function createNodeFileSystemPort(): {
  files: FileSystemPort;
  paths: PathPort;
} {
  const files: FileSystemPort = {
    readText: (filePath) => readFile(filePath, 'utf8'),
    readBytes: async (filePath) =>
      new Uint8Array(await readFile(filePath)),
    async readOptionalBytes(filePath) {
      try {
        return new Uint8Array(await readFile(filePath));
      } catch (error) {
        if (
          error instanceof Error
          && 'code' in error
          && error.code === 'ENOENT'
        ) {
          return null;
        }
        throw error;
      }
    },
    writeText: async (filePath, content) => {
      await writeFile(filePath, content, 'utf8');
    },
    writeBytes: async (filePath, content) => {
      await writeFile(filePath, content);
    },
    copyFile,
    ensureDirectory: async (directoryPath) => {
      await mkdir(directoryPath, { recursive: true });
    },
    createTemporaryDirectory,
    removeDirectory: async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    },
  };
  const paths: PathPort = {
    join: path.join,
    dirname: path.dirname,
    basename: path.basename,
    isAbsolute: path.isAbsolute,
  };
  return { files, paths };
}
