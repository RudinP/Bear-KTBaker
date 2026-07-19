import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(path.join(process.cwd(), 'electron', 'main.ts'), 'utf8');

describe('Electron main composition root', () => {
  it.each([
    'JSZip',
    'nativeImage',
    'execFile',
    'readFile',
    'writeFile',
    'buildIosCss',
    'buildAndroidColorsXml',
    'buildStandaloneAndroidApk',
    'prepareStandaloneAndroidManifest',
    'getMappedResourceWrites',
    'inspectCompiledAndroidApk',
  ])('does not contain the implementation token %s', (token) => {
    expect(source).not.toContain(token);
  });

  it.each([
    'registerThemeIpc',
    'createWindow',
    'installApplicationMenu',
    'createAndroidApkBuilder',
    'createAndroidApkInspector',
    'createConsoleDiagnosticReporter',
    'createElectronDialogPort',
    'createElectronImageProcessor',
    'createNodeFileSystemPort',
  ])('imports the composition dependency %s', (factory) => {
    expect(source).toMatch(
      new RegExp(`import[\\s\\S]*?\\b${factory}\\b[\\s\\S]*?from\\s+['"][^'"]+['"]`),
    );
  });
});
