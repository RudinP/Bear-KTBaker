import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElectronDialogPort } from './electronDialog';

describe('Electron dialog adapter', () => {
  const showOpenDialog = vi.fn();
  const showSaveDialog = vi.fn();
  const dialogs = createElectronDialogPort({
    showOpenDialog,
    showSaveDialog,
  } as unknown as Pick<
    Electron.Dialog,
    'showOpenDialog' | 'showSaveDialog'
  >);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves file-selection cancellation as null', async () => {
    showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    await expect(dialogs.selectFile({
      filters: [{ name: '프로젝트', extensions: ['ktstudio'] }],
    })).resolves.toBeNull();
    expect(showOpenDialog).toHaveBeenCalledWith({
      title: undefined,
      properties: ['openFile'],
      filters: [{ name: '프로젝트', extensions: ['ktstudio'] }],
    });
  });

  it('returns the first selected file', async () => {
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/themes/first.ktstudio', '/themes/second.ktstudio'],
    });

    await expect(dialogs.selectFile({
      title: '프로젝트 열기',
      filters: [{ name: '프로젝트', extensions: ['ktstudio'] }],
    })).resolves.toBe('/themes/first.ktstudio');
  });

  it('preserves save cancellation and returns a selected save path', async () => {
    showSaveDialog
      .mockResolvedValueOnce({ canceled: true })
      .mockResolvedValueOnce({
        canceled: false,
        filePath: '/themes/saved.ktstudio',
      });
    const options = {
      title: '프로젝트 저장',
      defaultPath: 'theme.ktstudio',
      filters: [{ name: '프로젝트', extensions: ['ktstudio'] }],
    };

    await expect(dialogs.selectSavePath(options)).resolves.toBeNull();
    await expect(dialogs.selectSavePath(options))
      .resolves.toBe('/themes/saved.ktstudio');
    expect(showSaveDialog).toHaveBeenLastCalledWith({
      title: '프로젝트 저장',
      defaultPath: 'theme.ktstudio',
      filters: [{ name: '프로젝트', extensions: ['ktstudio'] }],
    });
  });

  it('forwards directory properties and returns the first selection', async () => {
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/themes/output', '/themes/ignored'],
    });

    await expect(dialogs.selectDirectory({
      title: '폴더 선택',
      createDirectory: true,
    })).resolves.toBe('/themes/output');
    expect(showOpenDialog).toHaveBeenCalledWith({
      title: '폴더 선택',
      properties: ['openDirectory', 'createDirectory'],
    });
  });

  it('omits createDirectory when directory creation is disabled', async () => {
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [],
    });

    await expect(dialogs.selectDirectory({
      title: '기존 폴더 선택',
      createDirectory: false,
    })).resolves.toBeNull();
    expect(showOpenDialog).toHaveBeenCalledWith({
      title: '기존 폴더 선택',
      properties: ['openDirectory'],
    });
  });
});
