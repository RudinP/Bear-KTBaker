import { cp, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { StandaloneAndroidPlatform } from './types';

const NON_ASCII = /[^\x00-\x7f]/;

export async function prepareAndroidBuildWorkspace(
  buildDir: string,
  platform: StandaloneAndroidPlatform,
  temporaryRoots: readonly string[] = [
    tmpdir(),
    ...(process.env.SystemRoot ? [path.join(process.env.SystemRoot, 'Temp')] : []),
    ...(process.env.PUBLIC ? [process.env.PUBLIC] : []),
    ...(process.env.ProgramData ? [process.env.ProgramData] : []),
  ],
) {
  if (platform !== 'win32' || !NON_ASCII.test(buildDir)) {
    return { buildDir, async cleanup() {} };
  }

  // Windows AAPT2 can report a successful compile with empty resources when
  // its working directory contains Korean characters. Relative arguments do
  // not fix its directory enumeration; compile in an actual ASCII directory.
  let staging: string | undefined;
  const failures: unknown[] = [];
  for (const root of new Set(temporaryRoots)) {
    try {
      const resolved = await realpath(root);
      if (NON_ASCII.test(resolved)) continue;
      staging = await mkdtemp(path.join(resolved, 'ktb-apk-'));
      break;
    } catch (error) {
      failures.push(error);
    }
  }
  if (!staging) {
    throw new AggregateError(failures, 'Android APK 빌드용 영문 임시 폴더를 만들지 못했습니다.');
  }
  const directory = staging;
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    await cp(buildDir, directory, { recursive: true });
  } catch (error) {
    await cleanup();
    throw error;
  }
  return { buildDir: directory, cleanup };
}
