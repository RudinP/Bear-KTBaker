import path from 'node:path';
import type {
  StandaloneAndroidPlatform,
  StandaloneAndroidRuntime,
} from './types';

export function standaloneRuntimePaths(
  runtimeDirectory: string,
  platform: StandaloneAndroidPlatform = process.platform as StandaloneAndroidPlatform,
): StandaloneAndroidRuntime {
  if (platform !== 'darwin' && platform !== 'win32') {
    throw new Error(`지원하지 않는 Android APK 빌드 환경입니다: ${platform}`);
  }
  return {
    androidJar: path.join(runtimeDirectory, 'android.jar'),
    classesDex: path.join(runtimeDirectory, 'classes.dex'),
    aapt2: path.join(
      runtimeDirectory,
      'bin',
      platform,
      platform === 'win32' ? 'aapt2.exe' : 'aapt2',
    ),
  };
}

export function buildStandaloneAapt2Plan({
  buildDir,
  outputPath,
  runtime,
  packageName,
  versionCode,
  versionName,
}: {
  buildDir: string;
  outputPath: string;
  runtime: StandaloneAndroidRuntime;
  packageName: string;
  versionCode: number;
  versionName: string;
}) {
  const workDir = path.join(buildDir, '.standalone');
  const roots = ['res', 'theme', 'theme-adv'];
  const compiled = roots.map((name) => path.join(workDir, `${name}.zip`));
  return {
    workDir,
    compile: roots.map((name, index) => [
      'compile', '--dir', path.join(buildDir, 'src', 'main', name), '-o', compiled[index],
    ]),
    link: [
      'link', '-o', outputPath,
      '--manifest', path.join(buildDir, 'src', 'main', 'AndroidManifest.xml'),
      '-I', runtime.androidJar,
      '--min-sdk-version', '28',
      '--target-sdk-version', '35',
      '--version-code', String(versionCode),
      '--version-name', versionName,
      '--rename-manifest-package', packageName,
      '--rename-resources-package', packageName,
      ...compiled,
    ],
  };
}
