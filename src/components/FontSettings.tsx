import { readFontAsset } from "../app/browserAssets";
import type { ProjectChangeHandler } from "../app/projectChange";
import type { ThemeProject } from "../domain/theme/model";

export function FontSettings({
  project,
  onProject,
}: {
  project: ThemeProject;
  onProject: ProjectChangeHandler;
}) {
  return (
    <main className="theme-settings-workspace font-settings-workspace">
      <div className="settings-heading">
        <span className="panel-kicker">PREVIEW</span>
        <h2>미리보기 글씨체</h2>
      </div>
      <div className="settings-card font-settings-card">
        <label className="font-picker global-font-picker">
          <input
            type="file"
            aria-label="미리보기 폰트 파일"
            accept=".ttf,.otf,font/ttf,font/otf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void readFontAsset(file).then((font) =>
                onProject((current) => ({ ...current, font })),
              );
            }}
          />
          <span
            className="font-sample"
            style={{ fontFamily: project.font?.family }}
          >
            가나다
          </span>
          <span>
            <b>{project.font?.fileName ?? "기본 글씨체"}</b>
            <small>
              {project.font
                ? "눌러서 다른 폰트 선택"
                : "TTF 또는 OTF 파일 선택"}
            </small>
          </span>
        </label>
        <div className="font-settings-copy">
          <b>전체 미리보기와 홍보 이미지에 적용</b>
          <p>
            카카오톡 테마 형식은 글씨체 파일을 포함하지 않으므로, 완성된
            .ktheme과 .apk에는 폰트가 들어가지 않습니다.
          </p>
          {project.font && (
            <button
              type="button"
              className="ghost-button font-remove"
              onClick={() =>
                onProject((current) => {
                  const { font: _removedFont, ...withoutFont } = current;
                  return withoutFont;
                })
              }
            >
              기본 글씨체로 되돌리기
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
