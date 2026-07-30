import { describe, expect, it } from "vitest";
import { BUILTIN_THEMES, createTheme } from "./theme-utils.ts";

describe("createTheme", () => {
  it("derives a complete semantic palette from four seed colors", () => {
    const theme = createTheme("custom-test", "Test", false, {
      mode: "dark",
      background: "#080b10",
      surface: "#121821",
      accent: "#55aaff",
      text: "#f5f7fa",
    });

    expect(theme.colors.bg).toBe("#080b10");
    expect(theme.colors.panel).toBe("#121821");
    expect(theme.colors.panel2).toMatch(/^#[0-9a-f]{6}$/);
    expect(theme.colors.border).not.toBe(theme.colors.panel);
    expect(["#0a0c10", "#ffffff"]).toContain(theme.colors.accentContrast);
  });

  it("keeps the application accent readable on a light accent", () => {
    const theme = createTheme("custom-light-accent", "Light accent", false, {
      mode: "light",
      background: "#f4f6f8",
      surface: "#ffffff",
      accent: "#f4ce55",
      text: "#17202b",
    });

    expect(theme.colors.accentContrast).toBe("#0a0c10");
  });
});

describe("BUILTIN_THEMES", () => {
  it("contains both dark and light presets", () => {
    expect(BUILTIN_THEMES.some((theme) => theme.seed.mode === "dark")).toBe(true);
    expect(BUILTIN_THEMES.some((theme) => theme.seed.mode === "light")).toBe(true);
  });
});
