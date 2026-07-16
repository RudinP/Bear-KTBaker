import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Blob as NodeBlob } from 'node:buffer';
import { execFile } from 'node:child_process';
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { ApkSignerV2, PackageSigner } from 'android-package-signer';
import JSZip from 'jszip';
import { inspectCompiledAndroidApk, type AndroidCompiledMetadata } from './androidCompiledMetadata';
import {
  verifyCompiledAndroidImages,
  type AndroidImageExpectation,
} from './androidImageVerification';

const execFileAsync = promisify(execFile);

export type StandaloneAndroidPlatform = 'darwin' | 'win32';

export interface StandaloneAndroidRuntime {
  androidJar: string;
  classesDex: string;
  aapt2: string;
}

export interface AndroidSigningIdentity {
  schema: 1;
  alias: string;
  password: string;
  pkcs12DataUrl: string;
}

export interface StandaloneAndroidMetadataExpectation {
  packageName: string;
  versionName?: string;
  name?: string;
  appearance?: 'light' | 'dark';
  colors?: Record<string, string>;
}

function normalizedAndroidColor(value: string | undefined) {
  const hex = value?.trim().match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  if (!hex) return undefined;
  return `#${hex.length === 6 ? 'FF' : ''}${hex.toUpperCase()}`;
}

export function verifyStandaloneAndroidMetadata(
  metadata: AndroidCompiledMetadata,
  expected: StandaloneAndroidMetadataExpectation,
) {
  const mismatches: string[] = [];
  if (metadata.themeId !== expected.packageName) {
    mismatches.push(`manifest package ${metadata.themeId ?? 'missing'}`);
  }
  if (metadata.resourcePackage !== expected.packageName) {
    mismatches.push(`resources package ${metadata.resourcePackage ?? 'missing'}`);
  }
  if (expected.versionName !== undefined && metadata.version !== expected.versionName) {
    mismatches.push(`version ${metadata.version ?? 'missing'}`);
  }
  if (expected.name !== undefined && metadata.name !== expected.name) {
    mismatches.push(`name ${metadata.name ?? 'missing'}`);
  }
  if (expected.appearance !== undefined && metadata.appearance !== expected.appearance) {
    mismatches.push(`appearance ${metadata.appearance ?? 'missing'}`);
  }
  const changedColors = Object.keys(expected.colors ?? {}).filter((name) => {
    const actual = normalizedAndroidColor(metadata.colors?.[name]);
    const wanted = normalizedAndroidColor(expected.colors?.[name]);
    return !actual || !wanted || actual !== wanted;
  });
  if (changedColors.length) mismatches.push(`색상 ${changedColors.length}개`);
  if (mismatches.length) {
    throw new Error(`Android APK 리소스 검증에 실패했습니다 (${mismatches.join(', ')}).`);
  }
  return metadata;
}

