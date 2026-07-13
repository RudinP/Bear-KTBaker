import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import { _electron as electron } from 'playwright-core';

const OUTPUT_DIR = '/tmp/bear-ktbaker-promotion-export';
const OUTPUT_FILE = path.join(OUTPUT_DIR, '새 카카오톡 테마-홍보.png');
const PREVIEW_FILE = '/tmp/bear-ktbaker-promotion-preview.png';
const PROMOTION_BACKGROUND = '#c8d9e8';

function pixelAt(png: PNG, x: number, y: number) {
  const offset = (png.width * y + x) << 2;
  return Array.from(png.data.subarray(offset, offset + 4));
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  const executablePath = process.env.PROMOTION_TEST_EXECUTABLE;
  const userDataDir = `--user-data-dir=/tmp/bear-ktbaker-promotion-${process.pid}`;
  const app = await electron.launch(executablePath
    ? { executablePath, args: [userDataDir] }
    : { args: ['.', userDataDir] });
  try {
    const page = await app.firstWindow();
    const fontPath = process.env.PROMOTION_TEST_FONT
      ?? path.join(process.cwd(), 'src/assets/fonts/KakaoSmallSans-Light.woff2');
    const fontName = path.basename(fontPath).replace(/\.woff2$/i, '.ttf');
    const fontFamily = fontName.replace(/\.(?:otf|ttf)$/i, '');
    await page.getByRole('button', { name: '글씨체' }).click();
    await page.getByLabel('미리보기 폰트 파일').setInputFiles({
      name: fontName,
      mimeType: 'font/ttf',
      buffer: await readFile(fontPath),
    });
    await page.getByText(fontName, { exact: true }).waitFor();
    await page.getByRole('button', { name: '홍보 이미지' }).click();

    const close = page.getByRole('button', { name: '닫기' });
    const closeBox = await close.boundingBox();
    if (!closeBox) throw new Error('The promotional close button has no hit box.');
    await page.mouse.click(closeBox.x + 3, closeBox.y + 3);
    await page.getByRole('dialog', { name: '홍보 이미지 만들기' }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '홍보 이미지' }).click();

    const backgroundColor = page.getByLabel('홍보 이미지 배경색');
    await backgroundColor.evaluate((input, value) => {
      const color = input as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(color, value);
      color.dispatchEvent(new Event('input', { bubbles: true }));
      color.dispatchEvent(new Event('change', { bubbles: true }));
    }, PROMOTION_BACKGROUND);

    const poster = page.getByTestId('promotion-canvas');
    await poster.waitFor();
    const liveBackground = await poster.evaluate((element) => getComputedStyle(element).backgroundColor);
    if (liveBackground !== 'rgb(200, 217, 232)') {
      throw new Error(`Promotional background picker was not applied to the live poster: ${liveBackground}`);
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        })));
    });
    await page.waitForTimeout(250);

    const layout = await poster.evaluate((root) => [
      '.poster-heading h1',
      '.poster-section-heading b',
      '.mini-bubble-copy',
      '.poster-footer span',
    ].flatMap((selector) => [...root.querySelectorAll<HTMLElement>(selector)].map((element) => ({
      selector,
      text: element.textContent,
      width: element.offsetWidth,
      height: element.offsetHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      fontFamily: getComputedStyle(element).fontFamily,
    }))));
    for (const item of layout) {
      if (!item.fontFamily.includes(fontFamily)) {
        throw new Error(`Preview font was not applied to ${item.selector}: ${item.fontFamily}`);
      }
      if (item.scrollWidth > item.width) {
        throw new Error(`Preview text clips before export: ${JSON.stringify(item)}`);
      }
    }
    await poster.screenshot({ path: PREVIEW_FILE });

    await app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['/tmp/bear-ktbaker-promotion-export'] });
    });
    await page.getByRole('button', { name: 'PNG 저장' }).click();
    await page.getByRole('button', { name: 'PNG 저장' }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.screenshot-action.primary-button')?.textContent === 'PNG 저장');

    const png = PNG.sync.read(await readFile(OUTPUT_FILE));
    if (png.width !== 2000 || png.height !== 1600) {
      throw new Error(`Promotional PNG must be 2000x1600, received ${png.width}x${png.height}.`);
    }
    const exportedBackground = pixelAt(png, 1000, 80);
    if (exportedBackground.join(',') !== '200,217,232,255') {
      throw new Error(`Promotional background picker was not preserved in PNG export: ${exportedBackground.join(',')}`);
    }
    console.log(`Promotion export verified: ${OUTPUT_FILE}`);
    console.log(`Live poster capture: ${PREVIEW_FILE}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
