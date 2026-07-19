import { useState } from 'react';
import { colorValue, cssColor } from '../../manifest/colorResolver';
import { resolveResourceUrl } from '../../manifest/resourceResolver';
import { getHostLayout } from '../../preview/layout';
import {
  ColorHotspot, Editable, ThemeBackground,
  screenStyle,
} from './PreviewHotspots';
import { type PreviewProps } from './PreviewTypes';

export function PasscodePreview(props: PreviewProps): React.ReactElement {
  const { project, platform, selected, onSelect } = props;
  const passcode = getHostLayout(platform, 'passcode').passcode!;
  const [entered, setEntered] = useState(0);
  const [pressed, setPressed] = useState<number | null>(null);
  const pressedImage = resolveResourceUrl(project, platform, 'passcode.keypad.pressed');
  const enterDigit = () => setEntered((current) => Math.min(4, current + 1));
  const deleteDigit = () => setEntered((current) => Math.max(0, current - 1));
  const bullets = <div className="kt-passcode-bullets" role="button" tabIndex={0} aria-label="잠금화면 상태별 이미지 꾸미기"
    style={platform === 'ios' ? { top: passcode.bulletTop } : undefined}
    onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); }}>
    {[1, 2, 3, 4].map((index) => {
      const state = index <= entered ? 'selected' : 'normal';
      const image = resolveResourceUrl(project, platform, `passcode.bullet.${index}.${state}`);
      return image ? <img key={index} data-testid={`passcode-bullet-${index}`} data-passcode-bullet={index} data-state={state} src={image} alt="" />
        : <i key={index} data-testid={`passcode-bullet-${index}`} data-passcode-bullet={index} data-state={state} />;
    })}
  </div>;
  return <div className="kt-screen kt-passcode" style={screenStyle(project, platform, 'passcode')} onClick={() => onSelect('screen-background')}>
    <ThemeBackground project={project} platform={platform} screen="passcode" />
    {platform === 'android' && <span className="kt-passcode-keypad-background" style={{ top: passcode.keypad.y, backgroundColor: cssColor(colorValue(project, platform, 'passcode.keypad.background')) }} aria-hidden="true" />}
    <div className="kt-passcode-title" style={{ top: passcode.titleTop, color: cssColor(colorValue(project, platform, 'passcode.foreground')) }}><ColorHotspot slotId="passcode.foreground" selected={selected} onSelect={onSelect} className="kt-passcode-title-copy"><span><h4>{platform === 'ios' ? '암호 입력' : '암호'}</h4><p>{platform === 'ios' ? '카카오톡 암호를 입력해 주세요.' : '카카오톡 암호를 입력해주세요.'}</p></span></ColorHotspot>{platform === 'android' && bullets}</div>
    {platform === 'ios' && bullets}
    <div role="button" tabIndex={0} aria-label="숫자 키패드 꾸미기" className="editable kt-keypad" data-selected={selected === 'passcode-keypad'} data-testid="passcode-keypad"
      data-frame={`${passcode.keypad.x},${passcode.keypad.y},${passcode.keypad.width},${passcode.keypad.height}`}
      style={{ top: passcode.keypad.y, height: passcode.keypad.height, backgroundColor: platform === 'ios' ? cssColor(colorValue(project, platform, 'passcode.keypad.background')) : 'transparent' }} onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect('passcode-keypad'); }}>
      {[1,2,3,4,5,6,7,8,9].map((key) => <button type="button" key={key} aria-label={`숫자 ${key} 입력`} className="kt-keypad-key"
        style={{ color: cssColor(colorValue(project, platform, platform === 'android' && pressed === key ? 'passcode.keypad.text.pressed' : 'passcode.keypad.text')) }}
        onPointerDown={(event) => { event.stopPropagation(); setPressed(key); }} onPointerUp={() => setPressed(null)} onPointerCancel={() => setPressed(null)} onPointerLeave={() => setPressed(null)}
        onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); enterDigit(); }}>
        {pressed === key && (pressedImage ? <img className="kt-keypad-pressed-image" src={pressedImage} alt="" /> : platform === 'android' ? <span className="kt-keypad-pressed-color" style={{ backgroundColor: cssColor(colorValue(project, platform, 'passcode.keypad.background.pressed')) }} /> : null)}<span>{key}</span>
      </button>)}
      {platform === 'ios'
        ? <button type="button" className="kt-keypad-cancel" aria-label="키패드 취소" style={{ color: cssColor(colorValue(project, platform, 'passcode.keypad.text')) }} onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); }}>취소</button>
        : <span className="kt-keypad-empty" aria-hidden="true" />}
      <button type="button" aria-label="숫자 0 입력" className="kt-keypad-key"
        style={{ color: cssColor(colorValue(project, platform, platform === 'android' && pressed === 0 ? 'passcode.keypad.text.pressed' : 'passcode.keypad.text')) }}
        onPointerDown={(event) => { event.stopPropagation(); setPressed(0); }} onPointerUp={() => setPressed(null)} onPointerCancel={() => setPressed(null)} onPointerLeave={() => setPressed(null)}
        onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); enterDigit(); }}>
        {pressed === 0 && (pressedImage ? <img className="kt-keypad-pressed-image" src={pressedImage} alt="" /> : platform === 'android' ? <span className="kt-keypad-pressed-color" style={{ backgroundColor: cssColor(colorValue(project, platform, 'passcode.keypad.background.pressed')) }} /> : null)}<span>0</span>
      </button>
      <button type="button" className="kt-keypad-delete" aria-label="한 자리 지우기" style={{ color: cssColor(colorValue(project, platform, 'passcode.keypad.text')) }} onClick={(event) => { event.stopPropagation(); onSelect('passcode-keypad'); deleteDigit(); }}><svg data-source={`${platform}-guide-26.5`} viewBox="0 0 48 31" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 2.5H45.5V28.5H16L2.5 15.5Z" /><path d="m26 10 11 11m0-11L26 21" /></svg></button>
      <span className="edit-hint">숫자 키패드</span>
    </div>
  </div>;
}

export function SplashPreview(props: PreviewProps): React.ReactElement {
  const { project, platform, selected, onSelect } = props;
  if (platform === 'ios') return <div className="kt-screen kt-splash" style={screenStyle(project, platform, 'splash')} onClick={() => onSelect('screen-background')} />;
  const image = resolveResourceUrl(project, platform, 'splash.image');
  return <div className="kt-screen kt-splash" style={screenStyle(project, platform, 'splash')} onClick={() => onSelect('screen-background')}>
    <ThemeBackground project={project} platform={platform} screen="splash" />
    {image && <Editable id="splash-image" label="시작 이미지" selected={selected} onSelect={onSelect} className="kt-splash-content"><img src={image} alt="" /></Editable>}</div>;
}
