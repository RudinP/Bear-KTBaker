import path from 'node:path';
import {
  constants as cryptoConstants,
  createHash,
  randomBytes,
  timingSafeEqual,
  verify as verifySignature,
  X509Certificate,
} from 'node:crypto';
import { Blob as NodeBlob } from 'node:buffer';
import { execFile } from 'node:child_process';
import {
  access,
  chmod,
  link,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { promisify } from 'node:util';
import { ApkSignerV2, PackageSigner } from 'android-package-signer';
import JSZip from 'jszip';
import {
  inspectCompiledAndroidApk,
  type AndroidCompiledMetadata,
} from '../../src/io/androidCompiledMetadata';
import {
  verifyCompiledAndroidImages,
  type AndroidImageExpectation,
} from '../../src/io/androidImageVerification';

const execFileAsync = promisify(execFile);

export type StandaloneAndroidPlatform = 'darwin' | 'win32';

export type AndroidStandaloneBuildStage =
  | 'runtime'
  | 'compile'
  | 'link'
  | 'signing-identity'
  | 'sign'
  | 'verify';

export class AndroidStandaloneBuildError extends Error {
  readonly stage: AndroidStandaloneBuildStage;
  readonly exitCode?: number;
  readonly signal?: string;

  constructor(options: {
    stage: AndroidStandaloneBuildStage;
    message: string;
    exitCode?: number;
    signal?: string;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'AndroidStandaloneBuildError';
    this.stage = options.stage;
    this.exitCode = options.exitCode;
    this.signal = options.signal;
  }
}

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

class DamagedSigningIdentityError extends Error {
  constructor() {
    super(
      '저장된 Android 서명 정보가 손상되었습니다. 기존 테마를 업데이트하려면 서명 파일을 복구해야 합니다.',
    );
  }
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
    throw new DamagedSigningIdentityError();
  }
}

interface SigningIdentityDependencies {
  randomPassword?: () => string;
  generateKey?: (
    password: string,
    alias: string,
  ) => Promise<string>;
  waitForIdentityRetry?: (attempt: number) => Promise<void>;
}

const SIGNING_IDENTITY_READ_ATTEMPTS = 5;
const signingIdentityOperations = new Map<
  string,
  Promise<AndroidSigningIdentity>
>();

export async function loadOrCreateSigningIdentity(
  identityPath: string,
  dependencies: SigningIdentityDependencies = {},
): Promise<AndroidSigningIdentity> {
  const current = signingIdentityOperations.get(identityPath);
  if (current) return current;
  const operation = loadOrCreateSigningIdentityExclusive(
    identityPath,
    dependencies,
  ).finally(() => {
    if (signingIdentityOperations.get(identityPath) === operation) {
      signingIdentityOperations.delete(identityPath);
    }
  });
  signingIdentityOperations.set(identityPath, operation);
  return operation;
}

async function loadOrCreateSigningIdentityExclusive(
  identityPath: string,
  dependencies: SigningIdentityDependencies,
): Promise<AndroidSigningIdentity> {
  try {
    return await readPersistedSigningIdentityWithRetry(
      identityPath,
      dependencies,
      false,
    );
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }

  await mkdir(path.dirname(identityPath), { recursive: true });
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
  const temporaryPath = `${identityPath}.${process.pid}.${
    randomBytes(12).toString('hex')
  }.tmp`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(identity, null, 2)}\n`,
      {
        mode: 0o600,
        flag: 'wx',
        flush: true,
      },
    );
    try {
      await link(temporaryPath, identityPath);
      await chmod(identityPath, 0o600);
      return identity;
    } catch (error) {
      if (
        error instanceof Error
        && 'code' in error
        && error.code === 'EEXIST'
      ) {
        return readPersistedSigningIdentityWithRetry(
          identityPath,
          dependencies,
          true,
        );
      }
      throw error;
    }
  } finally {
    try {
      await unlink(temporaryPath);
    } catch (error) {
      if (!(
        error instanceof Error
        && 'code' in error
        && error.code === 'ENOENT'
      )) {
        throw error;
      }
    }
  }
}

async function readPersistedSigningIdentityWithRetry(
  identityPath: string,
  dependencies: SigningIdentityDependencies,
  retryMissing: boolean,
) {
  let lastError: unknown;
  for (
    let attempt = 0;
    attempt < SIGNING_IDENTITY_READ_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await readPersistedSigningIdentity(identityPath);
    } catch (error) {
      const missing = error instanceof Error
        && 'code' in error
        && error.code === 'ENOENT';
      if (
        !(error instanceof DamagedSigningIdentityError)
        && !(retryMissing && missing)
      ) {
        throw error;
      }
      lastError = error;
      if (attempt === SIGNING_IDENTITY_READ_ATTEMPTS - 1) {
        break;
      }
      if (dependencies.waitForIdentityRetry) {
        await dependencies.waitForIdentityRetry(attempt);
      } else {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 20);
        });
      }
    }
  }
  throw lastError;
}

async function readPersistedSigningIdentity(
  identityPath: string,
): Promise<AndroidSigningIdentity> {
  const identity = parseSigningIdentity(
    await readFile(identityPath, 'utf8'),
  );
  await chmod(identityPath, 0o600);
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
  };
  if (!Object.values(result).every(Boolean)) {
    throw new Error(
      'Android APK 구조 검증에 실패했습니다. 매니페스트, 리소스 또는 실행 코드가 누락되었습니다.',
    );
  }
  return result;
}

const APK_SIG_BLOCK_MAGIC = Buffer.from(
  'APK Sig Block 42',
  'ascii',
);
const APK_SIGNATURE_SCHEME_V2_BLOCK_ID = 0x7109871a;
const RSA_PKCS1_SHA256_ALGORITHM_ID = 0x0103;
const APK_CONTENT_CHUNK_SIZE = 1024 * 1024;

interface ApkV2Sections {
  beforeSigningBlock: Buffer;
  centralDirectory: Buffer;
  eocd: Buffer;
  signingBlockPairs: Buffer;
  signingBlockOffset: number;
}

interface LengthPrefixedCursor {
  bytes: Buffer;
  offset: number;
}

interface V2Signer {
  signedData: Buffer;
  signatures: Array<{
    algorithmId: number;
    signature: Buffer;
  }>;
  publicKey: Buffer;
  digests: Array<{
    algorithmId: number;
    digest: Buffer;
  }>;
  certificates: Buffer[];
  additionalAttributes: Buffer;
}

export function verifyStandaloneApkSignatureV2(
  apkBytes: Uint8Array,
) {
  try {
    const apk = Buffer.from(apkBytes);
    const sections = parseApkV2Sections(apk);
    const v2Block = findV2SigningBlock(
      sections.signingBlockPairs,
    );
    const signers = parseV2Signers(v2Block);
    if (signers.length !== 1) {
      throw new Error('expected exactly one v2 signer');
    }
    const contentDigest = calculateApkV2ContentDigest(sections);
    verifyV2Signer(signers[0], contentDigest);
    return {
      hasV2SigningBlock: true as const,
      algorithmId: RSA_PKCS1_SHA256_ALGORITHM_ID,
    };
  } catch (cause) {
    throw new Error(
      'Android APK V2 서명 검증에 실패했습니다.',
      { cause },
    );
  }
}

function parseApkV2Sections(apk: Buffer): ApkV2Sections {
  const eocdOffset = findZipEocdOffset(apk);
  if (
    apk.readUInt16LE(eocdOffset + 4) !== 0
    || apk.readUInt16LE(eocdOffset + 6) !== 0
    || apk.readUInt16LE(eocdOffset + 8)
      !== apk.readUInt16LE(eocdOffset + 10)
  ) {
    throw new Error('unsupported multi-disk ZIP');
  }
  const centralDirectorySize = apk.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = apk.readUInt32LE(
    eocdOffset + 16,
  );
  if (
    centralDirectorySize === 0xffffffff
    || centralDirectoryOffset === 0xffffffff
    || centralDirectoryOffset + centralDirectorySize
      !== eocdOffset
    || centralDirectoryOffset < 32
  ) {
    throw new Error('invalid central directory');
  }

  const footerOffset = centralDirectoryOffset - 24;
  if (
    footerOffset < 8
    || !apk.subarray(
      footerOffset + 8,
      centralDirectoryOffset,
    ).equals(APK_SIG_BLOCK_MAGIC)
  ) {
    throw new Error('missing signing block footer');
  }
  const footerSize = readSafeUint64(apk, footerOffset);
  if (footerSize < 24 || footerSize > centralDirectoryOffset - 8) {
    throw new Error('invalid signing block size');
  }
  const signingBlockOffset =
    centralDirectoryOffset - footerSize - 8;
  if (
    signingBlockOffset < 0
    || readSafeUint64(apk, signingBlockOffset) !== footerSize
  ) {
    throw new Error('mismatched signing block sizes');
  }
  const pairStart = signingBlockOffset + 8;
  const pairEnd = footerOffset;
  if (pairStart >= pairEnd) throw new Error('empty signing block');

  const eocd = Buffer.from(apk.subarray(eocdOffset));
  eocd.writeUInt32LE(signingBlockOffset, 16);
  return {
    beforeSigningBlock: apk.subarray(0, signingBlockOffset),
    centralDirectory: apk.subarray(
      centralDirectoryOffset,
      eocdOffset,
    ),
    eocd,
    signingBlockPairs: apk.subarray(pairStart, pairEnd),
    signingBlockOffset,
  };
}

function findZipEocdOffset(apk: Buffer) {
  if (apk.length < 22) throw new Error('truncated ZIP');
  const minimum = Math.max(0, apk.length - 22 - 0xffff);
  for (
    let offset = apk.length - 22;
    offset >= minimum;
    offset -= 1
  ) {
    if (
      apk.readUInt32LE(offset) !== 0x06054b50
      || offset + 22 + apk.readUInt16LE(offset + 20)
        !== apk.length
    ) {
      continue;
    }
    return offset;
  }
  throw new Error('missing ZIP EOCD');
}

function readSafeUint64(bytes: Buffer, offset: number) {
  if (offset < 0 || offset + 8 > bytes.length) {
    throw new Error('truncated uint64');
  }
  const value = bytes.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('oversized uint64');
  }
  return Number(value);
}

function findV2SigningBlock(pairs: Buffer) {
  let offset = 0;
  let v2Block: Buffer | undefined;
  while (offset < pairs.length) {
    const pairLength = readSafeUint64(pairs, offset);
    offset += 8;
    if (
      pairLength < 4
      || offset + pairLength > pairs.length
    ) {
      throw new Error('invalid signing pair');
    }
    const id = pairs.readUInt32LE(offset);
    const value = pairs.subarray(
      offset + 4,
      offset + pairLength,
    );
    if (id === APK_SIGNATURE_SCHEME_V2_BLOCK_ID) {
      if (v2Block) throw new Error('duplicate v2 block');
      v2Block = value;
    }
    offset += pairLength;
  }
  if (offset !== pairs.length || !v2Block) {
    throw new Error('missing v2 block');
  }
  return v2Block;
}

function parseV2Signers(v2Block: Buffer): V2Signer[] {
  const outer = cursor(v2Block);
  const signerSequence = readLengthPrefixed(outer);
  requireConsumed(outer);
  const sequence = cursor(signerSequence);
  const signers: V2Signer[] = [];
  while (sequence.offset < sequence.bytes.length) {
    signers.push(parseV2Signer(readLengthPrefixed(sequence)));
  }
  requireConsumed(sequence);
  return signers;
}

function parseV2Signer(bytes: Buffer): V2Signer {
  const signer = cursor(bytes);
  const signedData = readLengthPrefixed(signer);
  const signatureBytes = readLengthPrefixed(signer);
  const publicKey = readLengthPrefixed(signer);
  requireConsumed(signer);

  const signed = cursor(signedData);
  const digestBytes = readLengthPrefixed(signed);
  const certificateBytes = readLengthPrefixed(signed);
  const additionalAttributes = readLengthPrefixed(signed);
  requireConsumed(signed);
  return {
    signedData,
    signatures: parseAlgorithmRecords(
      signatureBytes,
      'signature',
    ) as V2Signer['signatures'],
    publicKey,
    digests: parseAlgorithmRecords(
      digestBytes,
      'digest',
    ) as V2Signer['digests'],
    certificates: parseCertificateRecords(certificateBytes),
    additionalAttributes,
  };
}

function parseAlgorithmRecords(
  bytes: Buffer,
  valueName: 'signature' | 'digest',
) {
  const sequence = cursor(bytes);
  const records: Array<{
    algorithmId: number;
    signature?: Buffer;
    digest?: Buffer;
  }> = [];
  const seen = new Set<number>();
  while (sequence.offset < sequence.bytes.length) {
    const record = cursor(readLengthPrefixed(sequence));
    const algorithmId = readUint32(record);
    const value = readLengthPrefixed(record);
    requireConsumed(record);
    if (seen.has(algorithmId)) {
      throw new Error('duplicate algorithm');
    }
    seen.add(algorithmId);
    records.push({
      algorithmId,
      [valueName]: value,
    });
  }
  requireConsumed(sequence);
  return records;
}

function parseCertificateRecords(bytes: Buffer) {
  const sequence = cursor(bytes);
  const certificates: Buffer[] = [];
  while (sequence.offset < sequence.bytes.length) {
    certificates.push(readLengthPrefixed(sequence));
  }
  requireConsumed(sequence);
  return certificates;
}

function cursor(bytes: Buffer): LengthPrefixedCursor {
  return { bytes, offset: 0 };
}

function readUint32(input: LengthPrefixedCursor) {
  if (input.offset + 4 > input.bytes.length) {
    throw new Error('truncated uint32');
  }
  const value = input.bytes.readUInt32LE(input.offset);
  input.offset += 4;
  return value;
}

function readLengthPrefixed(input: LengthPrefixedCursor) {
  const length = readUint32(input);
  if (input.offset + length > input.bytes.length) {
    throw new Error('truncated length-prefixed field');
  }
  const value = input.bytes.subarray(
    input.offset,
    input.offset + length,
  );
  input.offset += length;
  return value;
}

function requireConsumed(input: LengthPrefixedCursor) {
  if (input.offset !== input.bytes.length) {
    throw new Error('trailing signed data');
  }
}

function verifyV2Signer(
  signer: V2Signer,
  contentDigest: Buffer,
) {
  if (
    signer.signatures.length !== 1
    || signer.digests.length !== 1
    || signer.signatures[0].algorithmId
      !== RSA_PKCS1_SHA256_ALGORITHM_ID
    || signer.digests[0].algorithmId
      !== RSA_PKCS1_SHA256_ALGORITHM_ID
  ) {
    throw new Error('unsupported signer algorithm shape');
  }
  if (signer.certificates.length !== 1) {
    throw new Error('expected exactly one signer certificate');
  }
  if (signer.additionalAttributes.length !== 0) {
    throw new Error(
      'additional signer attributes are unsupported',
    );
  }
  const [signature] = signer.signatures;
  const [digest] = signer.digests;
  const certificateBytes = signer.certificates[0];
  if (
    digest.digest.length !== 32
  ) {
    throw new Error('unsupported or incomplete signer');
  }
  if (!safeEqual(digest.digest, contentDigest)) {
    throw new Error('APK content digest differs');
  }

  const certificate = new X509Certificate(certificateBytes);
  if (!safeEqual(certificate.raw, certificateBytes)) {
    throw new Error('signer certificate encoding differs');
  }
  const certificatePublicKey = Buffer.from(
    certificate.publicKey.export({
      type: 'spki',
      format: 'der',
    }),
  );
  if (!safeEqual(certificatePublicKey, signer.publicKey)) {
    throw new Error('certificate public key differs');
  }
  if (
    certificate.subject === certificate.issuer
    && !certificate.verify(certificate.publicKey)
  ) {
    throw new Error('self-signed certificate is invalid');
  }
  if (!verifySignature(
    'sha256',
    signer.signedData,
    {
      key: certificate.publicKey,
      padding: cryptoConstants.RSA_PKCS1_PADDING,
    },
    signature.signature,
  )) {
    throw new Error('signer signature is invalid');
  }
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length
    && timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function calculateApkV2ContentDigest(
  sections: ApkV2Sections,
) {
  const chunkDigests: Buffer[] = [];
  for (const section of [
    sections.beforeSigningBlock,
    sections.centralDirectory,
    sections.eocd,
  ]) {
    for (
      let offset = 0;
      offset < section.length;
      offset += APK_CONTENT_CHUNK_SIZE
    ) {
      const chunk = section.subarray(
        offset,
        Math.min(
          section.length,
          offset + APK_CONTENT_CHUNK_SIZE,
        ),
      );
      const header = Buffer.alloc(5);
      header[0] = 0xa5;
      header.writeUInt32LE(chunk.length, 1);
      chunkDigests.push(
        createHash('sha256')
          .update(header)
          .update(chunk)
          .digest(),
      );
    }
  }
  const header = Buffer.alloc(5);
  header[0] = 0x5a;
  header.writeUInt32LE(chunkDigests.length, 1);
  return createHash('sha256')
    .update(header)
    .update(Buffer.concat(chunkDigests))
    .digest();
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
