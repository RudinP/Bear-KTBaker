import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import kakaoSmallSansBold from '../assets/fonts/KakaoSmallSans-Bold.woff2?inline';
import kakaoSmallSansLight from '../assets/fonts/KakaoSmallSans-Light.woff2?inline';
import kakaoSmallSansRegular from '../assets/fonts/KakaoSmallSans-Regular.woff2?inline';
import { rendererOperationErrorText } from '../application/errors/rendererOperationErrorText';
import {
  THEME_STUDIO_UNAVAILABLE_MESSAGE,
  themeStudioClient,
  type ThemeStudioClient,
} from '../app/themeStudioClient';
import { PhonePreview } from './preview/PhonePreview';
import { MiniBubble } from './BubbleStates';
import type { Platform, ThemeProject } from '../domain/theme/model';
import { PROFILE_RESOURCE_IDS } from '../manifest/profileResourceIds';
import { resolveResourceUrl } from '../manifest/resourceResolver';
import { previewFontFamily } from '../preview/fontFamily';
import { getHostLayout } from '../preview/layout';

const POSTER_WIDTH = 1000;
const POSTER_HEIGHT = 800;
const POSTER_PIXEL_RATIO = 2;
const POSTER_TABS = ['friends', 'chats', 'now', 'shopping', 'more'] as const;
const PASSCODE_FRAME = { width: 212, height: 430 } as const;

function cssString(value: string) {
  return JSON.stringify(value).replace(/</g, '\\3c ');
}

function exportFontCSS(project: ThemeProject) {
  const kakaoSmallSans = [
    ['300', kakaoSmallSansLight],
    ['400 600', kakaoSmallSansRegular],
    ['700 900', kakaoSmallSansBold],
  ].map(([weight, source]) => `@font-face {
    font-family: "Kakao Small Sans";
    src: url(${cssString(source)}) format("woff2");
    font-style: normal;
    font-weight: ${weight};
    font-display: block;
  }`).join('\n');
  if (!project.font) return kakaoSmallSans;
  return `@font-face {
    font-family: ${cssString(project.font.family)};
    src: url(${cssString(project.font.dataUrl)});
    font-style: normal;
    font-weight: 100 900;
    font-display: block;
  }\n${kakaoSmallSans}`;
}

async function prepareExportFonts(project: ThemeProject) {
  if (project.font && 'FontFace' in window) {
    const face = new FontFace(project.font.family, `url(${cssString(project.font.dataUrl)})`, {
      style: 'normal',
      weight: '100 900',
    });
    const loaded = await face.load();
    document.fonts?.add(loaded);
  }
  if (!document.fonts) return;
  const family = project.font?.family ?? 'Kakao Small Sans';
  await Promise.all([
    document.fonts.load(`400 16px ${cssString(family)}`),
    document.fonts.load(`700 16px ${cssString(family)}`),
    document.fonts.ready,
  ]);
}

function passcodePreviewScale(platform: Platform) {
  const viewport = getHostLayout(platform, 'passcode').viewport;
  return Math.min(PASSCODE_FRAME.width / viewport.width, PASSCODE_FRAME.height / viewport.height);
}

function freezeCanvasLayers(root: HTMLElement) {
  const frozen = [...root.querySelectorAll<HTMLCanvasElement>('canvas')].flatMap((canvas) => {
    let source = '';
    try { source = canvas.toDataURL('image/png'); } catch { return []; }
    if (!source) return [];
    const image = document.createElement('img');
    image.src = source;
    image.className = canvas.className;
    image.style.cssText = canvas.style.cssText;
    image.width = canvas.width;
    image.height = canvas.height;
    image.dataset.exportCanvas = 'true';
    canvas.replaceWith(image);
    return [{ canvas, image }];
  });
  return () => frozen.forEach(({ canvas, image }) => image.replaceWith(canvas));
}

function PosterHeading({ index, children }: { index: string; children: React.ReactNode }) {
  return <div className="poster-section-heading"><span>{index}</span><b>{children}</b></div>;
}

function TabState({ project, platform, state }: {
  project: ThemeProject;
  platform: Platform;
  state: 'normal' | 'selected';
}) {
  return <div className="poster-tab-state" data-state={state}>
    <span>{state === 'normal' ? '기본' : '선택'}</span>
    <div className="poster-tab-icons">
      {POSTER_TABS.map((tab) => {
        const resourceId = `main.tab.${tab}.${state}`;
        const source = resolveResourceUrl(project, platform, resourceId);
        return source ? <img key={resourceId} src={source} alt="" data-resource-id={resourceId} /> : null;
      })}
    </div>
  </div>;
}

function ProfileResources({ project, platform }: { project: ThemeProject; platform: Platform }) {
  const resources = PROFILE_RESOURCE_IDS.flatMap((resourceId) => {
    const source = resolveResourceUrl(project, platform, resourceId);
    return source ? [{ resourceId, source }] : [];
  });
  return <div className="poster-profile-list">
    {resources.map(({ resourceId, source }) => <img key={resourceId} src={source} alt="" data-resource-id={resourceId} />)}
  </div>;
}

