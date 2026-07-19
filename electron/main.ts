import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
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
  createSaveScreenshots,
} from '../src/application/screenshots/saveScreenshots';
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
import { registerThemeIpc } from './ipc/registerThemeIpc';
import type { TrustedSenderPolicy } from './ipc/trustedSender';

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
const saveScreenshots = createSaveScreenshots({ dialogs, files, paths });
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

app.whenReady().then(async () => {
  registerThemeIpc({
    ipc: ipcMain,
    senderPolicy,
    useCases: {
      openProject,
      saveProject,
      importTheme,
      exportIos: exportIosTheme,
      exportAndroid: exportAndroidTheme,
      saveScreenshots,
    },
    diagnostics,
  });
  installApplicationMenu();
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
