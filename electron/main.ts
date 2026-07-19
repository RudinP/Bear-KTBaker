import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  normalizeThemeStudioError,
} from '../src/application/errors/ThemeStudioError';
import {
  formatThemeStudioSupportString,
} from '../src/application/errors/supportString';
import {
  createOpenProject,
  type OpenedProject,
} from '../src/application/theme/openProject';
import {
  createImportTheme,
  type ImportThemeResult,
} from '../src/application/theme/importTheme';
import { createExportIosTheme } from '../src/application/theme/exportIosTheme';
import {
  createExportAndroidTheme,
} from '../src/application/theme/exportAndroidTheme';
import { createSaveProject } from '../src/application/theme/saveProject';
import {
  createAndroidApkBuilder,
  createAndroidApkInspector,
} from './adapters/androidToolRunner';
import {
  createConsoleDiagnosticReporter,
} from './adapters/consoleDiagnosticReporter';
import { createElectronDialogPort } from './adapters/electronDialog';
import { createElectronImageProcessor } from './adapters/electronImageProcessor';
import { createNodeFileSystemPort } from './adapters/nodeFileSystem';
import { historyCommandForInput } from './historyShortcut';
import { createApplicationMenuTemplate } from './applicationMenu';
import {
  type ErrorBoundaryFallback,
  withIpcErrorBoundary,
} from './ipc/errorBoundary';
import {
  parseProjectSaveRequest,
  parseScreenshotSaveRequests,
  parseThemeProjectRequest,
} from './ipc/requestValidation';
import {
  assertTrustedSender,
  type TrustedSenderPolicy,
} from './ipc/trustedSender';

const devUrl = process.env.VITE_DEV_SERVER_URL;
const senderPolicy: TrustedSenderPolicy = {
  developmentServerUrl: devUrl,
  packagedRendererUrl: pathToFileURL(
    path.join(app.getAppPath(), 'dist', 'index.html'),
  ).href,
};
const dialogs = createElectronDialogPort(dialog);
const { files, paths } = createNodeFileSystemPort();
const images = createElectronImageProcessor();
const diagnostics = createConsoleDiagnosticReporter();
const openProject: () => Promise<OpenedProject | null> =
  createOpenProject({ dialogs, files });
const saveProject = createSaveProject({ dialogs, files });
const importTheme: () => Promise<ImportThemeResult | null> = createImportTheme({
  dialogs,
  files,
  paths,
  androidInspector: createAndroidApkInspector(),
});

// macOS builds the application menu from Electron's runtime name, not the
// BrowserWindow title or electron-builder productName.
app.setName('Bear KTBaker');

function templatePath(file: string) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'templates', file)
    : path.join(app.getAppPath(), 'resources', 'templates', file);
}

const exportIosTheme = createExportIosTheme({
  dialogs,
  files,
  images,
  iosTemplatePath: templatePath('ios-base.ktheme'),
});
const exportAndroidTheme = createExportAndroidTheme({
  dialogs,
  files,
  paths,
  images,
  androidBuilder: createAndroidApkBuilder(),
  diagnostics,
  androidSourceTemplatePath: templatePath('android-source.zip'),
  androidRuntimeDirectory: templatePath('android-runtime'),
  signingIdentityPath: paths.join(
    app.getPath('userData'),
    'android-signing-identity.json',
  ),
});

async function createWindow() {
  const isMac = process.platform === 'darwin';
  const window = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1060,
    minHeight: 710,
    show: false,
    title: 'Bear KTBaker',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    vibrancy: isMac ? 'under-window' : undefined,
    visualEffectState: isMac ? 'active' : undefined,
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : 'none',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const command = historyCommandForInput(input, process.platform);
    if (!command) return;
    event.preventDefault();
    window.webContents.send('history:command', command);
  });
  window.once('ready-to-show', () => {
    window.show();
  });
  if (devUrl) await window.loadURL(devUrl);
  else await window.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
}

function installApplicationMenu() {
  const template = createApplicationMenuTemplate(process.platform, (command) => {
    BrowserWindow.getFocusedWindow()?.webContents.send('file:command', command);
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function dataUrlBuffer(dataUrl: string) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

function registerIpc() {
  const fallback = (
    operation: ErrorBoundaryFallback['operation'],
  ): ErrorBoundaryFallback => ({
    code: 'KTB-UNKNOWN-UNEXPECTED',
    operation,
    stage: '알 수 없는 작업',
    message: '예상하지 못한 오류가 발생했습니다.',
  });

  ipcMain.handle(
    'project:open',
    withIpcErrorBoundary(
      {
        code: 'KTB-FS-READ',
        operation: 'project:open',
        stage: '프로젝트 열기',
        message: '프로젝트를 열지 못했습니다.',
      },
      async (event) => {
        assertTrustedSender(event, senderPolicy);
        return openProject();
      },
    ),
  );
  ipcMain.handle(
    'project:save',
    withIpcErrorBoundary(
      {
        code: 'KTB-FS-WRITE',
        operation: 'project:save',
        stage: '프로젝트 저장',
        message: '프로젝트를 저장하지 못했습니다.',
      },
      async (event, value: unknown) => {
        assertTrustedSender(event, senderPolicy);
        const request = parseProjectSaveRequest(value);
        return saveProject(request.content, request.suggestedName);
      },
    ),
  );
  ipcMain.handle('theme:import', withIpcErrorBoundary(
    fallback('theme:import'),
    async (event) => {
      assertTrustedSender(event, senderPolicy);
      return importTheme();
    },
  ));
  ipcMain.handle('theme:export-ios', withIpcErrorBoundary(
    fallback('theme:export-ios'),
    async (event, value: unknown) => {
      assertTrustedSender(event, senderPolicy);
      return exportIosTheme(parseThemeProjectRequest(value));
    },
  ));
  ipcMain.handle('theme:export-android', withIpcErrorBoundary(
    fallback('theme:export-android'),
    async (event, value: unknown) => {
      assertTrustedSender(event, senderPolicy);
      const project = parseThemeProjectRequest(value);
      try {
        return await exportAndroidTheme(project);
      } catch (error) {
        const typed = normalizeThemeStudioError(error, {
          code: 'KTB-UNKNOWN-UNEXPECTED',
          operation: 'theme:export-android',
          stage: 'Android 테마 내보내기',
          message: 'Android 테마를 내보내지 못했습니다.',
        });
        diagnostics.report(typed);
        return {
          error: formatThemeStudioSupportString(typed),
        };
      }
    },
  ));
  ipcMain.handle('screenshots:save', withIpcErrorBoundary(
    fallback('screenshots:save'),
    async (event, value: unknown) => {
      assertTrustedSender(event, senderPolicy);
      const files = parseScreenshotSaveRequests(value);
      const result = await dialog.showOpenDialog({
        title: '홍보 이미지 저장 폴더',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || !result.filePaths[0]) return null;
      await Promise.all(files.map((file) => writeFile(
        path.join(result.filePaths[0], file.name),
        dataUrlBuffer(file.dataUrl),
      )));
      return result.filePaths[0];
    },
  ));
}

app.whenReady().then(async () => { registerIpc(); installApplicationMenu(); await createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
