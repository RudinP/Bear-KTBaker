import type { Platform, ScreenId } from '../domain/theme/model';

const screens: Array<{ id: ScreenId; label: string }> = [
  { id: 'friends', label: '친구' },
  { id: 'chats', label: '채팅 목록' },
  { id: 'chatroom', label: '채팅방' },
  { id: 'notification', label: '알림' },
  { id: 'now', label: '지금' },
  { id: 'more', label: '더보기' },
  { id: 'passcode', label: '잠금화면' },
  { id: 'splash', label: '시작 화면' },
];

export function ScreenRail({
  current,
  platform,
  area,
  onChange,
  onThemeInfo,
  onFont,
  onScreenshots,
}: {
  current: ScreenId;
  platform: Platform;
  area: 'theme-info' | 'font' | 'screens';
  onChange: (screen: ScreenId) => void;
  onThemeInfo: () => void;
  onFont: () => void;
  onScreenshots: () => void;
}) {
  return (
    <nav className="screen-rail" aria-label="꾸밀 화면">
      <div className="sidebar-section-title">프로젝트</div>
      <button className="screen-item" data-active={area === 'theme-info'} aria-pressed={area === 'theme-info'} onClick={onThemeInfo}>
        <span>테마 정보</span>
      </button>
      <button className="screen-item" data-active={area === 'font'} aria-pressed={area === 'font'} onClick={onFont}>
        <span>글씨체</span>
      </button>
      <div className="rail-divider" />
      <div className="sidebar-section-title">화면</div>
      <div className="screen-list">
        {screens.filter((screen) => platform === 'android' || screen.id !== 'splash').map((screen) => (
          <button
            className="screen-item"
            data-active={area === 'screens' && current === screen.id}
            aria-pressed={area === 'screens' && current === screen.id}
            key={screen.id}
            onClick={() => onChange(screen.id)}
          >
            <span>{screen.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-spacer" />
      <div className="sidebar-section-title">내보내기</div>
      <button className="screen-item" onClick={onScreenshots}>
        <span>홍보 이미지</span>
      </button>
    </nav>
  );
}
