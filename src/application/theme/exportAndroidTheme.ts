import type { ThemeProject } from '../../domain/theme/model';
import {
  decodeArchiveEntries,
  type ArchiveEntry,
} from '../../io/archiveEntries';
import {
  prepareStandaloneAndroidManifest,
} from '../../io/androidStandaloneManifest';
import {
  buildAndroidColorsXml,
  buildAndroidManifest,
  buildAndroidStringsXml,
} from '../../io/androidTheme';
import {
  normalizeThemeStudioError,
} from '../errors/ThemeStudioError';
import type { AndroidApkBuilderPort } from '../ports/androidApk';
import type { DiagnosticReporter } from '../ports/diagnostics';
import type { DialogPort } from '../ports/dialog';
import type { FileSystemPort, PathPort } from '../ports/fileSystem';
import type { ImageProcessorPort } from '../ports/imageProcessor';
import {
  androidPackageId,
  androidVersionCode,
  androidVersionName,
} from './androidPackageMetadata';
import { renderAndroidImages } from './renderAndroidImages';

export type ExportAndroidTheme = (
  project: ThemeProject,
) => Promise<{ path: string } | null>;

export interface ExportAndroidThemeDependencies {
  dialogs: Pick<DialogPort, 'selectSavePath'>;
  files: FileSystemPort;
  paths: PathPort;
  images: ImageProcessorPort;
  androidBuilder: AndroidApkBuilderPort;
  diagnostics: DiagnosticReporter;
  androidSourceTemplatePath: string;
  androidRuntimeDirectory: string;
  signingIdentityPath: string;
}

export function createExportAndroidTheme(
  dependencies: ExportAndroidThemeDependencies,
): ExportAndroidTheme {
  return async (project) => {
    const destination = await dependencies.dialogs.selectSavePath({
      title: 'Android 테마 저장',
      defaultPath: `${project.meta.name}.apk`,
      filters: [{
        name: '카카오톡 Android 테마',
        extensions: ['apk'],
      }],
    });
    if (!destination) return null;

    let buildDirectory: string | undefined;
    try {
      buildDirectory = await runAndroidExportStage(
        () => dependencies.files.createTemporaryDirectory(
          'ktbaker-android-',
        ),
        {
          code: 'KTB-FS-TEMP',
          stage: 'Android 임시 폴더 생성',
          message: 'Android 임시 작업 폴더를 만들지 못했습니다.',
        },
      );
      const template = await runAndroidExportStage(
        () => dependencies.files.readBytes(
          dependencies.androidSourceTemplatePath,
        ),
        {
          code: 'KTB-FS-READ',
          stage: 'Android 템플릿 읽기',
          message: 'Android 테마 템플릿을 읽지 못했습니다.',
        },
      );
      const entries = await runAndroidExportStage(
        () => decodeArchiveEntries(template),
        {
          code: 'KTB-FS-READ',
          stage: 'Android 템플릿 압축 읽기',
          message: 'Android 테마 템플릿 압축을 읽지 못했습니다.',
        },
      );
      await runAndroidExportStage(
        () => extractAndroidTemplate(
          entries,
          buildDirectory!,
          dependencies.files,
          dependencies.paths,
        ),
        {
          code: 'KTB-FS-WRITE',
          stage: 'Android 템플릿 압축 해제',
          message: 'Android 테마 템플릿을 준비하지 못했습니다.',
        },
      );
      await runAndroidExportStage(
        () => writeAndroidProjectMetadata({
          buildDirectory: buildDirectory!,
          project,
          files: dependencies.files,
          paths: dependencies.paths,
        }),
        {
          code: 'KTB-FS-WRITE',
          stage: 'Android 메타데이터 생성',
          message: 'Android 테마 메타데이터를 만들지 못했습니다.',
        },
      );
      const expectedImages = await renderAndroidImages({
        buildDirectory,
        project,
        files: dependencies.files,
        paths: dependencies.paths,
        images: dependencies.images,
      });
      const verifiedApk = dependencies.paths.join(
        buildDirectory,
        'verified-theme.apk',
      );
      await dependencies.androidBuilder.build({
        buildDirectory,
        outputPath: verifiedApk,
        runtimeDirectory: dependencies.androidRuntimeDirectory,
        signingIdentityPath: dependencies.signingIdentityPath,
        packageName: androidPackageId(project.meta.themeId),
        versionCode: androidVersionCode(project.meta.version),
        versionName: androidVersionName(project.meta.version),
        expectedMetadata: {
          name: project.meta.name,
          appearance: project.meta.appearance,
          colors: project.colorValues.android,
        },
        expectedImages,
      });
      await runAndroidExportStage(
        () => dependencies.files.copyFile(
          verifiedApk,
          destination,
        ),
        {
          code: 'KTB-FS-WRITE',
          stage: 'Android APK 파일 복사',
          message: '완성된 Android APK를 저장하지 못했습니다.',
        },
      );
      return { path: destination };
    } catch (error) {
      throw normalizeThemeStudioError(error, {
        code: 'KTB-UNKNOWN-UNEXPECTED',
        operation: 'theme:export-android',
        stage: 'Android 테마 내보내기',
        message: 'Android 테마를 내보내지 못했습니다.',
      });
    } finally {
      if (buildDirectory) {
        await cleanupTemporaryDirectory(
          buildDirectory,
          dependencies.files,
          dependencies.diagnostics,
        );
      }
    }
  };
}

