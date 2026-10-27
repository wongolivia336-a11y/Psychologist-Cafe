export type AppearancePreferences = {
  version: 1;
  direction: "gallery" | "mineral" | "nocturnal";
  theme: "light" | "dark" | "system";
  brightness: number;
  chroma: number;
  contrast: "normal" | "high";
  motion: "system" | "reduced" | "full";
};
export const APPEARANCE_KEY = "cafe:appearance:v1";
export const DEFAULT_APPEARANCE: AppearancePreferences = {
  version: 1, direction: "gallery", theme: "system", brightness: 100,
  chroma: 50, contrast: "normal", motion: "system",
};
export function normalizeAppearance(value: unknown): AppearancePreferences {
  const p = value && typeof value === "object" ? value as Partial<AppearancePreferences> : {};
  const number = (v: unknown, low: number, high: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(low, Math.min(high, Math.round(v))) : fallback;
  return {
    version: 1,
    direction: ["gallery", "mineral", "nocturnal"].includes(p.direction ?? "") ? p.direction! : "gallery",
    theme: ["light", "dark", "system"].includes(p.theme ?? "") ? p.theme! : "system",
    brightness: number(p.brightness, 72, 116, 100),
    chroma: number(p.chroma, 0, 100, 50),
    contrast: p.contrast === "high" ? "high" : "normal",
    motion: ["system", "reduced", "full"].includes(p.motion ?? "") ? p.motion! : "system",
  };
}
// Bounded OKLCH -> sRGB shared by CSS, Canvas and Three. Reduce chroma at the gamut boundary.
export function oklchHex(lightness: number, chroma: number, hue: number): string {
  const linear = (c: number) => {
    const a = c*Math.cos(hue*Math.PI/180), b = c*Math.sin(hue*Math.PI/180);
    const l = (lightness+0.3963377774*a+0.2158037573*b)**3;
    const m = (lightness-0.1055613458*a-0.0638541728*b)**3;
    const s = (lightness-0.0894841775*a-1.291485548*b)**3;
    return [4.0767416621*l-3.3077115913*m+0.2309699292*s,
      -1.2684380046*l+2.6097574011*m-0.3413193965*s,
      -0.0041960863*l-0.7034186147*m+1.707614701*s];
  };
  let c = chroma, rgb = linear(c);
  while (c > 0.0001 && rgb.some(v => v < 0 || v > 1)) { c *= 0.9; rgb = linear(c); }
  return "#" + rgb.map(v => {
    v = Math.max(0, Math.min(1, v));
    return Math.round(255*(v <= 0.0031308 ? 12.92*v : 1.055*v**(1/2.4)-0.055)).toString(16).padStart(2, "0");
  }).join("");
}
export function appearanceTokens(p: AppearancePreferences, systemDark: boolean) {
  const dark = p.theme === "dark" || (p.theme === "system" && systemDark), high = p.contrast === "high";
  const hue = { gallery: 235, mineral: 195, nocturnal: 250 }[p.direction], c = p.chroma/100;
  const shift = (p.brightness-100)/100, bgL = dark ? 0.19+shift*0.14 : 0.96+shift*0.16;
  const color = (l: number, saturation = 0.015) => oklchHex(l, saturation*c, hue);
  const primary = dark ? "#eef1ef" : "#172126", secondary = dark ? "#bdc8cb" : "#3e5058";
  const muted = dark ? (high ? "#d3dcde" : "#a8b8bf") : (high ? "#25383f" : "#45575f");
  const accent = color(dark ? 0.81 : 0.43, 0.11);
  return {
    "--ink": color(bgL), "--ink-raised": color(dark ? bgL+0.045 : bgL-0.035),
    "--ink-soft": color(dark ? bgL+0.07 : bgL-0.065),
    "--moss": color(dark ? bgL+0.09 : bgL-0.045, 0.025), "--moss-soft": color(dark ? 0.38 : 0.76, 0.03),
    "--walnut": color(dark ? 0.43 : 0.48, 0.035), "--walnut-light": color(dark ? 0.57 : 0.68, 0.035),
    "--candle": accent, "--candle-light": accent,
    "--paper": primary, "--paper-soft": high ? primary : secondary, "--paper-faint": muted,
    "--line": dark ? "#a9bac036" : "#344d5638", "--line-strong": high ? muted : dark ? "#b4c6cc80" : "#344d5680",
    "--shadow": dark ? "#00000052" : "#27343a1f", "--danger": dark ? "#f1aaa3" : "#803331",
    "--success": dark ? "#b4cebf" : "#365846",
    "--scene-light": "#f1f2ee", "--scene-shadow": dark ? "#18232a" : "#7b8b8e",
    "--scene-ceramic": dark ? "#b4c1c0" : "#e9eeeb", "--scene-paper": dark ? "#a8b7b6" : "#e2e7e1",
    "--scene-exposure": String(1+shift*0.45),
  };
}
export function applyAppearance(p: AppearancePreferences) {
  const root = document.documentElement;
  const dark = p.theme === "dark" || (p.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const reduced = p.motion === "reduced" || (p.motion === "system" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  root.dataset.direction = p.direction; root.dataset.theme = dark ? "dark" : "light";
  root.dataset.contrast = p.contrast; root.dataset.motion = reduced ? "reduced" : "full";
  root.style.colorScheme = dark ? "dark" : "light";
  const tokens = appearanceTokens(p, dark);
  Object.entries(tokens).forEach(([name, value]) => root.style.setProperty(name, value));
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute("content", tokens["--ink"]));
  window.dispatchEvent(new Event("cafe:appearance"));
}
export function readAppearance(): AppearancePreferences {
  try {
    const saved = localStorage.getItem(APPEARANCE_KEY);
    if (saved) return normalizeAppearance(JSON.parse(saved));
    const direction = sessionStorage.getItem("philosopher-cafe-direction");
    const brightness = sessionStorage.getItem("philosopher-cafe-brightness");
    return normalizeAppearance({ direction, brightness: brightness === null ? 100 : Number(brightness),
      theme: direction === "nocturnal" ? "dark" : direction ? "light" : "system" });
  } catch { return { ...DEFAULT_APPEARANCE }; }
}
// Same implementation before first paint and after hydration; generated at build time.
export const APPEARANCE_BOOTSTRAP = `(()=>{const APPEARANCE_KEY=${JSON.stringify(APPEARANCE_KEY)};
const DEFAULT_APPEARANCE=${JSON.stringify(DEFAULT_APPEARANCE)};
${normalizeAppearance.toString()};${oklchHex.toString()};${appearanceTokens.toString()};
${applyAppearance.toString()};${readAppearance.toString()};
applyAppearance(readAppearance());})();`;
