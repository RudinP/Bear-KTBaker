export type StandaloneAndroidPlatform = 'darwin' | 'win32';

export type AndroidStandaloneBuildStage =
  | 'runtime'
  | 'compile'
  | 'link'
  | 'signing-identity'
  | 'sign'
  | 'verify';

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
