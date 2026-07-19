import { useState } from 'react';
import { rendererOperationErrorText } from '../application/errors/rendererOperationErrorText';
import {
  THEME_STUDIO_UNAVAILABLE_MESSAGE,
  themeStudioClient,
  type ThemeStudioClient,
} from '../app/themeStudioClient';
import type { ThemeProject } from '../domain/theme/model';

export function ExportSheet({
  project,
  onClose,
  client = themeStudioClient,
}: {
  project: ThemeProject;
  onClose(): void;
  client?: Pick<ThemeStudioClient, 'isAvailable' | 'exportIos' | 'exportAndroid'>;
}) {
  const [status, setStatus] = useState<{ kind: 'progress' | 'success' | 'cancel' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (kind: 'ios' | 'android') => {
    if (!client.isAvailable()) {
      setStatus({ kind: 'error', text: THEME_STUDIO_UNAVAILABLE_MESSAGE });
      return;
    }
    setBusy(true);
    setStatus({ kind: 'progress', text: kind === 'android' ? 'Android 테마를 만드는 중이에요…' : '저장 위치를 선택해 주세요.' });
    try {
      if (kind === 'ios') {
        const path = await client.exportIos(project);
        setStatus(path
          ? { kind: 'success', text: 'iPhone용 ktheme 파일을 만들었습니다.' }
          : { kind: 'cancel', text: '저장을 취소했습니다.' });
      } else if (kind === 'android') {
        const result = await client.exportAndroid(project);
        setStatus(result?.path
          ? { kind: 'success', text: 'Android용 APK 파일을 만들었습니다.' }
          : result?.error
            ? { kind: 'error', text: result.error }
            : { kind: 'cancel', text: '저장을 취소했습니다.' });
      }
    } catch (error) {
      setStatus({
        kind: 'error',
        text: rendererOperationErrorText(error, '내보내지 못했습니다.', '파일과 저장 위치를 확인해 주세요.'),
      });
    } finally {
      setBusy(false);
    }
  };
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="테마 완성하기"><div className="export-sheet"><div className="export-head"><div><span className="panel-kicker">내보내기</span><h2>어떤 테마 파일을 만들까요?</h2><p>iPhone과 Android용 설치 파일을 각각 만들 수 있어요.</p></div><button className="circle-close" aria-label="닫기" onClick={onClose}>×</button></div><div className="export-options"><button disabled={busy} onClick={() => run('ios')}><span className="export-format">.ktheme</span><span><b>iPhone 테마</b><small>카카오톡에 설치할 테마 파일</small></span></button><button disabled={busy} onClick={() => run('android')}><span className="export-format">.apk</span><span><b>Android 테마</b><small>카카오톡에 설치할 테마 파일</small></span></button></div>{status && <div className="export-status" data-busy={busy} data-kind={status.kind} role={status.kind === 'error' ? 'alert' : 'status'}><i />{status.text}</div>}</div></div>;
}
