"use client";

import { useEffect, useRef, useState } from "react";
import { APPEARANCE_KEY, DEFAULT_APPEARANCE, applyAppearance, readAppearance, type AppearancePreferences } from "@/lib/appearance";

export default function ArtDirectionControl() {
  const [preferences, setPreferences] = useState(DEFAULT_APPEARANCE);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = useRef(preferences);
  const transition = useRef<{ skipTransition: () => void } | null>(null);

  useEffect(() => {
    const restore = () => { const p = readAppearance(); current.current = p; setPreferences(p); applyAppearance(p); };
    restore();
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const system = () => applyAppearance(current.current);
    scheme.addEventListener("change", system); motion.addEventListener("change", system);
    window.addEventListener("storage", restore);
    return () => { scheme.removeEventListener("change", system); motion.removeEventListener("change", system); window.removeEventListener("storage", restore); };
  }, []);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  function change(patch: Partial<AppearancePreferences>, animate = false) {
    const next = { ...current.current, ...patch };
    current.current = next; setPreferences(next);
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)); } catch { /* In-page settings still work. */ }
    transition.current?.skipTransition();
    const reduced = next.motion === "reduced" || (next.motion === "system" && matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (animate && !reduced && document.startViewTransition) {
      transition.current = document.startViewTransition(() => applyAppearance(current.current));
    } else applyAppearance(next);
  }

  function choices<K extends "theme" | "direction" | "contrast" | "motion">(key: K, label: string, options: [AppearancePreferences[K], string][]) {
    return <fieldset><legend>{label}</legend><div className="appearance-options">
      {options.map(([value, text]) => <button key={value} type="button" aria-pressed={preferences[key] === value}
        onClick={() => change({ [key]: value }, key === "theme" || key === "direction")}>{text}</button>)}
    </div></fieldset>;
  }

  return <div className="art-direction-control" onBlur={e => {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="appearance-trigger" aria-expanded={open} aria-controls="appearance-panel"
      onClick={() => setOpen(v => !v)}>外观</button>
    <div ref={panel} id="appearance-panel" className="appearance-panel" inert={!open} data-open={open} aria-label="外观设置">
      <div className="appearance-title"><span>光线与色调</span><button type="button" aria-label="关闭外观设置" onClick={() => { setOpen(false); trigger.current?.focus(); }}>关闭</button></div>
      {choices("theme", "明暗模式", [["light", "浅色"], ["dark", "深色"], ["system", "跟随系统"]])}
      {choices("direction", "视觉方向", [["gallery", "画廊"], ["mineral", "矿物"], ["nocturnal", "夜色"]])}
      <label className="appearance-range">暗度 <span>{preferences.brightness < 92 ? "偏暗" : preferences.brightness > 106 ? "偏亮" : "平衡"}</span>
        <input aria-label="调整场景暗度" type="range" min="72" max="116" value={preferences.brightness} onChange={e => change({ brightness: Number(e.target.value) })} /></label>
      <label className="appearance-range">色彩浓度 <span>{preferences.chroma < 34 ? "淡" : preferences.chroma > 66 ? "浓" : "适中"}</span>
        <input aria-label="调整色彩浓度" type="range" min="0" max="100" value={preferences.chroma} onChange={e => change({ chroma: Number(e.target.value) })} /></label>
      {choices("contrast", "文字对比", [["normal", "标准"], ["high", "增强"]])}
      {choices("motion", "动态效果", [["system", "跟随系统"], ["reduced", "减少"], ["full", "完整"]])}
      <button type="button" className="appearance-reset" onClick={() => change(DEFAULT_APPEARANCE, true)}>恢复默认</button>
    </div>
  </div>;
}
