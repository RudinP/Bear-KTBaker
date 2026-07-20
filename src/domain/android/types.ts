import type { NinePatchGuides } from "../ninePatch";

export interface AndroidCompiledMetadata {
  colors?: Record<string, string>;
  resourceFiles?: Record<string, string[]>;
  name?: string;
  resourcePackage?: string;
  version?: string;
  themeId?: string;
  appearance?: "light" | "dark";
}

export interface AndroidImageExpectation {
  resourceId: string;
  sourcePath: string;
  resourceKey: string;
  semanticQualifier: string;
  ninePatch: boolean;
  width: number;
  height: number;
  pixelFingerprint: string;
  guides?: NinePatchGuides;
}
