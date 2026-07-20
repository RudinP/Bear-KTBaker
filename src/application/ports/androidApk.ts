import type {
  AndroidCompiledMetadata,
  AndroidImageExpectation,
} from '../../domain/android/types';

export interface AndroidApkInspectorPort {
  inspect(
    apkPath: string,
    apkContents: Uint8Array,
  ): Promise<AndroidCompiledMetadata>;
}

export interface AndroidApkBuildRequest {
  buildDirectory: string;
  outputPath: string;
  runtimeDirectory: string;
  signingIdentityPath: string;
  packageName: string;
  versionCode: number;
  versionName: string;
  expectedMetadata: {
    name: string;
    appearance: 'light' | 'dark';
    colors: Record<string, string>;
  };
  expectedImages: readonly AndroidImageExpectation[];
}

export interface AndroidApkBuilderPort {
  build(request: AndroidApkBuildRequest): Promise<void>;
}
