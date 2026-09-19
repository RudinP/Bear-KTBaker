import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { createAndroidApkBuilder } from '../electron/adapters/androidToolRunner';
import { createNodeFileSystemPort } from '../electron/adapters/nodeFileSystem';
import { standaloneRuntimePaths } from '../electron/adapters/androidStandaloneBuild';
import { createExportAndroidTheme } from '../src/application/theme/exportAndroidTheme';
import { createExportIosTheme } from '../src/application/theme/exportIosTheme';
import type { ImageProcessorPort } from '../src/application/ports/imageProcessor';
import { createDefaultTheme } from '../src/domain/theme/defaults';
import { inspectCompiledAndroidApk } from '../src/io/androidCompiledMetadata';

const images: ImageProcessorPort = {
  dimensions(source) {
    const png = PNG.sync.read(Buffer.from(source));
    return { width: png.width, height: png.height };
  },
  resizeToPng({ source, width, height }) {
    const input = PNG.sync.read(Buffer.from(source));
    const output = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (Math.floor(y * input.height / height) * input.width
          + Math.floor(x * input.width / width)) * 4;
        input.data.copy(output.data, (y * width + x) * 4, offset, offset + 4);
      }
    }
    return PNG.sync.write(output);
  },
};

async function main() {
  assert.ok(process.platform === 'darwin' || process.platform === 'win32');
  const directory = await mkdtemp(path.join(tmpdir(), 'ktb-openchat-'));
  const templates = path.resolve('resources/templates');
  const references = path.resolve('tests/fixtures/openchat-250204');
  const { files, paths } = createNodeFileSystemPort();
  let outputPath = '';
  const dialogs = { async selectSavePath() { return outputPath; } };
  const exportIos = createExportIosTheme({
    dialogs, files, images, iosTemplatePath: path.join(templates, 'ios-base.ktheme'),
  });
  const runtime = path.join(templates, 'android-runtime');
  const exportAndroid = createExportAndroidTheme({
    dialogs, files, paths, images,
    androidBuilder: createAndroidApkBuilder(),
    diagnostics: { report(error) { throw error; } },
    androidSourceTemplatePath: path.join(templates, 'android-source.zip'),
    androidRuntimeDirectory: runtime,
    signingIdentityPath: path.join(directory, 'identity.json'),
  });
  const project = createDefaultTheme('250204 open-chat verification');
  const expected = new Map<string, Buffer>();
  for (const tab of ['now', 'piccoma']) {
    for (const state of ['normal', 'selected']) {
      const id = `main.tab.${tab}.${state}`;
      const png = new PNG({ width: 114, height: 114 });
      const color = [tab === 'now' ? 231 : 37, state === 'normal' ? 61 : 197, 123, 255];
      for (let offset = 0; offset < png.data.length; offset += 4) png.data.set(color, offset);
      expected.set(id, Buffer.from(color));
      const asset = { fileName: `${tab}-${state}.png`, dataUrl: `data:image/png;base64,${PNG.sync.write(png).toString('base64')}` };
      for (const platform of ['ios', 'android'] as const) project.platformResources[platform][id] = asset;
    }
  }
  let checkedImages = 0;
  const assertColor = async (zip: JSZip, file: string, id: string) => {
    const entry = zip.file(file);
    assert.ok(entry, `missing ${file}`);
    const png = PNG.sync.read(await entry.async('nodebuffer'));
    const wanted = expected.get(id)!;
    for (let offset = 0; offset < png.data.length; offset += 4) {
      assert.deepEqual(png.data.subarray(offset, offset + 4), wanted, `${file} has another tab's pixels`);
    }
    checkedImages++;
  };
  try {
    // Exercise the untouched template as well as a project with distinct tab icons.
    for (const edited of [false, true]) {
      outputPath = path.join(directory, `${edited ? 'custom' : 'sample'}.ktheme`);
      await exportIos(edited ? project : createDefaultTheme());
      const zip = await JSZip.loadAsync(await readFile(outputPath));
      const css = await zip.file('KakaoTalkTheme.css')!.async('string');
      const sampleCss = await readFile(path.join(references, 'TabBarStyle-Main.css'), 'utf8');
      for (const state of ['normal', 'selected']) {
        const image = sampleCss.match(new RegExp(`-ios-view-${state}-icon-image:\\s*'([^']+)'`))![1];
        for (const key of ['view', 'openchats']) {
          assert.ok(css.includes(`-ios-${key}-${state}-icon-image: '${image}';`));
        }
        for (const scale of [2, 3]) {
          const view = `Images/${image.replace('.png', `@${scale}x.png`)}`;
          const now = view.replace('IcoView', 'IcoNow');
          assert.deepEqual(await zip.file(view)!.async('nodebuffer'), await zip.file(now)!.async('nodebuffer'));
          if (edited) {
            await assertColor(zip, view, `main.tab.now.${state}`);
            await assertColor(zip, now, `main.tab.now.${state}`);
            await assertColor(zip, view.replace('IcoView', 'IcoPiccoma'), `main.tab.piccoma.${state}`);
          }
        }
      }
    }
    outputPath = path.join(directory, 'custom.apk');
    await exportAndroid(project);
    const apk = await readFile(outputPath);
    const zip = await JSZip.loadAsync(apk);
    const metadata = await inspectCompiledAndroidApk(apk);
    const aapt2 = standaloneRuntimePaths(runtime).aapt2;
    const resources = execFileSync(aapt2, ['dump', 'resources', outputPath], { encoding: 'utf8' });
    for (const name of ['theme_tab_open_chat_icon', 'theme_tab_view_icon']) {
      const reference = await readFile(path.join(references, `${name}.xml`), 'utf8');
      const compiledPaths = metadata.resourceFiles?.[`drawable/${name}`];
      assert.ok(compiledPaths?.length, `missing compiled selector ${name}`);
      const tree = execFileSync(aapt2, ['dump', 'xmltree', outputPath, '--file', compiledPaths[0]], { encoding: 'utf8' });
      const wantedNames = [...reference.matchAll(/@drawable\/(\w+)/g)].map((match) => match[1]);
      const wantedIds = wantedNames.map((image) => {
        const id = resources.match(new RegExp(`resource (0x[0-9a-f]+) drawable/${image}\\b`))?.[1];
        assert.ok(id, `missing resource ID ${image}`);
        return id;
      });
      const actualIds = [...tree.matchAll(/android:drawable[^\n]*?=@(0x[0-9a-f]+)/g)].map((match) => match[1]);
      assert.deepEqual(actualIds, wantedIds, `${name} points at the wrong images`);
      assert.match(tree, /android:state_selected[^\n]*=true/);
    }
    for (const name of ['now', 'openchat', 'piccoma']) {
      for (const state of ['normal', 'selected']) {
        const key = `drawable/theme_maintab_ico_${name}${state === 'selected' ? '_focused' : ''}_image`;
        const imagePaths = metadata.resourceFiles?.[key];
        assert.equal(imagePaths?.length, 2, `${key} must have phone and tablet images`);
        for (const file of imagePaths!) await assertColor(zip, file, `main.tab.${name === 'piccoma' ? 'piccoma' : 'now'}.${state}`);
      }
    }
    console.log(JSON.stringify({ verified: true, checkedImages, legacyAndroidSelectors: 2, iosKeys: ['now', 'openchats', 'view'], piccomaIndependent: true }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
