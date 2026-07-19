import type {
  DialogPort,
  FileFilter,
} from '../../src/application/ports/dialog';

export function createElectronDialogPort(
  electronDialog: Pick<
    Electron.Dialog,
    'showOpenDialog' | 'showSaveDialog'
  >,
): DialogPort {
  const filters = (items: readonly FileFilter[]) =>
    items.map((item) => ({
      name: item.name,
      extensions: [...item.extensions],
    }));

  return {
    async selectFile(options) {
      const result = await electronDialog.showOpenDialog({
        title: options.title,
        properties: ['openFile'],
        filters: filters(options.filters),
      });
      return result.canceled ? null : result.filePaths[0] ?? null;
    },

    async selectSavePath(options) {
      const result = await electronDialog.showSaveDialog({
        title: options.title,
        defaultPath: options.defaultPath,
        filters: filters(options.filters),
      });
      return result.canceled ? null : result.filePath ?? null;
    },

    async selectDirectory(options) {
      const result = await electronDialog.showOpenDialog({
        title: options.title,
        properties: [
          'openDirectory',
          ...(options.createDirectory
            ? ['createDirectory' as const]
            : []),
        ],
      });
      return result.canceled ? null : result.filePaths[0] ?? null;
    },
  };
}