async function extractAndroidTemplate(
  entries: readonly ArchiveEntry[],
  buildDirectory: string,
  files: FileSystemPort,
  paths: PathPort,
) {
  for (const entry of entries) {
    const destination = paths.join(
      buildDirectory,
      entry.relativePath,
    );
    if (entry.directory) {
      await files.ensureDirectory(destination);
      continue;
    }
    await files.ensureDirectory(paths.dirname(destination));
    await files.writeBytes(
      destination,
      entry.contents ?? new Uint8Array(),
    );
  }
}

async function writeAndroidProjectMetadata({
  buildDirectory,
  project,
  files,
  paths,
}: {
  buildDirectory: string;
  project: ThemeProject;
  files: FileSystemPort;
  paths: PathPort;
}) {
  const colorsPath = paths.join(
    buildDirectory,
    'src/main/theme/values/colors.xml',
  );
  await files.writeText(
    colorsPath,
    buildAndroidColorsXml(
      project,
      await files.readText(colorsPath),
    ),
  );
  const manifestPath = paths.join(
    buildDirectory,
    'src/main/AndroidManifest.xml',
  );
  await files.writeText(
    manifestPath,
    prepareStandaloneAndroidManifest(
      buildAndroidManifest(
        project,
        await files.readText(manifestPath),
      ),
    ),
  );
  const strings = buildAndroidStringsXml(project);
  for (const relativePath of [
    'src/main/theme/values/strings.xml',
    'src/main/theme/values-ko/strings.xml',
  ]) {
    const destination = paths.join(
      buildDirectory,
      relativePath,
    );
    await files.ensureDirectory(paths.dirname(destination));
    await files.writeText(destination, strings);
  }
}

async function runAndroidExportStage<T>(
  work: () => Promise<T>,
  fallback: {
    code: 'KTB-FS-READ' | 'KTB-FS-WRITE' | 'KTB-FS-TEMP';
    stage: string;
    message: string;
  },
) {
  try {
    return await work();
  } catch (cause) {
    throw normalizeThemeStudioError(cause, {
      ...fallback,
      operation: 'theme:export-android',
    });
  }
}

async function cleanupTemporaryDirectory(
  buildDirectory: string,
  files: FileSystemPort,
  diagnostics: DiagnosticReporter,
) {
  try {
    await files.removeDirectory(buildDirectory);
  } catch (cause) {
    diagnostics.report(
      normalizeThemeStudioError(cause, {
        code: 'KTB-FS-TEMP',
        operation: 'theme:export-android',
        stage: 'Android 임시 폴더 정리',
        message: 'Android 임시 작업 폴더를 정리하지 못했습니다.',
      }),
    );
  }
}
