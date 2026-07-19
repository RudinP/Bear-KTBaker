import { execFile } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AndroidApkInspectorPort } from '../../src/application/ports/androidApk';
import {
  inspectCompiledAndroidApk,
  type AndroidCompiledMetadata,
} from '../../src/io/androidCompiledMetadata';
import { ANDROID_SAMPLE_COLORS } from '../../src/manifest/kakaoColors';

const execFileAsync = promisify(execFile);

export interface AndroidToolRunnerDependencies {
  platform: NodeJS.Platform;
  environment: NodeJS.ProcessEnv;
  inspectCompiled(
    contents: Uint8Array,
  ): Promise<AndroidCompiledMetadata>;
  execute(
    executable: string,
    args: readonly string[],
    options: { maxBuffer: number },
  ): Promise<{ stdout: string }>;
}

export function createAndroidApkInspector(
  overrides: Partial<AndroidToolRunnerDependencies> = {},
): AndroidApkInspectorPort {
  const dependencies = createAndroidToolRunnerDependencies(overrides);
  return {
    async inspect(apkPath, apkContents) {
      const metadata = await tryInspectCompiledTable(
        apkContents,
        dependencies.inspectCompiled,
      );
      const needsColors = countKnownAndroidColors(metadata)
        < Object.keys(ANDROID_SAMPLE_COLORS).length;
      const needsManifest = hasMissingManifestMetadata(metadata);
      if (!needsColors && !needsManifest) return metadata;

      const tools = await findOptionalBuildTools(
        dependencies.platform,
        dependencies.environment,
      );
      if (needsColors && tools.aapt2) {
        await tryDumpCompiledColors(
          metadata,
          apkPath,
          tools.aapt2,
          dependencies.execute,
        );
      }
      if (needsManifest && tools.aapt) {
        await tryDumpManifestMetadata(
          metadata,
          apkPath,
          tools.aapt,
          dependencies.execute,
        );
      }
      return metadata;
    },
  };
}

function createAndroidToolRunnerDependencies(
  overrides: Partial<AndroidToolRunnerDependencies>,
): AndroidToolRunnerDependencies {
  return {
    platform: overrides.platform ?? process.platform,
    environment: overrides.environment ?? process.env,
    inspectCompiled: overrides.inspectCompiled
      ?? ((contents) => inspectCompiledAndroidApk(Buffer.from(contents))),
    execute: overrides.execute ?? (async (executable, args, options) => {
      const { stdout } = await execFileAsync(
        executable,
        [...args],
        options,
      );
      return { stdout: String(stdout) };
    }),
  };
}

async function tryInspectCompiledTable(
  contents: Uint8Array,
  inspect: AndroidToolRunnerDependencies['inspectCompiled'],
): Promise<AndroidCompiledMetadata> {
  try {
    return await inspect(contents);
  } catch {
    // Resource tables from uncommon Android toolchains may still be readable
    // through the optional SDK fallback.
    return {};
  }
}

function countKnownAndroidColors(metadata: AndroidCompiledMetadata): number {
  return Object.keys(metadata.colors ?? {}).filter(
    (name) => name in ANDROID_SAMPLE_COLORS,
  ).length;
}

function hasMissingManifestMetadata(
  metadata: AndroidCompiledMetadata,
): boolean {
  return !metadata.themeId
    || !metadata.version
    || !metadata.name
    || !metadata.appearance;
}

async function findOptionalBuildTools(
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv,
): Promise<{ aapt?: string; aapt2?: string }> {
  const sdk = environment.ANDROID_HOME
    || environment.ANDROID_SDK_ROOT
    || (platform === 'darwin'
      ? path.join(environment.HOME || '', 'Library/Android/sdk')
      : platform === 'win32'
        ? path.join(environment.LOCALAPPDATA || '', 'Android/Sdk')
        : path.join(environment.HOME || '', 'Android/Sdk'));
  let versions: string[];
  try {
    versions = (await readdir(path.join(sdk, 'build-tools')))
      .sort((left, right) =>
        right.localeCompare(left, undefined, { numeric: true }));
  } catch {
    // Build-tools are optional because archive image recovery can proceed
    // with partial or absent compiled metadata.
    return {};
  }

  const result: { aapt?: string; aapt2?: string } = {};
  for (const version of versions) {
    for (const name of ['aapt', 'aapt2'] as const) {
      if (result[name]) continue;
      const executable = `${name}${platform === 'win32' ? '.exe' : ''}`;
      const candidate = path.join(
        sdk,
        'build-tools',
        version,
        executable,
      );
      try {
        await access(candidate);
        result[name] = candidate;
      } catch {
        // Continue with the next installed build-tools version.
      }
    }
    if (result.aapt && result.aapt2) break;
  }
  return result;
}

async function tryDumpCompiledColors(
  metadata: AndroidCompiledMetadata,
  apkPath: string,
  aapt2: string,
  execute: AndroidToolRunnerDependencies['execute'],
): Promise<void> {
  try {
    const { stdout } = await execute(
      aapt2,
      ['dump', 'resources', apkPath],
      { maxBuffer: 20_000_000 },
    );
    metadata.colors = {
      ...parseCompiledColors(stdout),
      ...metadata.colors,
    };
  } catch {
    // Compiled colors are optional; keep built-in metadata and import images.
  }
}

async function tryDumpManifestMetadata(
  metadata: AndroidCompiledMetadata,
  apkPath: string,
  aapt: string,
  execute: AndroidToolRunnerDependencies['execute'],
): Promise<void> {
  try {
    const { stdout } = await execute(
      aapt,
      ['dump', 'badging', apkPath],
      { maxBuffer: 5_000_000 },
    );
    metadata.themeId ??= stdout.match(
      /^package:\s+name='([^']+)'/m,
    )?.[1];
    metadata.version ??= stdout.match(
      /^package:.*\bversionName='([^']+)'/m,
    )?.[1];
    metadata.name ??= stdout.match(
      /^application-label-ko:'([^']+)'/m,
    )?.[1] ?? stdout.match(/^application-label:'([^']+)'/m)?.[1];
  } catch {
    // Badging is optional; keep metadata already recovered.
  }

  if (metadata.appearance) return;
  try {
    const { stdout } = await execute(
      aapt,
      ['dump', 'xmltree', apkPath, 'AndroidManifest.xml'],
      { maxBuffer: 5_000_000 },
    );
    metadata.appearance =
      /com\.kakao\.talk\.theme_style[\s\S]{0,500}android:value[^\n]*["']dark["']/i
        .test(stdout)
        ? 'dark'
        : 'light';
  } catch {
    // Older build-tools may not expose manifest meta-data.
  }
}

function parseCompiledColors(output: string) {
  const colors: Record<string, string> = {};
  let current: string | undefined;
  for (const line of output.split(/\r?\n/)) {
    const resource = line.match(/\bcolor\/(theme_[a-z0-9_]+)/i)?.[1];
    if (resource) {
      current = resource;
      continue;
    }
    const value = current
      ? line.match(/^\s*\(\)\s+#([0-9a-f]{8})\s*$/i)?.[1]
      : undefined;
    if (!current || !value || !(current in ANDROID_SAMPLE_COLORS)) continue;
    colors[current] = value.slice(0, 2).toLowerCase() === 'ff'
      ? `#${value.slice(2).toUpperCase()}`
      : `#${value.toUpperCase()}`;
    current = undefined;
  }
  return colors;
}
