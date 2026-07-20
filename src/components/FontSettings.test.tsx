// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultTheme } from "../domain/theme/defaults";
import { FontSettings } from "./FontSettings";

const browserAssets = vi.hoisted(() => ({
  readFontAsset: vi.fn(),
}));

vi.mock("../app/browserAssets", () => browserAssets);

describe("font settings", () => {
  beforeEach(() => {
    browserAssets.readFontAsset.mockReset();
    browserAssets.readFontAsset.mockImplementation(async (file: File) => ({
      family: "Kakao Sans",
      fileName: file.name,
      dataUrl: "data:font/ttf;base64,Zm9udA==",
    }));
  });

  it("reads a font once and applies it to the latest project", async () => {
    const project = createDefaultTheme();
    const onProject = vi.fn();
    render(<FontSettings project={project} onProject={onProject} />);

    fireEvent.change(screen.getByLabelText("미리보기 폰트 파일"), {
      target: {
        files: [new File(["font"], "Kakao Sans.ttf", { type: "font/ttf" })],
      },
    });

    await waitFor(() => expect(onProject).toHaveBeenCalledOnce());
    expect(browserAssets.readFontAsset).toHaveBeenCalledOnce();
    const update = onProject.mock.calls.at(-1)?.[0];
    expect(update).toBeTypeOf("function");
    const newer = { ...project, meta: { ...project.meta, author: "later" } };
    const updated = update(newer);
    expect(updated.meta.author).toBe("later");
    expect(updated.font).toMatchObject({ fileName: "Kakao Sans.ttf" });
  });

  it("clears the current font through a functional change", () => {
    const project = createDefaultTheme();
    project.font = {
      family: "Kakao Sans",
      fileName: "Kakao Sans.ttf",
      dataUrl: "data:font/ttf;base64,Zm9udA==",
    };
    const onProject = vi.fn();
    render(<FontSettings project={project} onProject={onProject} />);

    fireEvent.click(
      screen.getByRole("button", { name: "기본 글씨체로 되돌리기" }),
    );

    const update = onProject.mock.calls.at(-1)?.[0];
    expect(update).toBeTypeOf("function");
    const updated = update(project);
    expect(updated).not.toHaveProperty("font");
  });
});
