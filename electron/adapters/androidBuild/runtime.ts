import { copyFile, link } from 'node:fs/promises';
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

const NON_ASCII_PATTERN = /[^\x00-\x7f]/;

// Keep tool arguments relative and ASCII. Windows builds with non-ASCII
// working directories also require the staging directory in workspace.ts:
// relative arguments alone do not fix AAPT2's ANSI directory enumeration.
// Use path.join so --dir receives the host's directory separators.
export function buildStandaloneAapt2Plan({
  buildDir,
  runtime,
  packageName,
  versionCode,
  versionName,
  androidJarArg,
}: {
  buildDir: string;
  runtime: StandaloneAndroidRuntime;
  packageName: string;
  versionCode: number;
  versionName: string;
  /** Arg to pass as `-I`; relative when `runtime.androidJar` is non-ASCII and was copied into the build dir. */
  androidJarArg?: string;
}) {
  const relWorkDir = '.standalone';
  const workDir = path.join(buildDir, relWorkDir);
  const roots = ['res', 'theme', 'theme-adv'];
  const relCompiled = roots.map((name) => path.join(relWorkDir, `${name}.zip`));
  const relUnsigned = path.join(relWorkDir, 'unsigned.apk');
  return {
    workDir,
    unsignedPath: path.join(workDir, 'unsigned.apk'),
    compile: roots.map((name, index) => [
      'compile', '--dir', path.join('src', 'main', name), '-o', relCompiled[index],
    ]),
    link: [
      'link', '-o', relUnsigned,
      '--manifest', path.join('src', 'main', 'AndroidManifest.xml'),
      '-I', androidJarArg ?? runtime.androidJar,
      '--min-sdk-version', '28',
      '--target-sdk-version', '35',
      '--version-code', String(versionCode),
      '--version-name', versionName,
      '--rename-manifest-package', packageName,
      '--rename-resources-package', packageName,
      ...relCompiled,
    ],
  };
}

/** Copies `androidJar` into the build dir and returns an ASCII-safe `-I` arg when its path isn't already ASCII. */
export async function resolveAndroidJarArg(androidJar: string, workDir: string): Promise<string> {
  if (!NON_ASCII_PATTERN.test(androidJar)) return androidJar;
  const localCopy = path.join(workDir, 'android.jar');
  try {
    await link(androidJar, localCopy);
  } catch {
    await copyFile(androidJar, localCopy);
  }
  return path.join('.standalone', 'android.jar');
}
