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
    createTemporaryDirectory: (prefix) =>
      mkdtemp(path.join(tmpdir(), prefix)),
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
