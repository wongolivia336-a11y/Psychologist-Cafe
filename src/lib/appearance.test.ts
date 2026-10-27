import { describe, expect, it } from "vitest";
import { DEFAULT_APPEARANCE, appearanceTokens, normalizeAppearance, oklchHex } from "./appearance";

describe("appearance preferences", () => {
  it("keeps the neutral brightness when no legacy preference exists", () => {
    expect(normalizeAppearance({ brightness: null }).brightness).toBe(100);
  });

  it("bounds persisted controls before they become CSS tokens", () => {
    const preferences = normalizeAppearance({
      direction: "nocturnal", theme: "dark", brightness: 999, chroma: -10,
      contrast: "high", motion: "reduced",
    });
    expect(preferences).toMatchObject({ brightness: 116, chroma: 0, contrast: "high", motion: "reduced" });
  });

  it("produces CSS-safe colors for the complete light and dark token set", () => {
    for (const dark of [false, true]) {
      const tokens = appearanceTokens(DEFAULT_APPEARANCE, dark);
      for (const value of Object.values(tokens)) {
        expect(value).toMatch(/^(#[0-9a-f]{6,8}|[\d.]+)$/i);
      }
    }
    expect(oklchHex(0.65, 0.4, 220)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
