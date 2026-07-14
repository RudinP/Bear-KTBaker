import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';

type Rect = { x: number; y: number; width: number; height: number };
type Crop = Rect;
type PixelPredicate = (red: number, green: number, blue: number, x: number, y: number) => boolean;

const REFERENCE_FILE = path.join(process.cwd(), 'tests/fixtures/android-chatroom-26.5-reference.png');
// The supplied reference includes a white guide bezel. Only the 360×760
// KakaoTalk viewport is compared; no device/status UI is part of this crop.
const REFERENCE_VIEWPORT: Crop = { x: 17, y: 27, width: 540, height: 1140 };
const ACTUAL_VIEWPORT: Crop = { x: 0, y: 0, width: 540, height: 1140 };
const DECORATED_IOS_BUBBLE = {
  source: { width: 344, height: 375 },
  stretch: { x: [99, 102] as const, y: [285, 288] as const },
  content: { left: 33, right: 158, top: 225, bottom: 345 },
  scale: 3,
};

function closeTo(actual: number, expected: number, label: string, tolerance = 3) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: reference ${expected}px, preview ${actual}px (tolerance ${tolerance}px)`);
  }
}

async function createDecoratedIosTheme(file: string) {
  const template = await JSZip.loadAsync(await readFile(path.join(process.cwd(), 'resources/templates/ios-base.ktheme')));
  const image = new PNG(DECORATED_IOS_BUBBLE.source);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      const body = x >= 20 && x <= 175 && y >= 205 && y <= 360;
      const decoration = x >= 145 && x <= 335 && y >= 25 && y <= 245;
      if (!body && !decoration) continue;
      image.data.set(body ? [215, 226, 207, 255] : [188, 209, 183, 255], offset);
    }
  }
  const bubblePng = PNG.sync.write(image);
  for (const name of [
    'chatroomBubbleSend01@3x.png',
    'chatroomBubbleSend01Selected@3x.png',
    'chatroomBubbleSend02@3x.png',
    'chatroomBubbleSend02Selected@3x.png',
  ]) template.file(`Images/${name}`, bubblePng);
  const cssFile = template.file('KakaoTalkTheme.css');
  if (!cssFile) throw new Error('iOS runtime fixture is missing KakaoTalkTheme.css');
  const css = (await cssFile.async('string'))
    .replace(/('chatroomBubbleSend0[12](?:Selected)?\.png') 17px 17px/g, '$1 33px 95px')
    .replace('-ios-title-edgeinsets: 10px 11px 7px 17px;', '-ios-title-edgeinsets: 75px 11px 10px 62px;')
    .replace('-ios-group-title-edgeinsets: 10px 11px 7px 17px;', '-ios-group-title-edgeinsets: 75px 11px 10px 62px;');
  template.file('KakaoTalkTheme.css', css);
  await writeFile(file, await template.generateAsync({ type: 'nodebuffer' }));
}

function components(image: PNG, crop: Crop, predicate: PixelPredicate) {
  const mask = new Uint8Array(crop.width * crop.height);
  const seen = new Uint8Array(mask.length);
  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const offset = ((crop.y + y) * image.width + crop.x + x) * 4;
      mask[y * crop.width + x] = predicate(image.data[offset], image.data[offset + 1], image.data[offset + 2], x, y) ? 1 : 0;
    }
  }

  const result: Array<Rect & { pixels: number }> = [];
  for (let origin = 0; origin < mask.length; origin += 1) {
    if (!mask[origin] || seen[origin]) continue;
    const stack = [origin];
    seen[origin] = 1;
    let minX = crop.width;
    let minY = crop.height;
    let maxX = 0;
    let maxY = 0;
    let pixels = 0;
    while (stack.length) {
      const current = stack.pop()!;
      const y = Math.floor(current / crop.width);
      const x = current - y * crop.width;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      pixels += 1;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= crop.width || nextY < 0 || nextY >= crop.height) continue;
        const next = nextY * crop.width + nextX;
        if (!mask[next] || seen[next]) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    if (pixels > 20) result.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, pixels });
  }
  return result.sort((left, right) => right.pixels - left.pixels);
}

function bubbleRects(image: PNG, crop: Crop, side: 'me' | 'you') {
  const matches = side === 'me'
    ? components(image, crop, (red, green, blue, x, y) => (
      x > 300 && y > 250 && y < 550
      && red > 220 && red <= 255 && green > 90 && green < 180 && blue > 90 && blue < 180
    )).filter((rect) => rect.width >= 50 && rect.height >= 25)
    : components(image, crop, (red, green, blue, x, y) => (
      x < 320 && y > 100 && y < 400 && red > 245 && green > 245 && blue > 245
    )).filter((rect) => rect.width >= 60 && rect.height >= 25);
  const expectedCount = side === 'me' ? 2 : 3;
  const sorted = matches.sort((left, right) => left.y - right.y).slice(0, expectedCount);
  if (sorted.length !== expectedCount) throw new Error(`${side} bubble detection failed: ${JSON.stringify(matches)}`);
  return sorted;
}

function textRect(image: PNG, crop: Crop, bubble: Rect, side: 'me' | 'you') {
  let minX = crop.width;
  let minY = crop.height;
  let maxX = -1;
  let maxY = -1;
  let pixels = 0;
  // Ten raster pixels exclude the anti-aliased .9.png outline and tail. The
  // remaining bounds describe text only, so padding is measured independently
  // from the bubble border.
  for (let y = bubble.y + 10; y < bubble.y + bubble.height - 10; y += 1) {
    for (let x = bubble.x + 10; x < bubble.x + bubble.width - 10; x += 1) {
      const offset = ((crop.y + y) * image.width + crop.x + x) * 4;
      const red = image.data[offset];
      const green = image.data[offset + 1];
      const blue = image.data[offset + 2];
      const isText = side === 'you'
        ? red < 160 && green < 160 && blue < 160
        : red > 240 && green > 190 && blue > 190;
      if (!isText) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      pixels += 1;
    }
  }
  if (maxX < minX || maxY < minY) throw new Error(`Text detection failed inside ${JSON.stringify(bubble)}`);
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, pixels };
}

function isBubbleFill(image: PNG, crop: Crop, side: 'me' | 'you', x: number, y: number) {
  const offset = ((crop.y + y) * image.width + crop.x + x) * 4;
  const red = image.data[offset];
  const green = image.data[offset + 1];
  const blue = image.data[offset + 2];
  return side === 'me'
    ? red > 220 && red <= 255 && green > 90 && green < 180 && blue > 90 && blue < 180
    : red > 245 && green > 245 && blue > 245;
}

function bubbleEdgeProfile(image: PNG, crop: Crop, bubble: Rect, side: 'me' | 'you') {
  return Array.from({ length: bubble.height }, (_, relativeY) => {
    let left = bubble.width;
    let right = -1;
    for (let relativeX = 0; relativeX < bubble.width; relativeX += 1) {
      if (!isBubbleFill(image, crop, side, bubble.x + relativeX, bubble.y + relativeY)) continue;
      left = Math.min(left, relativeX);
      right = Math.max(right, relativeX);
    }
    return right >= 0 ? { left, right: right + 1 } : undefined;
  });
}

function compareBubbleSilhouette(actualImage: PNG, referenceImage: PNG, actual: Rect, reference: Rect, side: 'me' | 'you', label: string) {
  const actualEdges = bubbleEdgeProfile(actualImage, ACTUAL_VIEWPORT, actual, side);
  const referenceEdges = bubbleEdgeProfile(referenceImage, REFERENCE_VIEWPORT, reference, side);
  const errors: number[] = [];
  for (let referenceY = 0; referenceY < reference.height; referenceY += 1) {
    const actualY = Math.round(referenceY * (actual.height - 1) / Math.max(1, reference.height - 1));
    const actualEdge = actualEdges[actualY];
    const referenceEdge = referenceEdges[referenceY];
    if (!actualEdge || !referenceEdge) continue;
    const horizontalScale = reference.width / actual.width;
    errors.push(
      Math.abs(actualEdge.left * horizontalScale - referenceEdge.left),
      Math.abs(actualEdge.right * horizontalScale - referenceEdge.right),
    );
  }
  if (!errors.length) throw new Error(`${label} silhouette detection failed`);
  errors.sort((left, right) => left - right);
  const percentile95 = errors[Math.floor(errors.length * 0.95)];
  // The single raster row where a bubble tail meets the body may map to the
  // neighbouring row when two captures differ by one pixel in height. Keep
  // that row visible in p95 while using a trimmed mean for the whole contour.
  const trimmed = errors.slice(0, Math.max(1, Math.ceil(errors.length * 0.95)));
  const trimmedMean = trimmed.reduce((total, value) => total + value, 0) / trimmed.length;
  closeTo(trimmedMean, 0, `${label} silhouette trimmed mean edge error`, 1.25);
  closeTo(percentile95, 0, `${label} silhouette p95 edge error`, 4.05);
}

function compareRect(actual: Rect, reference: Rect, label: string, tolerance = 3) {
  closeTo(actual.x, reference.x, `${label}.x`, tolerance);
  closeTo(actual.y, reference.y, `${label}.y`, tolerance);
  closeTo(actual.width, reference.width, `${label}.width`, tolerance);
  closeTo(actual.height, reference.height, `${label}.height`, tolerance);
}

function compareBubbleSet(actualImage: PNG, referenceImage: PNG, side: 'me' | 'you') {
  const actual = bubbleRects(actualImage, ACTUAL_VIEWPORT, side);
  const reference = bubbleRects(referenceImage, REFERENCE_VIEWPORT, side);
  actual.forEach((bubble, index) => {
    compareRect(bubble, reference[index], `${side}[${index}] bubble`, 4);
    compareBubbleSilhouette(actualImage, referenceImage, bubble, reference[index], side, `${side}[${index}]`);
    const actualText = textRect(actualImage, ACTUAL_VIEWPORT, bubble, side);
    const referenceText = textRect(referenceImage, REFERENCE_VIEWPORT, reference[index], side);
    // The reference is a raster capture from Android while Electron uses
    // Chromium font rasterisation. Geometry/padding stay strict; glyph ink
    // bounds allow antialiasing variance.
    compareRect(actualText, referenceText, `${side}[${index}] text`, 7);
    const actualCoverage = actualText.pixels / (actualText.width * actualText.height);
    const referenceCoverage = referenceText.pixels / (referenceText.width * referenceText.height);
    closeTo(actualCoverage, referenceCoverage, `${side}[${index}] glyph-ink-coverage`, 0.08);
    closeTo(actualText.x - bubble.x, referenceText.x - reference[index].x, `${side}[${index}] padding-left`, 4);
    closeTo(actualText.y - bubble.y, referenceText.y - reference[index].y, `${side}[${index}] padding-top`, 4);
    closeTo(
      bubble.x + bubble.width - (actualText.x + actualText.width),
      reference[index].x + reference[index].width - (referenceText.x + referenceText.width),
      `${side}[${index}] padding-right`,
      6,
    );
    closeTo(
      bubble.y + bubble.height - (actualText.y + actualText.height),
      reference[index].y + reference[index].height - (referenceText.y + referenceText.height),
      `${side}[${index}] padding-bottom`,
      7,
    );
  });
}

async function verifyAreaEditorAspectRatio(page: Page, platform: 'iPhone' | 'Android', source: { width: number; height: number }) {
  await page.getByRole('button', { name: platform }).click();
  await page.getByRole('button', { name: '채팅방', exact: true }).click();
  const mainMetrics = await page.locator('.kt-bubble.sent-first').evaluate((bubble) => {
    const style = getComputedStyle(bubble);
    const copy = bubble.querySelector<HTMLElement>('.kt-bubble-copy');
    const bubbleBounds = bubble.getBoundingClientRect();
    const copyBounds = copy?.getBoundingClientRect();
    const scaleX = bubbleBounds.width / (bubble as HTMLElement).offsetWidth;
    const scaleY = bubbleBounds.height / (bubble as HTMLElement).offsetHeight;
    const contentCenter = {
      x: (bubbleBounds.left + Number.parseFloat(style.paddingLeft) * scaleX
        + bubbleBounds.right - Number.parseFloat(style.paddingRight) * scaleX) / 2,
      y: (bubbleBounds.top + Number.parseFloat(style.paddingTop) * scaleY
        + bubbleBounds.bottom - Number.parseFloat(style.paddingBottom) * scaleY) / 2,
    };
    return {
      height: (bubble as HTMLElement).offsetHeight,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      maxWidth: style.maxWidth,
      copyContentCenterOffset: copyBounds ? {
        x: (copyBounds.left + copyBounds.right) / 2 - contentCenter.x,
        y: (copyBounds.top + copyBounds.bottom) / 2 - contentCenter.y,
      } : undefined,
    };
  });
  if (platform === 'iPhone') {
    if (!mainMetrics.copyContentCenterOffset) throw new Error('iPhone short bubble copy bounds are missing.');
    closeTo(mainMetrics.copyContentCenterOffset.x, 0, 'iPhone short bubble content-frame horizontal center', 0.2);
    closeTo(mainMetrics.copyContentCenterOffset.y, 0, 'iPhone short bubble content-frame vertical center', 0.2);
  }
  const groupedHeight = await page.locator('.kt-bubble.sent-group').first().evaluate((bubble) => (bubble as HTMLElement).offsetHeight);
  await page.locator('.kt-bubble.sent-first').click();
  const stateMetrics = await page.locator('.bubble-states').evaluate((panel) => (
    [...panel.querySelectorAll<HTMLElement>('.state-cell .mini-bubble')].map((bubble) => {
      const style = getComputedStyle(bubble);
      return {
        height: bubble.offsetHeight,
        width: bubble.offsetWidth,
        scrollWidth: bubble.scrollWidth,
        scrollHeight: bubble.scrollHeight,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        maxWidth: style.maxWidth,
        kind: bubble.closest('.state-cell')?.className ?? '',
      };
    })
  ));
  if (stateMetrics.length !== 5) {
    throw new Error(`${platform} state panel must render all five bubble cases; found ${stateMetrics.length}`);
  }
  for (const [index, metric] of stateMetrics.entries()) {
    if (
      metric.fontSize !== mainMetrics.fontSize
      || metric.fontWeight !== mainMetrics.fontWeight
      || metric.lineHeight !== mainMetrics.lineHeight
      || metric.maxWidth !== mainMetrics.maxWidth
    ) {
      throw new Error(
        `${platform} state bubble[${index}] drifted from the verified main bubble: `
        + `${metric.fontSize}/${metric.fontWeight}/${metric.lineHeight}/${metric.maxWidth}`,
      );
    }
    if (metric.scrollWidth > metric.width || metric.scrollHeight > metric.height) {
      throw new Error(`${platform} state bubble[${index}] clips its content: ${JSON.stringify(metric)}`);
    }
  }
  closeTo(stateMetrics[0].height, mainMetrics.height, `${platform} short-state height`, 0.01);
  closeTo(stateMetrics[3].height, groupedHeight, `${platform} grouped-state height`, 0.01);
  closeTo(stateMetrics[4].height, mainMetrics.height, `${platform} pressed-state height`, 0.01);
  await page.getByRole('button', { name: '보낸 첫 말풍선 영역 조정' }).click();
  const sourceLabel = platform === 'iPhone'
    ? `${source.width} × ${source.height}px 원본 · @3x 기준`
    : `${source.width} × ${source.height}px 원본 기준`;
  await page.getByText(sourceLabel, { exact: true }).waitFor();
  const rect = await page.locator('.patch-canvas').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  closeTo(rect.width / rect.height, source.width / source.height, `${platform} area editor aspect ratio`, 0.002);
  if (rect.width > 520.01 || rect.height > 340.01) {
    throw new Error(`${platform} area editor exceeds its bounds: ${rect.width}x${rect.height}`);
  }
  const editorContract = await page.locator('.patch-stage').evaluate((element) => ({
    mode: element.getAttribute('data-editor-mode'),
    androidEdges: element.querySelectorAll('[data-nine-patch-edge]').length,
    androidHandles: element.querySelectorAll('[data-nine-patch-marker-handle]').length,
    iosGuides: element.querySelectorAll('[data-ios-inset-guide]').length,
    iosDerivedGuides: element.querySelectorAll('[data-ios-inset-guide].derived').length,
    iosEditableStretchGuides: element.querySelectorAll('button[data-ios-inset-guide][data-guide-kind="stretch"]').length,
  }));
  if (platform === 'Android') {
    if (
      editorContract.mode !== 'android-nine-patch'
      || editorContract.androidEdges !== 4
      || editorContract.androidHandles !== 8
      || editorContract.iosGuides !== 0
    ) {
      throw new Error(`Android editor is not a four-edge .9.png editor: ${JSON.stringify(editorContract)}`);
    }
  } else if (
    editorContract.mode !== 'ios-inset'
    || editorContract.androidEdges !== 0
    || editorContract.androidHandles !== 0
    || editorContract.iosGuides !== 8
    || editorContract.iosDerivedGuides !== 2
    || editorContract.iosEditableStretchGuides !== 2
  ) {
    throw new Error(`iOS editor is not an inset editor: ${JSON.stringify(editorContract)}`);
  }
  const closeButton = page.getByRole('button', { name: '완료' });
  const closeBounds = await closeButton.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  if (closeBounds.height < 44) {
    throw new Error(`${platform} area editor close target is smaller than 44px: ${JSON.stringify(closeBounds)}`);
  }
  await closeButton.click({ position: { x: 3, y: closeBounds.height / 2 } });
}

async function selectAndroidChatroom(page: Page) {
  await page.getByRole('button', { name: 'Android' }).click();
  await page.getByRole('button', { name: '채팅방', exact: true }).click();
  await page.locator('.kt-android-chatroom').waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      })));
  });
}

async function verifyIosTitleInsetsAndContainment(page: Page) {
  await page.getByRole('button', { name: 'iPhone' }).click();
  await page.getByRole('button', { name: '채팅방', exact: true }).click();

  for (const bubbleClass of ['received-first', 'sent-first'] as const) {
    const phoneBubble = page.locator(`.kt-bubble.${bubbleClass}`).first();
    const phoneMetric = await phoneBubble.evaluate((bubble) => ({
      placement: bubble.querySelector<HTMLElement>('.kt-bubble-copy')?.dataset.iosLabelPlacement,
      transform: getComputedStyle(bubble.querySelector<HTMLElement>('.kt-bubble-copy')!).transform,
    }));
    if (phoneMetric.placement !== 'title-edge-insets' || phoneMetric.transform !== 'none') {
      throw new Error(`iPhone ${bubbleClass} remapped its authored title edge insets: ${JSON.stringify(phoneMetric)}`);
    }

    await phoneBubble.click();
    const panel = page.locator('.bubble-states[data-platform="ios"]');
    await panel.waitFor();
    const metrics = await panel.locator('.mini-bubble').evaluateAll((bubbles) => bubbles.map((bubble) => {
      const element = bubble as HTMLElement;
      const copy = element.querySelector<HTMLElement>('.mini-bubble-copy')!;
      const style = getComputedStyle(element);
      return {
        mode: element.dataset.contentMode,
        text: copy.textContent,
        placement: copy.dataset.iosLabelPlacement,
        transform: getComputedStyle(copy).transform,
        width: element.clientWidth,
        height: element.clientHeight,
        copy: { x: copy.offsetLeft, y: copy.offsetTop, width: copy.offsetWidth, height: copy.offsetHeight },
        padding: {
          top: Number.parseFloat(style.paddingTop),
          right: Number.parseFloat(style.paddingRight),
          bottom: Number.parseFloat(style.paddingBottom),
          left: Number.parseFloat(style.paddingLeft),
        },
      };
    }));
    for (const metric of metrics) {
      closeTo(metric.copy.x, metric.padding.left, `${bubbleClass} ${metric.text} title left`, 0.51);
      closeTo(metric.copy.y, metric.padding.top, `${bubbleClass} ${metric.text} title top`, 0.51);
      if (
        metric.transform !== 'none'
        || metric.width + 0.51 < metric.padding.left + metric.copy.width + metric.padding.right
        || metric.height + 0.51 < metric.padding.top + metric.copy.height + metric.padding.bottom
      ) {
        throw new Error(`iPhone ${bubbleClass} text escaped its title insets: ${JSON.stringify(metric)}`);
      }
      if (metric.mode === 'single-line' && metric.placement !== 'title-edge-insets') {
        throw new Error(`iPhone ${bubbleClass} single-line state lacks the title-inset contract: ${JSON.stringify(metric)}`);
      }
    }
  }
}

async function verifyWorkspaceZoomContainment(page: Page) {
  for (let step = 0; step < 6; step += 1) {
    await page.getByRole('button', { name: '미리보기 확대' }).click();
  }
  const bounds = await page.evaluate(() => {
    let promotion: DOMRect | undefined;
    for (const element of document.querySelectorAll<HTMLElement>('.screen-item')) {
      if (element.textContent?.includes('홍보 이미지')) {
        promotion = element.getBoundingClientRect();
        break;
      }
    }
    return {
      viewportHeight: window.innerHeight,
      editor: document.querySelector('.editor-layout')?.getBoundingClientRect(),
      workspace: document.querySelector('.preview-workspace')?.getBoundingClientRect(),
      stepper: document.querySelector('.preview-zoom-controls')?.getBoundingClientRect(),
      promotion,
    };
  });
  if (!bounds.editor || !bounds.workspace || !bounds.stepper || !bounds.promotion) {
    throw new Error(`130% zoom containment landmarks are missing: ${JSON.stringify(bounds)}`);
  }
  const bottomLimit = Math.min(bounds.viewportHeight, bounds.editor.bottom) + 0.5;
  if (
    bounds.workspace.bottom > bottomLimit
    || bounds.stepper.bottom > bottomLimit
    || bounds.promotion.bottom > bottomLimit
  ) {
    throw new Error(`130% zoom escaped the editor viewport: ${JSON.stringify(bounds)}`);
  }
  for (let step = 0; step < 6; step += 1) {
    await page.getByRole('button', { name: '미리보기 축소' }).click();
  }
}

async function verifyApplicationZoomContainment(app: ElectronApplication, page: Page) {
  const originalBounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getBounds());
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]!;
    window.setSize(1060, 710);
    window.webContents.setZoomFactor(1.3);
  });
  await page.waitForTimeout(120);
  const bounds = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    toolbarActions: document.querySelector('.toolbar-actions')?.getBoundingClientRect(),
    promotion: [...document.querySelectorAll<HTMLElement>('.screen-item')]
      .find((element) => element.textContent?.includes('홍보 이미지'))?.getBoundingClientRect(),
    stepper: document.querySelector('.preview-zoom-controls')?.getBoundingClientRect(),
    inspector: document.querySelector('.inspector-panel')?.getBoundingClientRect(),
  }));
  for (const [name, rect] of Object.entries({
    toolbarActions: bounds.toolbarActions,
    promotion: bounds.promotion,
    stepper: bounds.stepper,
    inspector: bounds.inspector,
  })) {
    if (!rect) throw new Error(`130% application zoom landmark is missing: ${name}`);
    if (rect.left < -0.5 || rect.top < -0.5 || rect.right > bounds.width + 0.5 || rect.bottom > bounds.height + 0.5) {
      throw new Error(`130% application zoom clips ${name}: ${JSON.stringify({ viewport: [bounds.width, bounds.height], rect })}`);
    }
  }
  await app.evaluate(({ BrowserWindow }, restoreBounds) => {
    const window = BrowserWindow.getAllWindows()[0]!;
    window.webContents.setZoomFactor(1);
    window.setBounds(restoreBounds);
  }, originalBounds);
  await page.waitForTimeout(120);
}

async function verifyThemeSettingsZoomContainment(app: ElectronApplication, page: Page) {
  const originalBounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getBounds());
  await page.getByRole('button', { name: 'Android' }).click();
  await page.getByRole('button', { name: '테마 정보' }).click();

  try {
    for (const zoomFactor of [1, 1.3, 1.5, 2]) {
      await app.evaluate(({ BrowserWindow }, factor) => {
        const window = BrowserWindow.getAllWindows()[0]!;
        window.setSize(1060, 710);
        window.webContents.setZoomFactor(factor);
      }, zoomFactor);
      await page.waitForTimeout(120);

      const metrics = await page.evaluate(() => {
        const layout = document.querySelector<HTMLElement>('.editor-layout');
        const workspace = document.querySelector<HTMLElement>('.theme-settings-workspace');
        const cards = [...document.querySelectorAll<HTMLElement>('.settings-card')];
        const inputs = [...document.querySelectorAll<HTMLElement>('.settings-form input')];
        const adaptiveCopy = document.querySelector('.adaptive-icon-copy');
        const adaptiveLayers = document.querySelector('.adaptive-icon-layers');
        const workspaceBounds = workspace?.getBoundingClientRect();
        const copyBounds = adaptiveCopy?.getBoundingClientRect();
        const layerBounds = adaptiveLayers?.getBoundingClientRect();
        const overlapWidth = copyBounds && layerBounds
          ? Math.max(0, Math.min(copyBounds.right, layerBounds.right) - Math.max(copyBounds.left, layerBounds.left))
          : -1;
        const overlapHeight = copyBounds && layerBounds
          ? Math.max(0, Math.min(copyBounds.bottom, layerBounds.bottom) - Math.max(copyBounds.top, layerBounds.top))
          : -1;
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          settingsLayout: layout?.classList.contains('is-settings-layout') ?? false,
          gridColumns: layout ? getComputedStyle(layout).gridTemplateColumns.split(/\s+/).filter(Boolean).length : 0,
          rootOverflow: Math.max(
            document.documentElement.scrollWidth - window.innerWidth,
            document.body.scrollWidth - window.innerWidth,
          ),
          workspaceOverflow: workspace ? workspace.scrollWidth - workspace.clientWidth : -1,
          cardOverflows: cards.map((card) => card.scrollWidth - card.clientWidth),
          inputsOutsideWorkspace: inputs.filter((input) => {
            const bounds = input.getBoundingClientRect();
            return !bounds || !workspaceBounds || bounds.left < workspaceBounds.left - 0.5 || bounds.right > workspaceBounds.right + 0.5;
          }).length,
          adaptiveOverlap: overlapWidth * overlapHeight,
          legacyLabelPresent: document.body.textContent?.includes('Android 기본 앱 아이콘') ?? false,
          retiredLabelPresent: document.body.textContent?.includes('Android 기본 앱 아이콘 (구형 기기)') ?? false,
        };
      });

      if (
        !metrics.settingsLayout
        || metrics.gridColumns !== 2
        || metrics.rootOverflow > 1
        || metrics.workspaceOverflow > 1
        || metrics.cardOverflows.some((overflow) => overflow > 1)
        || metrics.inputsOutsideWorkspace
        || metrics.adaptiveOverlap > 1
        || !metrics.legacyLabelPresent
        || metrics.retiredLabelPresent
      ) {
        throw new Error(`Android settings overflow at ${zoomFactor * 100}% zoom: ${JSON.stringify(metrics)}`);
      }
    }
  } finally {
    await app.evaluate(({ BrowserWindow }, restoreBounds) => {
      const window = BrowserWindow.getAllWindows()[0]!;
      window.webContents.setZoomFactor(1);
      window.setBounds(restoreBounds);
    }, originalBounds);
    await page.waitForTimeout(120);
    await page.getByRole('button', { name: '채팅방', exact: true }).click();
  }
}

async function verifyImportedBubbleMapping(app: ElectronApplication, page: Page, fixturePath: string) {
  await app.evaluate(({ dialog }, importedTheme) => {
    const replacement = Function(
      'payload',
      'return function showOpenDialogForRuntimeFixture() { return Promise.resolve(payload); };',
    )({ canceled: false, filePaths: [importedTheme] });
    Object.defineProperty(dialog, 'showOpenDialog', {
      configurable: true,
      value: replacement,
    });
  }, fixturePath);
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.getByRole('button', { name: 'iPhone' }).click();
  await page.getByRole('button', { name: '채팅방', exact: true }).click();
  await page.getByLabel('보낸 첫 말풍선 꾸미기').click();

  const shortBubble = page.locator('.state-cell').filter({ hasText: '짧은 글' }).locator('.mini-bubble');
  await shortBubble.locator('[data-ios-label-placement="title-edge-insets"]').waitFor();
  const metric = await shortBubble.evaluate((bubble) => {
    const copy = bubble.querySelector<HTMLElement>('.mini-bubble-copy');
    const canvas = bubble.querySelector<HTMLCanvasElement>('.kt-nine-slice-canvas');
    if (!copy || !canvas) return undefined;
    const style = getComputedStyle(bubble);
    return {
      target: { width: (bubble as HTMLElement).offsetWidth, height: (bubble as HTMLElement).offsetHeight },
      copy: { x: copy.offsetLeft, y: copy.offsetTop, width: copy.offsetWidth, height: copy.offsetHeight },
      padding: {
        top: Number.parseFloat(style.paddingTop),
        right: Number.parseFloat(style.paddingRight),
        bottom: Number.parseFloat(style.paddingBottom),
        left: Number.parseFloat(style.paddingLeft),
      },
      transform: getComputedStyle(copy).transform,
      sourceImage: canvas.dataset.sourceImage,
    };
  });
  if (!metric) throw new Error('Decorated iOS short bubble geometry is missing.');
  closeTo(metric.copy.x, metric.padding.left, 'decorated iOS short-label left inset', 0.51);
  closeTo(metric.copy.y, metric.padding.top, 'decorated iOS short-label top inset', 0.51);
  if (
    metric.transform !== 'none'
    || metric.target.width + 0.51 < metric.padding.left + metric.copy.width + metric.padding.right
    || metric.target.height + 0.51 < metric.padding.top + metric.copy.height + metric.padding.bottom
    || !metric.sourceImage?.startsWith('data:image/png;base64,')
  ) {
    throw new Error(`Decorated iOS short bubble was not rendered safely: ${JSON.stringify(metric)}`);
  }

  await page.getByRole('button', { name: 'Android' }).click();
  await page.locator('.bubble-states[data-platform="android"] [data-renderer="android-nine-patch"]').first().waitFor();
  const androidSources = await page.locator('.bubble-states[data-platform="android"] [data-renderer="android-nine-patch"] .kt-nine-slice-canvas')
    .evaluateAll((canvases) => canvases.map((canvas) => (canvas as HTMLCanvasElement).dataset.sourceImage));
  if (androidSources.length !== 5 || androidSources.some((source) => !source?.startsWith('data:image/png;base64,'))) {
    throw new Error(`Imported iOS bubble images did not populate Android states: ${JSON.stringify(androidSources)}`);
  }
}

async function main() {
  const decoratedFixture = path.join('/tmp', `kakao-decorated-import-${process.pid}.ktheme`);
  await createDecoratedIosTheme(decoratedFixture);
  const app = await electron.launch({ args: ['.', `--user-data-dir=/tmp/kakao-theme-studio-visual-${process.pid}`] });
  try {
    const page = await app.firstWindow();
    await selectAndroidChatroom(page);
    const systemUi = await page.locator('.kt-android-chatroom').evaluate((screen) => ({
      elements: screen.querySelectorAll('[data-system-ui], .status-bar, .system-status-bar').length,
      text: /(?:9:30|5G|LTE|Wi-?Fi|배터리)/i.test(screen.textContent ?? ''),
      font: getComputedStyle(screen).fontFamily,
      fontLoaded: document.fonts.check('16px "Kakao Small Sans"'),
    }));
    if (systemUi.elements || systemUi.text) throw new Error('System status UI must not be rendered or compared.');
    if (!systemUi.fontLoaded || !systemUi.font.includes('Kakao Small Sans')) throw new Error(`Preview font was not loaded: ${systemUi.font}`);

    await verifyWorkspaceZoomContainment(page);
    await verifyApplicationZoomContainment(app, page);
    await verifyThemeSettingsZoomContainment(app, page);

    const actualBuffer = await page.locator('.kt-android-chatroom').screenshot({ path: '/tmp/kakao-android-chatroom-actual.png' });
    const actualImage = PNG.sync.read(actualBuffer);
    const referenceImage = PNG.sync.read(await readFile(REFERENCE_FILE));
    if (actualImage.width < ACTUAL_VIEWPORT.width || actualImage.height < ACTUAL_VIEWPORT.height) {
      throw new Error(`Preview screenshot is smaller than the KakaoTalk viewport: ${actualImage.width}x${actualImage.height}`);
    }
    compareBubbleSet(actualImage, referenceImage, 'you');
    compareBubbleSet(actualImage, referenceImage, 'me');
    await verifyIosTitleInsetsAndContainment(page);
    await verifyAreaEditorAspectRatio(page, 'Android', { width: 122, height: 112 });
    await verifyAreaEditorAspectRatio(page, 'iPhone', { width: 120, height: 105 });
    await verifyImportedBubbleMapping(app, page, decoratedFixture);
    console.log('Android 26.5 reference and imported iOS/Android bubble runtime geometry are verified.');
  } finally {
    await app.close();
    await rm(decoratedFixture, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
