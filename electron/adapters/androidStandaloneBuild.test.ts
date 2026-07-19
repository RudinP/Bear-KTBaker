import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import {
  AndroidStandaloneBuildError,
  buildStandaloneAapt2Plan,
  buildStandaloneAndroidApk,
  injectStandaloneDex,
  loadOrCreateSigningIdentity,
  signStandaloneApk,
  standaloneRuntimePaths,
  verifyStandaloneAndroidMetadata,
  verifyStandaloneApkStructure,
} from './androidStandaloneBuild';
import { createAndroidImageExpectation } from '../../src/io/androidImageVerification';

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
      hasV2SigningBlock: true,
    });
    expect(log.mock.calls.some(([first]) => first === '<<<')).toBe(false);
    log.mockRestore();
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
    await expect(verifyStandaloneApkStructure(await readFile(outputPath))).resolves.toMatchObject({ hasV2SigningBlock: true });
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