export function prepareStandaloneAndroidManifest(template: string) {
  return template
    .replace(/\s+xmlns:tools=["'][^"']+["']/i, '')
    .replace(/\s+tools:[\w.-]+=["'][^"']*["']/gi, '')
    .replace(/android:name=["']\.MainActivity["']/i, 'android:name="com.kakao.talk.theme.apeach.MainActivity"');
}

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
    aapt2: path.join(runtimeDirectory, 'bin', platform, platform === 'win32' ? 'aapt2.exe' : 'aapt2'),
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

function parseSigningIdentity(content: string): AndroidSigningIdentity {
  try {
    const value = JSON.parse(content) as Partial<AndroidSigningIdentity>;
    if (
      value.schema !== 1
      || typeof value.alias !== 'string'
      || value.alias.length === 0
      || typeof value.password !== 'string'
      || value.password.length < 6
      || typeof value.pkcs12DataUrl !== 'string'
      || !value.pkcs12DataUrl.startsWith('data:application/x-pkcs12;base64,')
    ) throw new Error('invalid identity');
    return value as AndroidSigningIdentity;
  } catch {
    throw new Error('저장된 Android 서명 정보가 손상되었습니다. 기존 테마를 업데이트하려면 서명 파일을 복구해야 합니다.');
  }
}

export async function loadOrCreateSigningIdentity(
  identityPath: string,
  dependencies: {
    randomPassword?: () => string;
    generateKey?: (password: string, alias: string) => Promise<string>;
  } = {},
): Promise<AndroidSigningIdentity> {
  try {
    return parseSigningIdentity(await readFile(identityPath, 'utf8'));
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }

  const alias = 'kakaotheme';
  const password = dependencies.randomPassword?.() ?? randomBytes(24).toString('base64url');
  const generateKey = dependencies.generateKey ?? (async (keyPassword: string, keyAlias: string) => {
    const signer = new PackageSigner(keyPassword, keyAlias);
    return signer.generateKey({
      commonName: 'KakaoTalk Theme Studio',
      organizationName: 'KakaoTalk Theme Studio',
      organizationUnit: 'Local Theme Export',
      countryCode: 'KR',
    });
  });
  const identity: AndroidSigningIdentity = {
    schema: 1,
    alias,
    password,
    pkcs12DataUrl: await generateKey(password, alias),
  };
  await mkdir(path.dirname(identityPath), { recursive: true });
  await writeFile(identityPath, `${JSON.stringify(identity, null, 2)}\n`, { mode: 0o600 });
  return identity;
}

export async function injectStandaloneDex(resourceApk: Buffer, classesDex: Buffer) {
  const zip = await JSZip.loadAsync(resourceApk);
  zip.file('classes.dex', classesDex, { binary: true, createFolders: false });
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function signStandaloneApk(unsignedApk: Buffer, identity: AndroidSigningIdentity) {
  const signer = new ApkSignerV2(identity.password, identity.alias);
  const originalBlob = globalThis.Blob;
  const originalLog = console.log;
  const needsNodeBlob = typeof originalBlob?.prototype?.arrayBuffer !== 'function';
  if (needsNodeBlob) Object.assign(globalThis, { Blob: NodeBlob });
  console.log = (...args: unknown[]) => {
    if (args[0] !== '<<<') originalLog(...args);
  };
  let dataUrl: string;
  try {
    dataUrl = await signer.signPackageV2(
      new Uint8Array(unsignedApk) as unknown as File,
      identity.pkcs12DataUrl,
      'KakaoTalk Theme Studio',
    );
  } finally {
    console.log = originalLog;
    if (needsNodeBlob) Object.assign(globalThis, { Blob: originalBlob });
  }
  const separator = dataUrl.indexOf(',');
  if (separator < 0) throw new Error('Android APK 서명 결과를 읽지 못했습니다.');
  return Buffer.from(dataUrl.slice(separator + 1), 'base64');
}

export async function verifyStandaloneApkStructure(apkBuffer: Buffer) {
  const zip = await JSZip.loadAsync(apkBuffer);
  const result = {
    hasManifest: Boolean(zip.file('AndroidManifest.xml')),
    hasResources: Boolean(zip.file('resources.arsc')),
    hasRuntime: Boolean(zip.file('classes.dex')),
    hasV2SigningBlock: apkBuffer.includes(Buffer.from('APK Sig Block 42', 'ascii')),
  };
  if (!Object.values(result).every(Boolean)) {
    throw new Error('Android APK 검증에 실패했습니다. 매니페스트, 리소스, 실행 코드 또는 V2 서명이 누락되었습니다.');
  }
  return result;
}

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
  const runtime = standaloneRuntimePaths(runtimeDir, platform);
  for (const required of [runtime.aapt2, runtime.androidJar, runtime.classesDex]) {
    try {
      await access(required);
    } catch {
      throw new Error(`Android APK 내보내기 런타임이 누락되었습니다: ${path.basename(required)}`);
    }
  }
  if (platform === 'darwin') await chmod(runtime.aapt2, 0o755);

  const unsignedPath = path.join(buildDir, '.standalone', 'unsigned.apk');
  const plan = buildStandaloneAapt2Plan({
    buildDir,
    outputPath: unsignedPath,
    runtime,
    packageName,
    versionCode,
    versionName,
  });
  await mkdir(plan.workDir, { recursive: true });
  const options = { cwd: buildDir, timeout: 2 * 60_000, maxBuffer: 20_000_000 };
  for (const args of plan.compile) await run(runtime.aapt2, args, options);
  await run(runtime.aapt2, plan.link, options);

  const withRuntime = await injectStandaloneDex(await readFile(unsignedPath), await readFile(runtime.classesDex));
  const identity = await loadOrCreateSigningIdentity(identityPath);
  const signed = await signStandaloneApk(withRuntime, identity);
  await verifyStandaloneApkStructure(signed);
  const metadata = await inspectCompiledAndroidApk(signed);
  verifyStandaloneAndroidMetadata(metadata, {
    packageName,
    versionName,
    ...expectedMetadata,
  });
  await verifyCompiledAndroidImages(signed, metadata, expectedImages ?? []);
  await writeFile(outputPath, signed);
  return outputPath;
}
