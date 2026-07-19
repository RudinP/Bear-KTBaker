export interface FileSystemPort {
  readText(filePath: string): Promise<string>;
  readBytes(filePath: string): Promise<Uint8Array>;
  readOptionalBytes(filePath: string): Promise<Uint8Array | null>;
  writeText(filePath: string, content: string): Promise<void>;
  writeBytes(filePath: string, content: Uint8Array): Promise<void>;
  copyFile(sourcePath: string, destinationPath: string): Promise<void>;
  ensureDirectory(directoryPath: string): Promise<void>;
  createTemporaryDirectory(prefix: string): Promise<string>;
  removeDirectory(directoryPath: string): Promise<void>;
}

export interface PathPort {
  join(...parts: string[]): string;
  dirname(filePath: string): string;
  basename(filePath: string): string;
  isAbsolute(filePath: string): boolean;
}
