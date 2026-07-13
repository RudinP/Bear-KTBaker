import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../domain/theme';
import { setColorSlot } from '../manifest/colorResolver';
import { ScreenshotStudio } from './ScreenshotStudio';

const { toPngMock } = vi.hoisted(() => ({ toPngMock: vi.fn() }));
vi.mock('html-to-image', () => ({ toPng: toPngMock }));

afterEach(() => {
  toPngMock.mockReset();
  Reflect.deleteProperty(window, 'themeStudio');
});

describe('promotional image studio', () => {
  it.each(['ios', 'android'] as const)('composes one exportable 5:4 %s poster from the live theme resources', (platform) => {
    const project = createDefaultTheme('복숭아 우체국');
    project.meta.author = '루딘';
    const { container } = render(<ScreenshotStudio project={project} platform={platform} onClose={() => undefined} />);

    const poster = screen.getByTestId('promotion-canvas');
    expect(poster).toHaveAttribute('data-aspect-ratio', '5:4');
    expect(poster).toHaveAttribute('data-export-size', '2000x1600');
    expect(poster).toHaveTextContent('복숭아 우체국');
    expect(poster).toHaveTextContent('루딘');
    expect(screen.getByText('잠금화면')).toBeInTheDocument();
    expect(screen.getByText('말풍선')).toBeInTheDocument();
    expect(screen.getByText('하단 탭')).toBeInTheDocument();
    expect(screen.getByText('프로필')).toBeInTheDocument();
    expect(screen.getAllByTestId('promotion-canvas')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '홍보 이미지' })).toBeInTheDocument();
    expect(screen.queryByText('5:4 테마 소개 이미지')).not.toBeInTheDocument();

    const bubbles = container.querySelector('.poster-bubbles');
    expect(bubbles?.querySelector('[data-poster-bubble="received"]')).toBeInTheDocument();
    expect(bubbles?.querySelector('[data-poster-bubble="sent"]')).toBeInTheDocument();
    expect(bubbles?.querySelector('.poster-chat-window')).not.toBeInTheDocument();

    const passcode = container.querySelector('.poster-passcode');
    expect(passcode).not.toBeNull();
    expect(within(passcode as HTMLElement).getByTestId('passcode-keypad')).toBeInTheDocument();
    expect(within(passcode as HTMLElement).getByRole('button', { name: '숫자 1 입력' })).toBeInTheDocument();
    expect(within(passcode as HTMLElement).queryByText('패턴')).not.toBeInTheDocument();

    const passcodeDevice = passcode?.querySelector<HTMLElement>('.poster-passcode-device');
    const [sourceWidth, sourceHeight] = passcodeDevice?.dataset.sourceViewport?.split('x').map(Number) ?? [];
    const [frameWidth, frameHeight] = passcodeDevice?.dataset.frame?.split('x').map(Number) ?? [];
    const previewScale = Number(passcodeDevice?.dataset.previewScale);
    if (platform === 'ios') {
      expect([sourceWidth, sourceHeight]).toEqual([402, 874]);
      expect(previewScale).toBeCloseTo(430 / 874, 8);
    }
    expect(sourceWidth * previewScale).toBeLessThanOrEqual(frameWidth);
    expect(sourceHeight * previewScale).toBeLessThanOrEqual(frameHeight);
    expect(passcodeDevice).toHaveAttribute('data-contained', 'true');
  });

  it.each(['ios', 'android'] as const)('lets the user write the two promotional bubble messages without capturing a chatroom', (platform) => {
    const { container } = render(<ScreenshotStudio project={createDefaultTheme()} platform={platform} onClose={() => undefined} />);

    const received = screen.getByRole('textbox', { name: '받는 말풍선 문구' });
    const sent = screen.getByRole('textbox', { name: '보내는 말풍선 문구' });
    fireEvent.change(received, { target: { value: '받는 문구를 직접 입력' } });
    fireEvent.change(sent, { target: { value: '보내는 문구를 직접 입력' } });

    expect(container.querySelector('[data-poster-bubble="received"]')).toHaveTextContent('받는 문구를 직접 입력');
    expect(container.querySelector('[data-poster-bubble="sent"]')).toHaveTextContent('보내는 문구를 직접 입력');
    expect(container.querySelector('.poster-chat-crop')).not.toBeInTheDocument();
    expect(container.querySelector('.poster-bubbles .device-frame')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.poster-bubbles [data-renderer="poster-nine-slice"]')).toHaveLength(2);
  });

  it('lets the user choose the solid promotional poster background color', () => {
    render(<ScreenshotStudio project={createDefaultTheme()} platform="ios" onClose={() => undefined} />);

    const background = screen.getByLabelText('홍보 이미지 배경색');
    expect(background).toHaveValue('#ecebe7');
    fireEvent.change(background, { target: { value: '#c8d9e8' } });

    expect(screen.getByTestId('promotion-canvas')).toHaveStyle({ backgroundColor: '#c8d9e8' });
  });

  it.each(['ios', 'android'] as const)('shows every real %s bottom tab in both selected and unselected states', (platform) => {
    const { container } = render(<ScreenshotStudio project={createDefaultTheme()} platform={platform} onClose={() => undefined} />);
    const showcase = container.querySelector('.poster-tabs');
    const normalIcons = showcase?.querySelectorAll<HTMLImageElement>('.poster-tab-state[data-state="normal"] img');
    const selectedIcons = showcase?.querySelectorAll<HTMLImageElement>('.poster-tab-state[data-state="selected"] img');

    expect(normalIcons).toHaveLength(5);
    expect(selectedIcons).toHaveLength(5);
    expect([...normalIcons ?? [], ...selectedIcons ?? []].every((icon) => icon.src.includes('/sample/'))).toBe(true);
    expect(normalIcons?.[0]).toHaveAttribute('data-resource-id', 'main.tab.friends.normal');
    expect(selectedIcons?.[0]).toHaveAttribute('data-resource-id', 'main.tab.friends.selected');
    expect(normalIcons?.[0].src).not.toBe(selectedIcons?.[0].src);
  });

  it.each(['ios', 'android'] as const)('shows up to three configured %s profile resources without substituting invented art', (platform) => {
    const project = createDefaultTheme();
    for (let index = 1; index <= 3; index += 1) {
      const id = `main.profile.0${index}`;
      project.platformResources[platform][id] = {
        fileName: `profile-${index}.png`,
        dataUrl: `data:image/png;base64,profile-${index}`,
        width: 220,
        height: 220,
      };
    }

    const { container } = render(<ScreenshotStudio project={project} platform={platform} onClose={() => undefined} />);
    const profiles = container.querySelectorAll<HTMLImageElement>('.poster-profile-list img');

    expect(profiles).toHaveLength(3);
    expect([...profiles].map((image) => image.dataset.resourceId)).toEqual([
      'main.profile.01', 'main.profile.02', 'main.profile.03',
    ]);
    expect([...profiles].map((image) => image.src)).toEqual([
      'data:image/png;base64,profile-1',
      'data:image/png;base64,profile-2',
      'data:image/png;base64,profile-3',
    ]);
  });

  it.each(['ios', 'android'] as const)('uses the current %s project font and edited colors in the poster previews', (platform) => {
    let project = createDefaultTheme();
    project.font = {
      family: 'My Theme Font',
      fileName: 'my-theme-font.ttf',
      dataUrl: 'data:font/ttf;base64,V0lERQ==',
    };
    project = setColorSlot(project, platform, 'chat.bubble.me.text', '#123456');
    project = setColorSlot(project, platform, 'chat.bubble.you.text', '#345678');
    project = setColorSlot(project, platform, 'passcode.foreground', '#654321');

    const { container } = render(<ScreenshotStudio project={project} platform={platform} onClose={() => undefined} />);
    const poster = screen.getByTestId('promotion-canvas');
    const sentBubble = container.querySelector<HTMLElement>('[data-poster-bubble="sent"] .mini-bubble');
    const receivedBubble = container.querySelector<HTMLElement>('[data-poster-bubble="received"] .mini-bubble');
    const passcodeTitle = container.querySelector<HTMLElement>('.poster-passcode .kt-passcode-title');

    expect(poster.style.fontFamily).toContain('My Theme Font');
    expect(sentBubble?.style.getPropertyValue('--bubble-text')).toBe('#123456');
    expect(receivedBubble?.style.getPropertyValue('--bubble-text')).toBe('#345678');
    expect(passcodeTitle).toHaveStyle({ color: '#654321' });
  });

  it('captures exactly one 5:4 PNG at 2000x1600 and passes it to the Electron save API', async () => {
    const saveScreenshots = vi.fn().mockResolvedValue('/tmp/theme-poster.png');
    Object.defineProperty(window, 'themeStudio', {
      configurable: true,
      value: {
        platform: 'darwin',
        openProject: vi.fn(),
        saveProject: vi.fn(),
        importTheme: vi.fn(),
        exportIos: vi.fn(),
        exportAndroid: vi.fn(),
        saveScreenshots,
      },
    });
    toPngMock.mockResolvedValueOnce('data:image/png;base64,warmup').mockResolvedValueOnce('data:image/png;base64,poster');
    render(<ScreenshotStudio project={createDefaultTheme('우체국')} platform="ios" onClose={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'PNG 저장' }));

    await waitFor(() => expect(saveScreenshots).toHaveBeenCalledTimes(1));
    expect(toPngMock).toHaveBeenCalledTimes(2);
    expect(toPngMock.mock.calls[0][0]).toBe(screen.getByTestId('promotion-canvas'));
    for (const call of toPngMock.mock.calls) {
      expect(call[1]).toMatchObject({ width: 1000, height: 800, pixelRatio: 2, cacheBust: true });
      expect(call[1].fontEmbedCSS).toContain('font-family: "Kakao Small Sans"');
      expect(call[1].fontEmbedCSS).toContain('data:font/woff2;base64,');
    }
    expect(saveScreenshots).toHaveBeenCalledWith([{
      name: '우체국-홍보.png',
      dataUrl: 'data:image/png;base64,poster',
    }]);
  });

  it('embeds the selected project font data in the exported PNG instead of falling back', async () => {
    const project = createDefaultTheme('사용자 글꼴 테마');
    project.font = {
      family: 'My Export Font',
      fileName: 'my-export-font.ttf',
      dataUrl: 'data:font/ttf;base64,VVNFUi1GT05U',
    };
    const saveScreenshots = vi.fn().mockResolvedValue('/tmp/theme-poster.png');
    Object.defineProperty(window, 'themeStudio', {
      configurable: true,
      value: {
        platform: 'darwin', openProject: vi.fn(), saveProject: vi.fn(), importTheme: vi.fn(),
        exportIos: vi.fn(), exportAndroid: vi.fn(), saveScreenshots,
      },
    });
    toPngMock.mockResolvedValue('data:image/png;base64,poster');
    render(<ScreenshotStudio project={project} platform="ios" onClose={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'PNG 저장' }));

    await waitFor(() => expect(saveScreenshots).toHaveBeenCalledTimes(1));
    const exportOptions = toPngMock.mock.calls[1][1];
    expect(exportOptions.fontEmbedCSS).toContain('font-family: "My Export Font"');
    expect(exportOptions.fontEmbedCSS).toContain('data:font/ttf;base64,VVNFUi1GT05U');
    expect(exportOptions.fontEmbedCSS).toContain('font-family: "Kakao Small Sans"');
  });

  it('freezes nine-slice canvases as images while the promotional PNG is captured', async () => {
    const saveScreenshots = vi.fn().mockResolvedValue('/tmp/theme-poster.png');
    Object.defineProperty(window, 'themeStudio', {
      configurable: true,
      value: {
        platform: 'darwin', openProject: vi.fn(), saveProject: vi.fn(), importTheme: vi.fn(),
        exportIos: vi.fn(), exportAndroid: vi.fn(), saveScreenshots,
      },
    });
    const { container } = render(<ScreenshotStudio project={createDefaultTheme()} platform="android" onClose={() => undefined} />);
    const poster = screen.getByTestId('promotion-canvas');
    const canvasToDataUrl = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,frozen-nine-slice');
    const canvas = document.createElement('canvas');
    canvas.className = 'kt-nine-slice-canvas';
    canvas.width = 30;
    canvas.height = 20;
    poster.append(canvas);
    toPngMock.mockImplementation(async (node: HTMLElement) => {
      expect(node.querySelector('canvas.kt-nine-slice-canvas')).not.toBeInTheDocument();
      expect(node.querySelectorAll('img[data-export-canvas="true"]').length).toBeGreaterThan(0);
      return 'data:image/png;base64,poster';
    });

    fireEvent.click(screen.getByRole('button', { name: 'PNG 저장' }));

    await waitFor(() => expect(saveScreenshots).toHaveBeenCalledTimes(1));
    expect(container.querySelector('canvas.kt-nine-slice-canvas')).toBeInTheDocument();
    expect(container.querySelector('img[data-export-canvas="true"]')).not.toBeInTheDocument();
    canvasToDataUrl.mockRestore();
  });
});
