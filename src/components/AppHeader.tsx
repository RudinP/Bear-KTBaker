export interface AppHeaderProps {
  documentName: string;
  isMac: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onNameChange(name: string): void;
  onUndo(): void;
  onRedo(): void;
  onOpen(): void;
  onSave(): void;
  onFinish(): void;
}

export function AppHeader({
  documentName,
  isMac,
  canUndo,
  canRedo,
  onNameChange,
  onUndo,
  onRedo,
  onOpen,
  onSave,
  onFinish,
}: AppHeaderProps) {
  return (
    <header className={`app-toolbar ${isMac ? 'is-mac' : ''}`}>
      <div className="document-title">
        <input
          className="document-name-input"
          aria-label="상단 테마 이름"
          value={documentName}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>
      <div className="toolbar-center">
        <button
          className="toolbar-history"
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
        >
          실행 취소
        </button>
        <button
          className="toolbar-history"
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
        >
          다시 실행
        </button>
      </div>
      <div className="toolbar-actions">
        <button className="ghost-button" onClick={onOpen}>
          불러오기
        </button>
        <button className="ghost-button" onClick={onSave}>
          프로젝트 저장
        </button>
        <button className="primary-button" onClick={onFinish}>
          테마 완성하기
        </button>
      </div>
    </header>
  );
}