export function ScreenshotStudio({
  project,
  platform,
  onClose,
  client = themeStudioClient,
}: {
  project: ThemeProject;
  platform: Platform;
  onClose(): void;
  client?: Pick<ThemeStudioClient, 'isAvailable' | 'saveScreenshots'>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(project.meta.name);
  const [author, setAuthor] = useState(project.meta.author || '제작자 이름');
  const [receivedMessage, setReceivedMessage] = useState('오늘도 좋은 하루 보내요');
  const [sentMessage, setSentMessage] = useState('테마를 만들고 있어요');
  const [backgroundColor, setBackgroundColor] = useState('#ecebe7');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    if (!client.isAvailable()) {
      setSaveError(THEME_STUDIO_UNAVAILABLE_MESSAGE);
      return;
    }
    if (!canvasRef.current) return;
    setSaveError(null);
    setBusy(true);
    try {
      await prepareExportFonts(project);
      const options = {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        pixelRatio: POSTER_PIXEL_RATIO,
        cacheBust: true,
        fontEmbedCSS: exportFontCSS(project),
      };
      const restoreCanvases = freezeCanvasLayers(canvasRef.current);
      try {
        await toPng(canvasRef.current, options);
        const dataUrl = await toPng(canvasRef.current, options);
        await client.saveScreenshots([{ name: `${title || '카카오톡-테마'}-홍보.png`, dataUrl }]);
      } finally { restoreCanvases(); }
    } catch (error) {
      setSaveError(rendererOperationErrorText(
        error,
        '홍보 이미지를 저장하지 못했습니다.',
        '파일과 저장 위치를 확인해 주세요.',
      ));
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop screenshot-backdrop" role="dialog" aria-modal="true" aria-label="홍보 이미지 만들기">
      <div className="screenshot-sheet single-poster-sheet">
        <div className="screenshot-toolbar">
          <div><h2>홍보 이미지</h2></div>
          <label>테마 이름<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>제작자<input value={author} onChange={(event) => setAuthor(event.target.value)} /></label>
          <label>받는 말풍선<input aria-label="받는 말풍선 문구" value={receivedMessage} onChange={(event) => setReceivedMessage(event.target.value)} /></label>
          <label>보내는 말풍선<input aria-label="보내는 말풍선 문구" value={sentMessage} onChange={(event) => setSentMessage(event.target.value)} /></label>
          <label className="poster-background-control">배경색<input type="color" aria-label="홍보 이미지 배경색" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} /></label>
          <button type="button" className="ghost-button screenshot-action" onClick={onClose}>닫기</button>
          <button type="button" className="primary-button screenshot-action" onClick={save} disabled={busy}>{busy ? '저장 중…' : 'PNG 저장'}</button>
          {saveError && <div role="alert">{saveError}</div>}
        </div>
        <div className="poster-scroll">
          <div className="promotion-canvas" data-testid="promotion-canvas" data-platform={platform}
            data-aspect-ratio="5:4" data-export-size="2000x1600" ref={canvasRef}
            style={{ backgroundColor, fontFamily: previewFontFamily(platform, project.font?.family) }}>
            <header className="poster-heading">
              <span>KAKAO TALK THEME / {platform.toUpperCase()}</span>
              <h1>{title}</h1>
              <p>designed by <b>{author}</b></p>
            </header>

            <div className="poster-content">
              <section className="poster-panel poster-bubbles" aria-label="말풍선">
                <PosterHeading index="01">말풍선</PosterHeading>
                <div className="poster-bubble-showcase">
                  <div data-poster-bubble="received">
                    <MiniBubble project={project} platform={platform} side="you" appearance={project.chat.bubbles.you.normal} exportSafe
                      resourceId="chat.bubble.you.first.normal">{receivedMessage}</MiniBubble>
                  </div>
                  <div data-poster-bubble="sent">
                    <MiniBubble project={project} platform={platform} side="me" appearance={project.chat.bubbles.me.normal} exportSafe
                      resourceId="chat.bubble.me.first.normal">{sentMessage}</MiniBubble>
                  </div>
                </div>
              </section>

              <section className="poster-panel poster-passcode" aria-label="잠금화면">
                <PosterHeading index="02">잠금화면</PosterHeading>
                <div className="poster-passcode-device" data-source-viewport={`${getHostLayout(platform, 'passcode').viewport.width}x${getHostLayout(platform, 'passcode').viewport.height}`}
                  data-frame={`${PASSCODE_FRAME.width}x${PASSCODE_FRAME.height}`} data-preview-scale={passcodePreviewScale(platform)} data-contained="true">
                  <PhonePreview project={project} platform={platform} screen="passcode" selected="screen-background" onSelect={() => undefined}
                    previewScale={passcodePreviewScale(platform)} />
                </div>
              </section>

              <section className="poster-panel poster-tabs" aria-label="하단 탭">
                <PosterHeading index="03">하단 탭</PosterHeading>
                <div className="poster-tab-states">
                  <TabState project={project} platform={platform} state="normal" />
                  <TabState project={project} platform={platform} state="selected" />
                </div>
              </section>

              <section className="poster-panel poster-profiles" aria-label="프로필">
                <PosterHeading index="04">프로필</PosterHeading>
                <ProfileResources project={project} platform={platform} />
              </section>
            </div>

            <footer className="poster-footer"><span>{author}</span><i /><span>{title}</span></footer>
          </div>
        </div>
      </div>
    </div>
  );
}
