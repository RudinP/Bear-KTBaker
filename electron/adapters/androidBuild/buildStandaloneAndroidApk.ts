import { execFile } from 'node:child_process';
import {
  access,
  chmod,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { inspectCompiledAndroidApk } from '../../../src/io/androidCompiledMetadata';
import {
  verifyCompiledAndroidImages,
  type AndroidImageExpectation,
} from '../../../src/io/androidImageVerification';
import { injectStandaloneDex, signStandaloneApk, verifyStandaloneApkStructure } from './apkSigner';
import { verifyStandaloneApkSignatureV2 } from './apkV2Verifier';
import { AndroidStandaloneBuildError } from './errors';
import { verifyStandaloneAndroidMetadata } from './metadata';
import { buildStandaloneAapt2Plan, standaloneRuntimePaths } from './runtime';
import { loadOrCreateSigningIdentity } from './signingIdentity';
import type {
  AndroidStandaloneBuildStage,
  StandaloneAndroidMetadataExpectation,
  StandaloneAndroidPlatform,
} from './types';

const execFileAsync = promisify(execFile);

type Aapt2Runner = (executable: string, args: string[], options: {
  cwd: string;
  timeout: number;
  maxBuffer: number;
}) => Promise<unknown>;

export async function buildStandaloneAndroidApk({
  buildDir,
  outputPath,
  runtimeDir,
  identityPath,
  packageName,
  versionCode,
  versionName,
  expectedMetadata,
  expectedImages,
  platform = process.platform as StandaloneAndroidPlatform,
  run = execFileAsync as Aapt2Runner,
}: {
  buildDir: string;
  outputPath: string;
  runtimeDir: string;
  identityPath: string;
  packageName: string;
  versionCode: number;
  versionName: string;
  expectedMetadata?: Pick<StandaloneAndroidMetadataExpectation, 'name' | 'appearance' | 'colors'>;
  expectedImages?: AndroidImageExpectation[];
  platform?: StandaloneAndroidPlatform;
  run?: Aapt2Runner;
}) {
  const runtime = await runAndroidBuildStage(
    'runtime',
    'Android APK 내보내기 런타임을 확인하지 못했습니다.',
    async () => {
      const resolved = standaloneRuntimePaths(runtimeDir, platform);
      for (const required of [
        resolved.aapt2,
        resolved.androidJar,
        resolved.classesDex,
      ]) {
        try {
          await access(required);
        } catch {
          throw new Error(
            `Android APK 내보내기 런타임이 누락되었습니다: ${
              path.basename(required)
            }`,
          );
        }
      }
      if (platform === 'darwin') await chmod(resolved.aapt2, 0o755);
      return resolved;
    },
  );

  const unsignedPath = path.join(
    buildDir,
    '.standalone',
    'unsigned.apk',
  );
  const plan = buildStandaloneAapt2Plan({
    buildDir,
    outputPath: unsignedPath,
    runtime,
    packageName,
    versionCode,
    versionName,
  });
  await mkdir(plan.workDir, { recursive: true });
  const options = {
    cwd: buildDir,
    timeout: 2 * 60_000,
    maxBuffer: 20_000_000,
  };
  for (const args of plan.compile) {
    await runAndroidBuildStage(
      'compile',
      'Android 리소스 컴파일에 실패했습니다.',
      () => run(runtime.aapt2, args, options),
    );
  }
  await runAndroidBuildStage(
    'link',
    'Android 리소스를 APK에 연결하지 못했습니다.',
    () => run(runtime.aapt2, plan.link, options),
  );

  const withRuntime = await injectStandaloneDex(
    await readFile(unsignedPath),
    await readFile(runtime.classesDex),
  );
  const identity = await runAndroidBuildStage(
    'signing-identity',
    'Android 서명 정보를 준비하지 못했습니다.',
    () => loadOrCreateSigningIdentity(identityPath),
  );
  const signed = await runAndroidBuildStage(
    'sign',
    'Android APK 서명에 실패했습니다.',
    () => signStandaloneApk(withRuntime, identity),
  );
  await runAndroidBuildStage(
    'verify',
    'Android APK 검증에 실패했습니다.',
    async () => {
      await verifyStandaloneApkStructure(signed);
      verifyStandaloneApkSignatureV2(signed);
      const metadata = await inspectCompiledAndroidApk(signed);
      verifyStandaloneAndroidMetadata(metadata, {
        packageName,
        versionName,
        ...expectedMetadata,
      });
      await verifyCompiledAndroidImages(
        signed,
        metadata,
        expectedImages ?? [],
      );
    },
  );
  await writeFile(outputPath, signed);
  return outputPath;
}

async function runAndroidBuildStage<T>(
  stage: AndroidStandaloneBuildStage,
  message: string,
  work: () => Promise<T>,
) {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof AndroidStandaloneBuildError) throw cause;
    const exitCode =
      typeof (cause as { code?: unknown })?.code === 'number'
        ? (cause as { code: number }).code
        : undefined;
    const signal =
      typeof (cause as { signal?: unknown })?.signal === 'string'
        ? (cause as { signal: string }).signal
        : undefined;
    throw new AndroidStandaloneBuildError({
      stage,
      message,
      exitCode,
      signal,
      cause,
    });
  }
}
