import { sign as signWithPrivateKey } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ApkSignerV2 } from 'android-package-signer';
import JSZip from 'jszip';
import * as forge from 'node-forge';
import { describe, expect, it, vi } from 'vitest';
import {
  AndroidStandaloneBuildError,
  type AndroidSigningIdentity,
  buildStandaloneAapt2Plan,
  buildStandaloneAndroidApk,
  injectStandaloneDex,
  loadOrCreateSigningIdentity,
  signStandaloneApk,
  standaloneRuntimePaths,
  verifyStandaloneAndroidMetadata,
  verifyStandaloneApkSignatureV2,
  verifyStandaloneApkStructure,
} from './androidStandaloneBuild';
import { createAndroidImageExpectation } from '../../src/io/androidImageVerification';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('standalone Android APK build support', () => {
  it('resolves the universal macOS AAPT2 and shared runtime files', () => {
    expect(standaloneRuntimePaths('/Applications/Kakao Theme Studio.app/Contents/Resources/android-runtime', 'darwin')).toEqual({
      androidJar: '/Applications/Kakao Theme Studio.app/Contents/Resources/android-runtime/android.jar',
      classesDex: '/Applications/Kakao Theme Studio.app/Contents/Resources/android-runtime/classes.dex',
      aapt2: '/Applications/Kakao Theme Studio.app/Contents/Resources/android-runtime/bin/darwin/aapt2',
    });
  });

  it('resolves the x64 Windows AAPT2 without depending on Android Studio', () => {
    expect(standaloneRuntimePaths('C:\\Program Files\\KakaoTalk Theme Studio\\resources\\android-runtime', 'win32')).toEqual({
      androidJar: path.join('C:\\Program Files\\KakaoTalk Theme Studio\\resources\\android-runtime', 'android.jar'),
      classesDex: path.join('C:\\Program Files\\KakaoTalk Theme Studio\\resources\\android-runtime', 'classes.dex'),
      aapt2: path.join('C:\\Program Files\\KakaoTalk Theme Studio\\resources\\android-runtime', 'bin', 'win32', 'aapt2.exe'),
    });
  });

  it('builds an AAPT2 compile/link plan from all three official resource roots', () => {
    const plan = buildStandaloneAapt2Plan({
      buildDir: '/tmp/theme',
      outputPath: '/tmp/theme/unsigned.apk',
      runtime: standaloneRuntimePaths('/runtime', 'darwin'),
      packageName: 'com.example.prettytheme',
      versionCode: 20304,
      versionName: '2.3.4',
    });

    expect(plan.compile).toEqual([
      ['compile', '--dir', '/tmp/theme/src/main/res', '-o', '/tmp/theme/.standalone/res.zip'],
      ['compile', '--dir', '/tmp/theme/src/main/theme', '-o', '/tmp/theme/.standalone/theme.zip'],
      ['compile', '--dir', '/tmp/theme/src/main/theme-adv', '-o', '/tmp/theme/.standalone/theme-adv.zip'],
    ]);
    expect(plan.link).toEqual(expect.arrayContaining([
      '--manifest', '/tmp/theme/src/main/AndroidManifest.xml',
      '-I', '/runtime/android.jar',
      '--rename-manifest-package', 'com.example.prettytheme',
      '--rename-resources-package', 'com.example.prettytheme',
      '--version-code', '20304',
      '--version-name', '2.3.4',
    ]));
    expect(plan.link.slice(-3)).toEqual([
      '/tmp/theme/.standalone/res.zip',
      '/tmp/theme/.standalone/theme.zip',
      '/tmp/theme/.standalone/theme-adv.zip',
    ]);
  });

  it('rejects a compiled manifest package that differs from the requested theme identifier', () => {
    expect(() => verifyStandaloneAndroidMetadata({
      themeId: 'com.example.wrongmanifest',
      resourcePackage: 'com.example.prettytheme',
      appearance: 'light',
    }, {
      packageName: 'com.example.prettytheme',
    })).toThrow('manifest package');
  });

  it('rejects a compiled resources package that differs from the requested theme identifier', () => {
    expect(() => verifyStandaloneAndroidMetadata({
      themeId: 'com.example.prettytheme',
      resourcePackage: 'com.example.wrongresources',
      appearance: 'light',
    }, {
      packageName: 'com.example.prettytheme',
    })).toThrow('resources package');
  });

  it('compares Android colors as AARRGGBB while preserving meaningful alpha differences', () => {
    const metadata = {
      themeId: 'com.example.prettytheme',
      resourcePackage: 'com.example.prettytheme',
      appearance: 'light' as const,
      colors: { theme_header_color: '#123456' },
    };
    const expected = {
      packageName: 'com.example.prettytheme',
      colors: { theme_header_color: '#FF123456' },
    };

    expect(() => verifyStandaloneAndroidMetadata(metadata, expected)).not.toThrow();
    expect(() => verifyStandaloneAndroidMetadata(metadata, {
      ...expected,
      colors: { theme_header_color: '#7F123456' },
    })).toThrow('색상 1개');
  });

  it('creates one signing identity and reuses it for later exports', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'kakao-signing-'));
    const identityPath = path.join(directory, 'android-signing-identity.json');
    const generateKey = vi.fn().mockResolvedValue('data:application/x-pkcs12;base64,STABLE_KEY');
    const first = await loadOrCreateSigningIdentity(identityPath, {
      randomPassword: () => 'stable-password-value',
      generateKey,
    });
    const second = await loadOrCreateSigningIdentity(identityPath, {
      randomPassword: () => 'different-password',
      generateKey,
    });

    expect(first).toEqual(second);
    expect(generateKey).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await readFile(identityPath, 'utf8'))).toEqual(first);
  });

  it('returns the exact same persisted identity to concurrent first callers', async () => {
    const directory = await mkdtemp(path.join(
      tmpdir(),
      'kakao-signing-concurrent-',
    ));
    const identityPath = path.join(
      directory,
      'android-signing-identity.json',
    );
    let finishGeneration: ((value: string) => void) | undefined;
    const generated = new Promise<string>((resolve) => {
      finishGeneration = resolve;
    });
    const generateKey = vi.fn(() => generated);

    const firstPromise = loadOrCreateSigningIdentity(identityPath, {
      randomPassword: () => 'first-stable-password',
      generateKey,
    });
    const secondPromise = loadOrCreateSigningIdentity(identityPath, {
      randomPassword: () => 'second-losing-password',
      generateKey,
    });
    await vi.waitFor(() => expect(generateKey).toHaveBeenCalledOnce());
    finishGeneration?.(
      'data:application/x-pkcs12;base64,CONCURRENT_KEY',
    );
    const [first, second] = await Promise.all([
      firstPromise,
      secondPromise,
    ]);
    const persisted = JSON.parse(
      await readFile(identityPath, 'utf8'),
    );

    expect(first).toEqual(second);
    expect(persisted).toEqual(first);
    expect((await stat(identityPath)).mode & 0o777).toBe(0o600);
    expect(await readdir(directory)).toEqual([
      'android-signing-identity.json',
    ]);
  });

  it('re-reads and hardens an external winner after exclusive-create EEXIST', async () => {
    const directory = await mkdtemp(path.join(
      tmpdir(),
      'kakao-signing-external-winner-',
    ));
    const identityPath = path.join(
      directory,
      'android-signing-identity.json',
    );
    const winner = {
      schema: 1,
      alias: 'kakaotheme',
      password: 'external-winner-password',
      pkcs12DataUrl:
        'data:application/x-pkcs12;base64,EXTERNAL_WINNER',
    } as const;
    const generateKey = vi.fn(async () => {
      await writeFile(
        identityPath,
        `${JSON.stringify(winner)}\n`,
        { mode: 0o644, flag: 'wx' },
      );
      return 'data:application/x-pkcs12;base64,LOSING_KEY';
    });

    const identity = await loadOrCreateSigningIdentity(
      identityPath,
      {
        randomPassword: () => 'losing-password',
        generateKey,
      },
    );

    expect(identity).toEqual(winner);
    expect(JSON.parse(await readFile(identityPath, 'utf8')))
      .toEqual(winner);
    expect((await stat(identityPath)).mode & 0o777).toBe(0o600);
    expect(await readdir(directory)).toEqual([
      'android-signing-identity.json',
    ]);
  });

  it('waits for an external exclusive writer to finish before returning its identity', async () => {
    const directory = await mkdtemp(path.join(
      tmpdir(),
      'kakao-signing-incomplete-winner-',
    ));
    const identityPath = path.join(
      directory,
      'android-signing-identity.json',
    );
    const winner = {
      schema: 1,
      alias: 'kakaotheme',
      password: 'external-incomplete-winner',
      pkcs12DataUrl:
        'data:application/x-pkcs12;base64,COMPLETED_WINNER',
    } as const;
    let externalWriter:
      Awaited<ReturnType<typeof open>> | undefined;
    const waitForIdentityRetry = vi.fn(async () => {
      if (!externalWriter) throw new Error('missing writer');
      await externalWriter.writeFile(
        `${JSON.stringify(winner)}\n`,
      );
      await externalWriter.sync();
      await externalWriter.close();
      externalWriter = undefined;
    });

    const operation = loadOrCreateSigningIdentity(
      identityPath,
      {
        randomPassword: () => 'losing-password',
        generateKey: async () => {
          externalWriter = await open(
            identityPath,
            'wx',
            0o644,
          );
          return 'data:application/x-pkcs12;base64,LOSING_KEY';
        },
        waitForIdentityRetry,
      },
    );

    try {
      await expect(operation).resolves.toEqual(winner);
    } finally {
      await externalWriter?.close().catch(() => undefined);
    }
    expect(waitForIdentityRetry).toHaveBeenCalled();
    expect(JSON.parse(await readFile(identityPath, 'utf8')))
      .toEqual(winner);
    expect((await stat(identityPath)).mode & 0o777).toBe(0o600);
    expect(await readdir(directory)).toEqual([
      'android-signing-identity.json',
    ]);
  });

  it('times out on a crashed external writer without replacing it or leaving temp files', async () => {
    const directory = await mkdtemp(path.join(
      tmpdir(),
      'kakao-signing-crashed-winner-',
    ));
    const identityPath = path.join(
      directory,
      'android-signing-identity.json',
    );

    await expect(loadOrCreateSigningIdentity(
      identityPath,
      {
        randomPassword: () => 'losing-password',
        generateKey: async () => {
          const externalWriter = await open(
            identityPath,
            'wx',
            0o600,
          );
          await externalWriter.close();
          return 'data:application/x-pkcs12;base64,LOSING_KEY';
        },
        waitForIdentityRetry: async () => undefined,
      },
    )).rejects.toThrow('손상');

    expect(await readFile(identityPath)).toHaveLength(0);
    expect(await readdir(directory)).toEqual([
      'android-signing-identity.json',
    ]);
  });

  it('does not silently replace a damaged signing identity', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'kakao-signing-damaged-'));
    const identityPath = path.join(directory, 'android-signing-identity.json');
    await writeFile(identityPath, '{"schema":1,"password":"lost"}');

    await expect(loadOrCreateSigningIdentity(identityPath)).rejects.toThrow('서명 정보가 손상');
  });

  it('injects the precompiled runtime without rewriting compiled Android resources', async () => {
    const source = new JSZip();
    source.file('AndroidManifest.xml', Buffer.from('manifest'));
    source.file('resources.arsc', Buffer.from('resources'));
    const result = await injectStandaloneDex(
      await source.generateAsync({ type: 'nodebuffer', compression: 'STORE' }),
      Buffer.from('dex\n035\0runtime'),
    );
    const apk = await JSZip.loadAsync(result);

    expect(await apk.file('AndroidManifest.xml')?.async('string')).toBe('manifest');
    expect(await apk.file('resources.arsc')?.async('string')).toBe('resources');
    expect(await apk.file('classes.dex')?.async('string')).toBe('dex\n035\0runtime');
  });

  it('V2-signs an APK and validates its required standalone entries', async () => {
    const source = new JSZip();
    source.file('AndroidManifest.xml', Buffer.from('manifest'));
    source.file('resources.arsc', Buffer.from('resources'));
    source.file('classes.dex', Buffer.from('dex\n035\0runtime'));
    const unsigned = await source.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    const identityPath = path.join(await mkdtemp(path.join(tmpdir(), 'kakao-sign-apk-')), 'identity.json');
    const identity = await loadOrCreateSigningIdentity(identityPath);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const signed = await signStandaloneApk(unsigned, identity);

    await expect(verifyStandaloneApkStructure(signed)).resolves.toEqual({
      hasManifest: true,
      hasResources: true,
      hasRuntime: true,
    });
    expect(verifyStandaloneApkSignatureV2(signed))
      .toEqual({
      hasV2SigningBlock: true,
      algorithmId: 0x0103,
    });
    expect(log.mock.calls.some(([first]) => first === '<<<')).toBe(false);
    log.mockRestore();
  });

  it('keeps shared console and Blob patches active until overlapping signers succeed', async () => {
    const originalBlob = globalThis.Blob;
    const originalLog = console.log;
    const legacyBlob = class LegacyBlob {} as unknown as typeof Blob;
    const forwardedLog = vi.fn();
    const first = deferred<string>();
    const second = deferred<string>();
    let signerCall = 0;
    const signPackageV2 = vi.spyOn(
      ApkSignerV2.prototype,
      'signPackageV2',
    ).mockImplementation(() => {
      console.log('<<<', signerCall);
      console.log('forwarded', signerCall);
      return signerCall++ === 0 ? first.promise : second.promise;
    });
    Object.assign(globalThis, { Blob: legacyBlob });
    console.log = forwardedLog;

    try {
      const identity: AndroidSigningIdentity = {
        schema: 1,
        alias: 'kakaotheme',
        password: 'password',
        pkcs12DataUrl: 'data:application/x-pkcs12;base64,AA==',
      };
      const firstSigning = signStandaloneApk(
        Buffer.from('first'),
        identity,
      );
      const secondSigning = signStandaloneApk(
        Buffer.from('second'),
        identity,
      );

      first.resolve('data:application/zip;base64,RklSU1Q=');
      await expect(firstSigning).resolves.toEqual(
        Buffer.from('FIRST'),
      );
      const blobWhileSecondIsPending = globalThis.Blob;
      const logWhileSecondIsPending = console.log;
      second.resolve('data:application/zip;base64,U0VDT05E');
      await expect(secondSigning).resolves.toEqual(
        Buffer.from('SECOND'),
      );

      expect(signPackageV2).toHaveBeenCalledTimes(2);
      expect(blobWhileSecondIsPending).not.toBe(legacyBlob);
      expect(
        blobWhileSecondIsPending.prototype.arrayBuffer,
      ).toBeTypeOf('function');
      expect(logWhileSecondIsPending).not.toBe(forwardedLog);
      expect(forwardedLog).toHaveBeenCalledTimes(2);
      expect(forwardedLog).toHaveBeenNthCalledWith(
        1,
        'forwarded',
        0,
      );
      expect(forwardedLog).toHaveBeenNthCalledWith(
        2,
        'forwarded',
        1,
      );
      expect(globalThis.Blob).toBe(legacyBlob);
      expect(console.log).toBe(forwardedLog);
    } finally {
      signPackageV2.mockRestore();
      Object.assign(globalThis, { Blob: originalBlob });
      console.log = originalLog;
    }
  });

  it('restores the exact shared globals after the later overlapping signer fails', async () => {
    const originalBlob = globalThis.Blob;
    const originalLog = console.log;
    const legacyBlob = class LegacyBlob {} as unknown as typeof Blob;
    const forwardedLog = vi.fn();
    const first = deferred<string>();
    const second = deferred<string>();
    let signerCall = 0;
    const signPackageV2 = vi.spyOn(
      ApkSignerV2.prototype,
      'signPackageV2',
    ).mockImplementation(() =>
      signerCall++ === 0 ? first.promise : second.promise);
    Object.assign(globalThis, { Blob: legacyBlob });
    console.log = forwardedLog;

    try {
      const identity: AndroidSigningIdentity = {
        schema: 1,
        alias: 'kakaotheme',
        password: 'password',
        pkcs12DataUrl: 'data:application/x-pkcs12;base64,AA==',
      };
      const firstSigning = signStandaloneApk(
        Buffer.from('first'),
        identity,
      );
      const secondSigning = signStandaloneApk(
        Buffer.from('second'),
        identity,
      );

      first.resolve('data:application/zip;base64,RklSU1Q=');
      await expect(firstSigning).resolves.toEqual(
        Buffer.from('FIRST'),
      );
      second.reject(new Error('second signer failed'));
      await expect(secondSigning).rejects.toThrow(
        'second signer failed',
      );

      expect(globalThis.Blob).toBe(legacyBlob);
      expect(console.log).toBe(forwardedLog);
    } finally {
      signPackageV2.mockRestore();
      Object.assign(globalThis, { Blob: originalBlob });
      console.log = originalLog;
    }
  });

  it('rejects an unsigned ZIP even when runtime contents contain the signing magic', async () => {
    const source = new JSZip();
    source.file('AndroidManifest.xml', Buffer.from('manifest'));
    source.file('resources.arsc', Buffer.from('resources'));
    source.file(
      'classes.dex',
      Buffer.from('dex APK Sig Block 42 decoy'),
    );
    const unsigned = await source.generateAsync({
      type: 'nodebuffer',
      compression: 'STORE',
    });

    await expect(verifyStandaloneApkStructure(unsigned))
      .resolves.toEqual({
        hasManifest: true,
        hasResources: true,
        hasRuntime: true,
      });
    expect(() => verifyStandaloneApkSignatureV2(unsigned))
      .toThrow('서명');
  });

  it('rejects malformed, truncated, relocated, and content-tampered V2 blocks', async () => {
    const signed = await createSignedFixture();
    const magic = Buffer.from('APK Sig Block 42', 'ascii');
    const magicOffset = signed.lastIndexOf(magic);
    expect(magicOffset).toBeGreaterThan(0);

    const malformed = Buffer.from(signed);
    malformed[magicOffset - 8] ^= 0x01;

    const relocated = Buffer.from(signed);
    const eocdOffset = findEocd(relocated);
    relocated.writeUInt32LE(
      relocated.readUInt32LE(eocdOffset + 16) + 1,
      eocdOffset + 16,
    );

    const tampered = Buffer.from(signed);
    tampered[0] ^= 0x01;

    for (const invalid of [
      malformed,
      signed.subarray(0, signed.length - 1),
      relocated,
      tampered,
    ]) {
      expect(() => verifyStandaloneApkSignatureV2(invalid))
        .toThrow('서명');
    }
  });

  it('rejects more than one otherwise-valid V2 signer', async () => {
    const signed = await createSignedFixture();
    expectVerificationFailureCause(
      addExtraV2Signer(signed),
      'expected exactly one v2 signer',
    );
  });

  it('rejects matching extra signature and digest algorithms even when the supported signature is renewed', async () => {
    const fixture = await createSignedFixtureWithIdentity();
    const mutated = resignFirstV2Signature(
      addExtraV2Algorithm(fixture.signed),
      fixture.identity,
    );

    expectVerificationFailureCause(
      mutated,
      'unsupported signer algorithm shape',
    );
  });

  it('rejects signed data containing an extra certificate', async () => {
    const fixture = await createSignedFixtureWithIdentity();
    const mutated = resignFirstV2Signature(
      addExtraV2Certificate(fixture.signed),
      fixture.identity,
    );

    expectVerificationFailureCause(
      mutated,
      'expected exactly one signer certificate',
    );
  });

  it('rejects signed data containing no signer certificate', async () => {
    const fixture = await createSignedFixtureWithIdentity();
    const mutated = resignFirstV2Signature(
      removeSoleV2Certificate(fixture.signed),
      fixture.identity,
    );

    expectVerificationFailureCause(
      mutated,
      'expected exactly one signer certificate',
    );
  });

  it('rejects signed data containing nonempty additional attributes', async () => {
    const fixture = await createSignedFixtureWithIdentity();
    const mutated = resignFirstV2Signature(
      addV2AdditionalAttribute(fixture.signed),
      fixture.identity,
    );

    expectVerificationFailureCause(
      mutated,
      'additional signer attributes are unsupported',
    );
  });

  it('rejects a malformed sole signer certificate', async () => {
    const signed = await createSignedFixture();
    const malformed = Buffer.from(signed);
    const layout = locateV2Layout(malformed);
    const certificate = lengthPrefixedAt(
      malformed,
      layout.certificates.start,
    );
    malformed[certificate.start] ^= 0xff;

    expect(() => verifyStandaloneApkSignatureV2(malformed))
      .toThrow('서명');
  });

  it('runs AAPT2, injects the runtime, signs, validates, and writes one final APK', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'kakao-standalone-build-'));
    const buildDir = path.join(directory, 'source');
    const runtimeDir = path.join(directory, 'runtime');
    const outputPath = path.join(directory, 'pretty-theme.apk');
    const identityPath = path.join(directory, 'identity.json');
    const compiledFixture = Buffer.from(
      (await readFile(path.join(process.cwd(), 'src/io/fixtures/compiled-theme-metadata.apk.b64'), 'utf8')).replace(/\s/g, ''),
      'base64',
    );
    for (const resourceRoot of ['res', 'theme', 'theme-adv']) {
      await mkdir(path.join(buildDir, 'src', 'main', resourceRoot), { recursive: true });
    }
    await writeFile(path.join(buildDir, 'src', 'main', 'AndroidManifest.xml'), '<manifest />');
    await mkdir(path.join(runtimeDir, 'bin', 'darwin'), { recursive: true });
    await writeFile(path.join(runtimeDir, 'bin', 'darwin', 'aapt2'), 'binary');
    await writeFile(path.join(runtimeDir, 'android.jar'), 'android');
    await writeFile(path.join(runtimeDir, 'classes.dex'), 'dex\n035\0runtime');
    const calls: string[][] = [];
    const run = vi.fn(async (_executable: string, args: string[]) => {
      calls.push(args);
      if (args[0] !== 'link') return;
      await writeFile(args[args.indexOf('-o') + 1], compiledFixture);
    });

    const result = await buildStandaloneAndroidApk({
      buildDir,
      outputPath,
      runtimeDir,
      identityPath,
      packageName: 'com.example.standalonefixture',
      versionCode: 100,
      versionName: '7.8.9',
      expectedMetadata: {
        name: '독립 테마',
        appearance: 'dark',
        colors: { theme_header_color: '#FF123456' },
      },
      platform: 'darwin',
      run,
    });

    expect(result).toBe(outputPath);
    expect(calls.map((args) => args[0])).toEqual(['compile', 'compile', 'compile', 'link']);
    expect(verifyStandaloneApkSignatureV2(
      await readFile(outputPath),
    )).toMatchObject({ hasV2SigningBlock: true });
  });

  it('stops before writing when an expected compiled image is absent', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'kakao-standalone-image-check-'));
    const buildDir = path.join(directory, 'source');
    const runtimeDir = path.join(directory, 'runtime');
    const outputPath = path.join(directory, 'must-not-exist.apk');
    for (const resourceRoot of ['res', 'theme', 'theme-adv']) {
      await mkdir(path.join(buildDir, 'src', 'main', resourceRoot), { recursive: true });
    }
    await writeFile(path.join(buildDir, 'src', 'main', 'AndroidManifest.xml'), '<manifest />');
    await mkdir(path.join(runtimeDir, 'bin', 'darwin'), { recursive: true });
    await writeFile(path.join(runtimeDir, 'bin', 'darwin', 'aapt2'), 'binary');
    await writeFile(path.join(runtimeDir, 'android.jar'), 'android');
    await writeFile(path.join(runtimeDir, 'classes.dex'), 'dex\n035\0runtime');
    const compiledFixture = Buffer.from(
      (await readFile(path.join(process.cwd(), 'src/io/fixtures/compiled-theme-metadata.apk.b64'), 'utf8'))
        .replace(/\s/g, ''),
      'base64',
    );
    const sourcePng = await readFile(path.join(
      process.cwd(),
      'public/sample/apeach/android/theme_background_image.png',
    ));
    const expectation = createAndroidImageExpectation(
      'main.background',
      'src/main/theme/drawable-xxhdpi/theme_background_image.png',
      sourcePng,
      false,
    )!;
    const run = vi.fn(async (_executable: string, args: string[]) => {
      if (args[0] === 'link') await writeFile(args[args.indexOf('-o') + 1], compiledFixture);
    });

    await expect(buildStandaloneAndroidApk({
      buildDir,
      outputPath,
      runtimeDir,
      identityPath: path.join(directory, 'identity.json'),
      packageName: 'com.example.standalonefixture',
      versionCode: 70_809,
      versionName: '7.8.9',
      expectedMetadata: { name: '독립 테마', appearance: 'dark' },
      expectedImages: [expectation],
      platform: 'darwin',
      run,
    })).rejects.toMatchObject({
      name: 'AndroidStandaloneBuildError',
      stage: 'verify',
      cause: expect.objectContaining({
        message: expect.stringContaining('main.background'),
      }),
    });
    await expect(readFile(outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('stops before writing when the compiled resources package does not match the requested identifier', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'kakao-standalone-package-check-'));
    const buildDir = path.join(directory, 'source');
    const runtimeDir = path.join(directory, 'runtime');
    const outputPath = path.join(directory, 'must-not-exist.apk');
    await mkdir(path.join(runtimeDir, 'bin', 'darwin'), { recursive: true });
    await writeFile(path.join(runtimeDir, 'bin', 'darwin', 'aapt2'), 'binary');
    await writeFile(path.join(runtimeDir, 'android.jar'), 'android');
    await writeFile(path.join(runtimeDir, 'classes.dex'), 'dex\n035\0runtime');

    const fixture = Buffer.from(
      (await readFile(path.join(process.cwd(), 'src/io/fixtures/compiled-theme-metadata.apk.b64'), 'utf8')).replace(/\s/g, ''),
      'base64',
    );
    const fixtureZip = await JSZip.loadAsync(fixture);
    const manifest = await fixtureZip.file('AndroidManifest.xml')!.async('nodebuffer');
    const resources = await fixtureZip.file('resources.arsc')!.async('nodebuffer');
    const original = Buffer.from('com.example.standalonefixture', 'utf16le');
    const replacement = Buffer.from('com.example.wrongresourcexxxx', 'utf16le');
    const packageOffset = resources.indexOf(original);
    expect(packageOffset).toBeGreaterThanOrEqual(0);
    replacement.copy(resources, packageOffset);
    const mismatchedApk = new JSZip();
    mismatchedApk.file('AndroidManifest.xml', manifest);
    mismatchedApk.file('resources.arsc', resources);
    const compiled = await mismatchedApk.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    const run = vi.fn(async (_executable: string, args: string[]) => {
      if (args[0] === 'link') await writeFile(args[args.indexOf('-o') + 1], compiled);
    });

    await expect(buildStandaloneAndroidApk({
      buildDir,
      outputPath,
      runtimeDir,
      identityPath: path.join(directory, 'identity.json'),
      packageName: 'com.example.standalonefixture',
      versionCode: 70_809,
      versionName: '7.8.9',
      platform: 'darwin',
      run,
    })).rejects.toMatchObject({
      name: 'AndroidStandaloneBuildError',
      stage: 'verify',
      cause: expect.objectContaining({
        message: expect.stringContaining('resources package'),
      }),
    });
    await expect(readFile(outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('classifies a missing standalone runtime as runtime', async () => {
    const directory = await mkdtemp(path.join(
      tmpdir(),
      'kakao-standalone-runtime-stage-',
    ));

    await expect(buildStandaloneAndroidApk({
      buildDir: path.join(directory, 'source'),
      outputPath: path.join(directory, 'theme.apk'),
      runtimeDir: path.join(directory, 'missing-runtime'),
      identityPath: path.join(directory, 'identity.json'),
      packageName: 'com.example.theme',
      versionCode: 1,
      versionName: '1.0.0',
      platform: 'darwin',
    })).rejects.toMatchObject({
      name: 'AndroidStandaloneBuildError',
      stage: 'runtime',
    });
  });

  it.each([0, 1, 2])(
    'classifies compile command %d and keeps safe process fields',
    async (failedCompile) => {
      const fixture = await stageFixture(
        `compile-stage-${failedCompile}`,
      );
      const failure = Object.assign(
        new Error('unsafe command details'),
        {
          code: 19,
          signal: 'SIGTERM',
          stdout: '/private/unsafe/project',
        },
      );
      let compileIndex = 0;
      const run = vi.fn(
        async (_executable: string, args: string[]) => {
          if (
            args[0] === 'compile'
            && compileIndex++ === failedCompile
          ) {
            throw failure;
          }
        },
      );

      await expect(buildStandaloneAndroidApk({
        ...fixture.request,
        run,
      })).rejects.toMatchObject({
        name: 'AndroidStandaloneBuildError',
        stage: 'compile',
        exitCode: 19,
        signal: 'SIGTERM',
        cause: failure,
      });
    },
  );

  it('preserves a nested standalone build error unchanged', async () => {
    const fixture = await stageFixture('nested-stage');
    const nested = new AndroidStandaloneBuildError({
      stage: 'verify',
      message: 'already classified',
      exitCode: 3,
    });

    let failure: unknown;
    try {
      await buildStandaloneAndroidApk({
        ...fixture.request,
        run: vi.fn().mockRejectedValue(nested),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBe(nested);
  });

  it('classifies the link command separately from compile commands', async () => {
    const fixture = await stageFixture('link-stage');
    const run = vi.fn(async (_executable: string, args: string[]) => {
      if (args[0] === 'link') throw new Error('link failed');
    });

    await expect(buildStandaloneAndroidApk({
      ...fixture.request,
      run,
    })).rejects.toMatchObject({
      name: 'AndroidStandaloneBuildError',
      stage: 'link',
    });
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('classifies damaged signing identity loading separately', async () => {
    const fixture = await stageFixture('identity-stage');
    await writeFile(fixture.request.identityPath, '{"schema":1}');
    const compiled = await compiledFixture();

    await expect(buildStandaloneAndroidApk({
      ...fixture.request,
      run: linkFixture(compiled),
    })).rejects.toMatchObject({
      name: 'AndroidStandaloneBuildError',
      stage: 'signing-identity',
    });
  });

  it('classifies package signing separately', async () => {
    const fixture = await stageFixture('sign-stage');
    await writeFile(
      fixture.request.identityPath,
      JSON.stringify({
        schema: 1,
        alias: 'kakaotheme',
        password: 'stable-password',
        pkcs12DataUrl:
          'data:application/x-pkcs12;base64,SU5WQUxJRA==',
      }),
    );
    const compiled = await compiledFixture();

    await expect(buildStandaloneAndroidApk({
      ...fixture.request,
      run: linkFixture(compiled),
    })).rejects.toMatchObject({
      name: 'AndroidStandaloneBuildError',
      stage: 'sign',
    });
  });
});

async function stageFixture(name: string) {
  const directory = await mkdtemp(path.join(
    tmpdir(),
    `kakao-standalone-${name}-`,
  ));
  const buildDir = path.join(directory, 'source');
  const runtimeDir = path.join(directory, 'runtime');
  await mkdir(path.join(runtimeDir, 'bin', 'darwin'), {
    recursive: true,
  });
  await writeFile(
    path.join(runtimeDir, 'bin', 'darwin', 'aapt2'),
    'binary',
  );
  await writeFile(path.join(runtimeDir, 'android.jar'), 'android');
  await writeFile(
    path.join(runtimeDir, 'classes.dex'),
    'dex\n035\0runtime',
  );
  return {
    request: {
      buildDir,
      outputPath: path.join(directory, 'theme.apk'),
      runtimeDir,
      identityPath: path.join(directory, 'identity.json'),
      packageName: 'com.example.standalonefixture',
      versionCode: 70_809,
      versionName: '7.8.9',
      platform: 'darwin' as const,
    },
  };
}

async function compiledFixture() {
  return Buffer.from(
    (await readFile(path.join(
      process.cwd(),
      'src/io/fixtures/compiled-theme-metadata.apk.b64',
    ), 'utf8')).replace(/\s/g, ''),
    'base64',
  );
}

function linkFixture(compiled: Buffer) {
  return vi.fn(async (_executable: string, args: string[]) => {
    if (args[0] === 'link') {
      await mkdir(path.dirname(args[args.indexOf('-o') + 1]), {
        recursive: true,
      });
      await writeFile(args[args.indexOf('-o') + 1], compiled);
    }
  });
}

async function createSignedFixture() {
  return (await createSignedFixtureWithIdentity()).signed;
}

async function createSignedFixtureWithIdentity() {
  const source = new JSZip();
  source.file('AndroidManifest.xml', Buffer.from('manifest'));
  source.file('resources.arsc', Buffer.from('resources'));
  source.file('classes.dex', Buffer.from('dex\n035\0runtime'));
  const unsigned = await source.generateAsync({
    type: 'nodebuffer',
    compression: 'STORE',
  });
  const identityPath = path.join(
    await mkdtemp(path.join(tmpdir(), 'kakao-v2-verify-')),
    'identity.json',
  );
  const identity = await loadOrCreateSigningIdentity(identityPath);
  const log = vi.spyOn(console, 'log')
    .mockImplementation(() => undefined);
  try {
    return {
      signed: await signStandaloneApk(unsigned, identity),
      identity,
    };
  } finally {
    log.mockRestore();
  }
}

function findEocd(apk: Buffer) {
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  return apk.lastIndexOf(signature);
}

interface LengthPrefixedRange {
  lengthOffset: number;
  start: number;
  end: number;
}

interface V2FixtureLayout {
  blockStart: number;
  footerOffset: number;
  centralDirectoryOffset: number;
  eocdOffset: number;
  pairLengthOffset: number;
  signers: LengthPrefixedRange;
  signer: LengthPrefixedRange;
  signedData: LengthPrefixedRange;
  signatures: LengthPrefixedRange;
  digests: LengthPrefixedRange;
  certificates: LengthPrefixedRange;
  attributes: LengthPrefixedRange;
}

function locateV2Layout(apk: Buffer): V2FixtureLayout {
  const eocdOffset = findEocd(apk);
  const centralDirectoryOffset = apk.readUInt32LE(
    eocdOffset + 16,
  );
  const footerOffset = centralDirectoryOffset - 24;
  const blockSize = Number(apk.readBigUInt64LE(footerOffset));
  const blockStart =
    centralDirectoryOffset - blockSize - 8;
  const pairLengthOffset = blockStart + 8;
  expect(apk.readUInt32LE(pairLengthOffset + 8))
    .toBe(0x7109871a);

  const signers = lengthPrefixedAt(
    apk,
    pairLengthOffset + 12,
  );
  const signer = lengthPrefixedAt(apk, signers.start);
  const signedData = lengthPrefixedAt(apk, signer.start);
  const signatures = lengthPrefixedAt(apk, signedData.end);
  const digests = lengthPrefixedAt(apk, signedData.start);
  const certificates = lengthPrefixedAt(apk, digests.end);
  const attributes = lengthPrefixedAt(
    apk,
    certificates.end,
  );
  return {
    blockStart,
    footerOffset,
    centralDirectoryOffset,
    eocdOffset,
    pairLengthOffset,
    signers,
    signer,
    signedData,
    signatures,
    digests,
    certificates,
    attributes,
  };
}

function lengthPrefixedAt(
  bytes: Buffer,
  lengthOffset: number,
): LengthPrefixedRange {
  const length = bytes.readUInt32LE(lengthOffset);
  const start = lengthOffset + 4;
  return {
    lengthOffset,
    start,
    end: start + length,
  };
}

function addExtraV2Signer(apk: Buffer) {
  const layout = locateV2Layout(apk);
  const signerRecord = apk.subarray(
    layout.signer.lengthOffset,
    layout.signer.end,
  );
  return insertSigningBlockBytes(
    apk,
    layout.signers.end,
    signerRecord,
    [layout.signers.lengthOffset],
  );
}

function addExtraV2Algorithm(apk: Buffer) {
  let mutated = Buffer.from(apk);
  let layout = locateV2Layout(mutated);
  const digest = lengthPrefixedAt(
    mutated,
    layout.digests.start,
  );
  const extraDigest = Buffer.from(mutated.subarray(
    digest.lengthOffset,
    digest.end,
  ));
  extraDigest.writeUInt32LE(0x0104, 4);
  mutated = insertSigningBlockBytes(
    mutated,
    layout.digests.end,
    extraDigest,
    [
      layout.digests.lengthOffset,
      layout.signedData.lengthOffset,
      layout.signer.lengthOffset,
      layout.signers.lengthOffset,
    ],
  );

  layout = locateV2Layout(mutated);
  const signature = lengthPrefixedAt(
    mutated,
    layout.signatures.start,
  );
  const extraSignature = Buffer.from(mutated.subarray(
    signature.lengthOffset,
    signature.end,
  ));
  extraSignature.writeUInt32LE(0x0104, 4);
  return insertSigningBlockBytes(
    mutated,
    layout.signatures.end,
    extraSignature,
    [
      layout.signatures.lengthOffset,
      layout.signer.lengthOffset,
      layout.signers.lengthOffset,
    ],
  );
}

function addExtraV2Certificate(apk: Buffer) {
  const layout = locateV2Layout(apk);
  const certificate = lengthPrefixedAt(
    apk,
    layout.certificates.start,
  );
  const extraCertificate = apk.subarray(
    certificate.lengthOffset,
    certificate.end,
  );
  return insertSigningBlockBytes(
    apk,
    layout.certificates.end,
    extraCertificate,
    [
      layout.certificates.lengthOffset,
      layout.signedData.lengthOffset,
      layout.signer.lengthOffset,
      layout.signers.lengthOffset,
    ],
  );
}

function removeSoleV2Certificate(apk: Buffer) {
  const layout = locateV2Layout(apk);
  const certificate = lengthPrefixedAt(
    apk,
    layout.certificates.start,
  );
  return removeSigningBlockBytes(
    apk,
    certificate.lengthOffset,
    certificate.end,
    [
      layout.certificates.lengthOffset,
      layout.signedData.lengthOffset,
      layout.signer.lengthOffset,
      layout.signers.lengthOffset,
    ],
  );
}

function addV2AdditionalAttribute(apk: Buffer) {
  const layout = locateV2Layout(apk);
  const attribute = Buffer.alloc(8);
  attribute.writeUInt32LE(4, 0);
  attribute.writeUInt32LE(0x1234abcd, 4);
  return insertSigningBlockBytes(
    apk,
    layout.attributes.start,
    attribute,
    [
      layout.attributes.lengthOffset,
      layout.signedData.lengthOffset,
      layout.signer.lengthOffset,
      layout.signers.lengthOffset,
    ],
  );
}

function insertSigningBlockBytes(
  apk: Buffer,
  insertionOffset: number,
  inserted: Uint8Array,
  uint32LengthOffsets: number[],
) {
  const layout = locateV2Layout(apk);
  const addition = Buffer.from(inserted);
  const result = Buffer.concat([
    apk.subarray(0, insertionOffset),
    addition,
    apk.subarray(insertionOffset),
  ]);
  for (const lengthOffset of uint32LengthOffsets) {
    result.writeUInt32LE(
      apk.readUInt32LE(lengthOffset) + addition.length,
      lengthOffset,
    );
  }
  const blockSize = apk.readBigUInt64LE(layout.blockStart)
    + BigInt(addition.length);
  result.writeBigUInt64LE(blockSize, layout.blockStart);
  result.writeBigUInt64LE(
    blockSize,
    layout.footerOffset + addition.length,
  );
  result.writeBigUInt64LE(
    apk.readBigUInt64LE(layout.pairLengthOffset)
      + BigInt(addition.length),
    layout.pairLengthOffset,
  );
  result.writeUInt32LE(
    layout.centralDirectoryOffset + addition.length,
    layout.eocdOffset + addition.length + 16,
  );
  return result;
}

function removeSigningBlockBytes(
  apk: Buffer,
  removalStart: number,
  removalEnd: number,
  uint32LengthOffsets: number[],
) {
  const layout = locateV2Layout(apk);
  const removedLength = removalEnd - removalStart;
  const result = Buffer.concat([
    apk.subarray(0, removalStart),
    apk.subarray(removalEnd),
  ]);
  for (const lengthOffset of uint32LengthOffsets) {
    result.writeUInt32LE(
      apk.readUInt32LE(lengthOffset) - removedLength,
      lengthOffset,
    );
  }
  const blockSize = apk.readBigUInt64LE(layout.blockStart)
    - BigInt(removedLength);
  result.writeBigUInt64LE(blockSize, layout.blockStart);
  result.writeBigUInt64LE(
    blockSize,
    layout.footerOffset - removedLength,
  );
  result.writeBigUInt64LE(
    apk.readBigUInt64LE(layout.pairLengthOffset)
      - BigInt(removedLength),
    layout.pairLengthOffset,
  );
  result.writeUInt32LE(
    layout.centralDirectoryOffset - removedLength,
    layout.eocdOffset - removedLength + 16,
  );
  return result;
}

function resignFirstV2Signature(
  apk: Buffer,
  identity: AndroidSigningIdentity,
) {
  const result = Buffer.from(apk);
  const layout = locateV2Layout(result);
  const signatureRecord = lengthPrefixedAt(
    result,
    layout.signatures.start,
  );
  const signatureValue = lengthPrefixedAt(
    result,
    signatureRecord.start + 4,
  );
  const pkcs12Base64 = identity.pkcs12DataUrl.split(
    'base64,',
  )[1];
  const pkcs12 = forge.pkcs12.pkcs12FromAsn1(
    forge.asn1.fromDer(forge.util.decode64(pkcs12Base64)),
    identity.password,
  );
  const privateKey = pkcs12.getBags({
    friendlyName: identity.alias,
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  }).friendlyName?.[0]?.key;
  if (!privateKey) throw new Error('fixture key missing');
  const signature = signWithPrivateKey(
    'sha256',
    result.subarray(
      layout.signedData.start,
      layout.signedData.end,
    ),
    forge.pki.privateKeyToPem(privateKey),
  );
  expect(signature).toHaveLength(
    signatureValue.end - signatureValue.start,
  );
  signature.copy(result, signatureValue.start);
  return result;
}

function expectVerificationFailureCause(
  apk: Buffer,
  message: string,
) {
  let failure: unknown;
  try {
    verifyStandaloneApkSignatureV2(apk);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error & { cause?: unknown }).cause)
    .toMatchObject({ message });
}
