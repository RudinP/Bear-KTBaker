import { useEffect, useState } from 'react';
import type { BubbleAppearance, Platform, ThemeProject } from '../domain/theme';
import { colorValue, cssColor } from '../manifest/colorResolver';
import { resolveResourceAsset, resolveResourceUrl } from '../manifest/resourceResolver';
import { getResourceSlot } from '../manifest/kakaoResources';
import { ninePatchBorderStyle, officialSampleBubbleGuides } from '../preview/ninePatchStyle';
import { contentInsetsPx } from '../preview/nineSlice';
import { resolveAssetScale } from '../preview/imagePlacement';
import { previewFontFamily } from '../preview/fontFamily';
import { getHostLayout } from '../preview/layout';
import { NineSliceImage } from './NineSliceImage';

export function MiniBubble({ project, platform, side, appearance, resourceId, children, grouped = false, pressed = false, exportSafe = false }: {
  project: ThemeProject;
  platform: Platform;
  side: 'me' | 'you';
  appearance: BubbleAppearance;
  resourceId: string;
  children: React.ReactNode;
  grouped?: boolean;
  pressed?: boolean;
  exportSafe?: boolean;
}) {
  const source = resolveResourceUrl(project, platform, resourceId);
  const asset = resolveResourceAsset(project, platform, resourceId);
  const rawNinePatch = platform === 'android' && Boolean(asset?.fileName.endsWith('.9.png') || (!asset && source?.includes('.9.png')));
  const binding = getResourceSlot(resourceId)[platform];
  const sampleSize = binding?.sampleContentSize ?? binding?.samplePixelSize ?? (platform === 'android' ? [122, 112] : [120, 105]);
  const [render, setRender] = useState({ source, width: sampleSize[0], height: sampleSize[1] });

  useEffect(() => {
    if (!source) {
      setRender({ source: undefined, width: sampleSize[0], height: sampleSize[1] });
      return;
    }
    let active = true;
    // Clear any previous platform/resource immediately. The decoded Android
    // marker border is replaced with the stripped canvas when loading ends.
    setRender({ source, width: sampleSize[0], height: sampleSize[1] });
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      if (!rawNinePatch) {
        setRender({ source, width: image.naturalWidth, height: image.naturalHeight });
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, image.naturalWidth - 2);
      canvas.height = Math.max(1, image.naturalHeight - 2);
      canvas.getContext('2d')?.drawImage(image, 1, 1, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      setRender({ source: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
    };
    image.src = source;
    return () => {
      active = false;
      image.onload = null;
    };
  }, [rawNinePatch, sampleSize[0], sampleSize[1], source]);

  const guides = appearance.stretchByPlatform?.[platform] ?? (asset ? appearance.stretch : officialSampleBubbleGuides(platform, side, pressed));
  const sourceScale = asset?.sourceScale ?? resolveAssetScale({ fileName: asset?.fileName ?? source ?? '' }, platform);
  const insets = contentInsetsPx(guides, { width: render.width, height: render.height }, sourceScale, platform === 'android' ? 'android' : 'css');
  const chatLayout = getHostLayout(platform, 'chatroom').chat!;
  const hostInsets = chatLayout.bubbleContentInset;
  const typography = platform === 'android'
    ? { fontSize: 15, fontWeight: 300, lineHeight: '24px' }
    : { fontSize: 14, fontWeight: 400, lineHeight: '18px' };
  const textSlot = `chat.bubble.${side}.text${pressed && platform === 'ios' ? '.pressed' : ''}`;
  const textColor = cssColor(colorValue(project, platform, textSlot));
  return <div className={`mini-bubble ${side} ${grouped ? 'grouped' : ''}`} style={{
    '--bubble-color': appearance.color,
    '--bubble-text': textColor,
    backgroundColor: render.source ? 'transparent' : appearance.color,
    padding: `${insets.top + hostInsets.top}px ${insets.right + hostInsets.right}px ${insets.bottom + hostInsets.bottom}px ${insets.left + hostInsets.left}px`,
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
    lineHeight: typography.lineHeight,
    maxWidth: chatLayout.maxBubbleWidth,
  } as React.CSSProperties}>
    {render.source && exportSafe && <NineSliceImage image={render.source} guides={guides} sourceSize={{ width: render.width, height: render.height }} sourceScale={sourceScale} renderer="poster-nine-slice" />}
    {render.source && !exportSafe && platform === 'ios' && <span className="kt-ninepatch-layer kt-ios-inset-layer" data-renderer="ios-inset" style={ninePatchBorderStyle(render.source, guides, render.width, render.height, sourceScale)} />}
    {render.source && !exportSafe && platform === 'android' && <NineSliceImage image={render.source} guides={guides} sourceSize={{ width: render.width, height: render.height }} sourceScale={sourceScale} renderer="android-nine-patch" />}
    <span className="mini-bubble-copy">{children}</span>
  </div>;
}

export function BubbleStates({ project, platform, side }: { project: ThemeProject; platform: Platform; side: 'me' | 'you' }) {
  const set = project.chat.bubbles[side];
  const normalId = `chat.bubble.${side}.first.normal`;
  const groupedId = `chat.bubble.${side}.grouped.normal`;
  const pressedId = `chat.bubble.${side}.first.pressed`;
  // Android exposes no separate pressed bubble bitmap. KakaoTalk keeps the
  // normal .9.png shape while the surrounding pressed state changes.
  const pressedResourceId = platform === 'android' ? normalId : pressedId;
  const pressedAppearance = platform === 'android' ? set.normal : set.pressed;
  return <section className="bubble-states" aria-label="말풍선 모든 상태" data-platform={platform} style={{ fontFamily: previewFontFamily(platform, project.font?.family) }}>
    <div className="state-head"><div><span className="panel-kicker">실제 리소스 상태</span><h3>말풍선의 모든 모습</h3></div></div>
    <div className="state-grid">
      <div className="state-cell" data-resource-id={normalId}><span>짧은 글</span><MiniBubble key={`${platform}:${normalId}:short`} project={project} platform={platform} side={side} appearance={set.normal} resourceId={normalId}>네!</MiniBubble></div>
      <div className="state-cell long" data-layout="full-width" data-resource-id={normalId}><span>긴 글</span><MiniBubble key={`${platform}:${normalId}:long`} project={project} platform={platform} side={side} appearance={set.normal} resourceId={normalId}>글이 길어져도 모양이 자연스러운지 확인해요.</MiniBubble></div>
      <div className="state-cell reply" data-layout="full-width" data-resource-id={normalId}><span>답장</span><MiniBubble key={`${platform}:${normalId}:reply`} project={project} platform={platform} side={side} appearance={set.normal} resourceId={normalId}><span className="reply-content"><span className="reply-reference"><b data-reply-title>나에게 답장</b><span data-reply-original>답장 원문이 길어져도 자연스럽게 표시돼요.</span></span><span className="reply-divider" data-reply-divider /><span className="reply-body" data-reply-body>답장하면 이렇게 돼</span></span></MiniBubble></div>
      <div className="state-cell" data-resource-id={groupedId}><span>연속 메시지</span><MiniBubble key={`${platform}:${groupedId}:grouped`} project={project} platform={platform} side={side} appearance={set.grouped} resourceId={groupedId} grouped>두 번째 말풍선</MiniBubble></div>
      <div className="state-cell pressed" data-resource-id={pressedResourceId}><span>꾹 눌렀을 때</span><MiniBubble key={`${platform}:${pressedResourceId}:pressed`} project={project} platform={platform} side={side} appearance={pressedAppearance} resourceId={pressedResourceId} pressed>선택된 모습</MiniBubble></div>
    </div>
  </section>;
}
