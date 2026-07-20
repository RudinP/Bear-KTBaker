import { describe, expect, it } from "vitest";
import { createDefaultTheme } from "../../src/domain/theme/defaults";
import { parseThemeProjectRequest } from "./requestValidation";

describe("IPC validation after a theme import", () => {
  it("accepts an imported theme when it crosses the IPC boundary again", () => {
    const project = createDefaultTheme("다시 불러온 테마", false);

    expect(project).not.toHaveProperty("baseSample");
    expect(() =>
      parseThemeProjectRequest(structuredClone(project)),
    ).not.toThrow();
  });
});
