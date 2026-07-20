import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
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
import {
  createWindow,
  type CreateWindowOptions,
} from './createWindow';
import { installApplicationMenu } from './installApplicationMenu';
import { registerThemeIpc } from './ipc/registerThemeIpc';
import type { TrustedSenderPolicy } from './ipc/trustedSender';

// macOS builds the application menu from Electron's runtime name, not the
// BrowserWindow title or electron-builder productName.
app.setName('Bear KTBaker');

const devUrl = process.env.VITE_DEV_SERVER_URL;
const applicationPath = app.getAppPath();
const rendererPath = path.join(applicationPath, 'dist', 'index.html');
const preloadPath = path.join(__dirname, 'preload.js');
const templateDirectory = app.isPackaged
  ? path.join(process.resourcesPath, 'templates')
  : path.join(applicationPath, 'resources', 'templates');
const iosTemplatePath = path.join(templateDirectory, 'ios-base.ktheme');
const androidSourceTemplatePath = path.join(
  templateDirectory,
  'android-source.zip',
);
const androidRuntimeDirectory = path.join(
  templateDirectory,
  'android-runtime',
);
const senderPolicy: TrustedSenderPolicy = {
  developmentServerUrl: devUrl,
  packagedRendererUrl: pathToFileURL(rendererPath).href,
};
const dialogs = createElectronDialogPort(dialog);
const { files, paths } = createNodeFileSystemPort();
const images = createElectronImageProcessor();
const diagnostics = createConsoleDiagnosticReporter();
const signingIdentityPath = paths.join(
  app.getPath('userData'),
  'android-signing-identity.json',
);
const saveProject = createSaveProject({ dialogs, files });
const saveScreenshots = createSaveScreenshots({ dialogs, files, paths });
const importTheme: () => Promise<ImportThemeResult | null> = createImportTheme({
  dialogs,
  files,
  paths,
  androidInspector: createAndroidApkInspector(),
});

const exportIosTheme = createExportIosTheme({
  dialogs,
  files,
  images,
  iosTemplatePath,
});
const exportAndroidTheme = createExportAndroidTheme({
  dialogs,
  files,
  paths,
  images,
  androidBuilder: createAndroidApkBuilder(),
  diagnostics,
  androidSourceTemplatePath,
  androidRuntimeDirectory,
  signingIdentityPath,
});

const windowOptions: CreateWindowOptions = {
  platform: process.platform,
  developmentServerUrl: devUrl,
  applicationPath,
  preloadPath,
  makeWindow: (options) => new BrowserWindow(options),
};

app.whenReady().then(async () => {
  registerThemeIpc({
    ipc: ipcMain,
    senderPolicy,
    useCases: {
      saveProject,
      importTheme,
      exportIos: exportIosTheme,
      exportAndroid: exportAndroidTheme,
      saveScreenshots,
    },
    diagnostics,
  });
  installApplicationMenu({
    platform: process.platform,
    buildFromTemplate: Menu.buildFromTemplate,
    setApplicationMenu: Menu.setApplicationMenu,
    focusedWindow: BrowserWindow.getFocusedWindow,
  });
  await createWindow(windowOptions);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow(windowOptions);
    }
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
