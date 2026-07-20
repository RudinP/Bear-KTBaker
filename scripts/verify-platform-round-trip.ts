import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import {
  createAndroidApkBuilder,
  createAndroidApkInspector,
} from "../electron/adapters/androidToolRunner";
import { createNodeFileSystemPort } from "../electron/adapters/nodeFileSystem";
import { parseThemeProjectRequest } from "../electron/ipc/requestValidation";
import type { DialogPort } from "../src/application/ports/dialog";
import type { ImageProcessorPort } from "../src/application/ports/imageProcessor";
import { createExportAndroidTheme } from "../src/application/theme/exportAndroidTheme";
import { createExportIosTheme } from "../src/application/theme/exportIosTheme";
import { createImportTheme } from "../src/application/theme/importTheme";
import { createDefaultTheme } from "../src/domain/theme/defaults";
import type { Platform, ThemeProject } from "../src/domain/theme/model";

function createPngImageProcessor(): ImageProcessorPort {
  const decode = (source: Uint8Array) => {
    try {
      return PNG.sync.read(Buffer.from(source));
    } catch {
      return null;
    }
  };

  return {
    dimensions(source) {
      const image = decode(source);
      return image ? { width: image.width, height: image.height } : null;
    },
    resizeToPng({ source, width, height }) {
      const image = decode(source);
      if (!image || width <= 0 || height <= 0) return null;
      const output = new PNG({ width, height });
      for (let y = 0; y < height; y += 1) {
        const sourceY = Math.min(
          image.height - 1,
          Math.floor((y * image.height) / height),
        );
        for (let x = 0; x < width; x += 1) {
          const sourceX = Math.min(
            image.width - 1,
            Math.floor((x * image.width) / width),
          );
          const sourceOffset = (sourceY * image.width + sourceX) * 4;
          const outputOffset = (y * width + x) * 4;
          image.data.copy(
            output.data,
            outputOffset,
            sourceOffset,
            sourceOffset + 4,
          );
        }
      }
      return new Uint8Array(PNG.sync.write(output));
    },
  };
}

function assertImportedProject(
  project: ThemeProject,
  platform: Platform,
  expectedName: string,
) {
  assert.equal(project.meta.name, expectedName);
  assert.ok(
    Object.keys(project.platformResources[platform]).length > 0,
    `${platform} import recovered no platform resources`,
  );
  assert.ok(
    !Object.hasOwn(project, "baseSample"),
    `${platform} import left baseSample as an own property`,
  );
  assert.doesNotThrow(() => parseThemeProjectRequest(structuredClone(project)));
}

async function main() {
  const root = process.cwd();
  const temporary = await mkdtemp(
    path.join(tmpdir(), "ktbaker-platform-round-trip-"),
  );
  const { files, paths } = createNodeFileSystemPort();
  const images = createPngImageProcessor();
  const templateDirectory = path.join(root, "resources", "templates");
  const selected = { save: "", open: "" };
  const dialogs: Pick<DialogPort, "selectSavePath" | "selectFile"> = {
    async selectSavePath() {
      return selected.save;
    },
    async selectFile() {
      return selected.open;
    },
  };
  const diagnostics: Error[] = [];
  const importTheme = createImportTheme({
    dialogs,
    files,
    paths,
    androidInspector: createAndroidApkInspector(),
  });
  const exportIosTheme = createExportIosTheme({
    dialogs,
    files,
    images,
    iosTemplatePath: path.join(templateDirectory, "ios-base.ktheme"),
  });
  const exportAndroidTheme = createExportAndroidTheme({
    dialogs,
    files,
    paths,
    images,
    androidBuilder: createAndroidApkBuilder(),
    diagnostics: {
      report(error) {
        diagnostics.push(error);
      },
    },
    androidSourceTemplatePath: path.join(
      templateDirectory,
      "android-source.zip",
    ),
    androidRuntimeDirectory: path.join(templateDirectory, "android-runtime"),
    signingIdentityPath: path.join(temporary, "android-signing-identity.json"),
  });

  try {
    const project = createDefaultTheme("플랫폼 왕복 검증 테마");
    project.meta.author = "Bear KTBaker";
    project.meta.version = "2.3.4";

    const iosFirst = path.join(temporary, "ios-first.ktheme");
    selected.save = iosFirst;
    assert.equal(await exportIosTheme(project), iosFirst);
    selected.open = iosFirst;
    const iosImported = await importTheme();
    assert.equal(iosImported?.kind, "ios");
    assertImportedProject(iosImported!.project, "ios", project.meta.name);

    const iosSecond = path.join(temporary, "ios-second.ktheme");
    selected.save = iosSecond;
    assert.equal(await exportIosTheme(iosImported!.project), iosSecond);
    selected.open = iosSecond;
    const iosReimported = await importTheme();
    assert.equal(iosReimported?.kind, "ios");
    assertImportedProject(iosReimported!.project, "ios", project.meta.name);

    const androidFirst = path.join(temporary, "android-first.apk");
    selected.save = androidFirst;
    assert.deepEqual(await exportAndroidTheme(project), { path: androidFirst });
    selected.open = androidFirst;
    const androidImported = await importTheme();
    assert.equal(androidImported?.kind, "android");
    assertImportedProject(
      androidImported!.project,
      "android",
      project.meta.name,
    );

    const androidSecond = path.join(temporary, "android-second.apk");
    selected.save = androidSecond;
    assert.deepEqual(await exportAndroidTheme(androidImported!.project), {
      path: androidSecond,
    });
    selected.open = androidSecond;
    const androidReimported = await importTheme();
    assert.equal(androidReimported?.kind, "android");
    assertImportedProject(
      androidReimported!.project,
      "android",
      project.meta.name,
    );

    assert.deepEqual(diagnostics, []);
    const results = await Promise.all(
      [iosFirst, iosSecond, androidFirst, androidSecond].map(
        async (filePath) => ({
          file: path.basename(filePath),
          bytes: (await stat(filePath)).size,
        }),
      ),
    );
    assert.ok(
      (await readFile(iosSecond)).length > 0 &&
        (await readFile(androidSecond)).length > 0,
    );
    console.log(
      JSON.stringify(
        {
          ios: {
            resources: Object.keys(iosReimported!.project.platformResources.ios)
              .length,
          },
          android: {
            resources: Object.keys(
              androidReimported!.project.platformResources.android,
            ).length,
          },
          ipcValidation: "passed-after-each-import",
          files: results,
        },
        null,
        2,
      ),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});
