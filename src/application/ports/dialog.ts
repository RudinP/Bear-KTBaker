export interface FileFilter {
  name: string;
  extensions: readonly string[];
}

export interface DialogPort {
  selectFile(options: {
    title?: string;
    filters: readonly FileFilter[];
  }): Promise<string | null>;

  selectSavePath(options: {
    title?: string;
    defaultPath: string;
    filters: readonly FileFilter[];
  }): Promise<string | null>;

  selectDirectory(options: {
    title: string;
    createDirectory: boolean;
  }): Promise<string | null>;
}
