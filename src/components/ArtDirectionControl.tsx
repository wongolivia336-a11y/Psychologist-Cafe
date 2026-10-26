"use client";

import { useEffect, useState } from "react";

export type ArtDirection = "gallery" | "mineral" | "nocturnal";

const DEFAULT_BRIGHTNESS = 100;
const MIN_BRIGHTNESS = 72;
const MAX_BRIGHTNESS = 116;

const OPTIONS: { id: ArtDirection; label: string; short: string }[] = [
  { id: "gallery", label: "Gallery White", short: "G" },
  { id: "mineral", label: "Mineral Monochrome", short: "M" },
  { id: "nocturnal", label: "Nocturnal Modernism", short: "N" },
];

function applyDirection(direction: ArtDirection) {
  document.documentElement.dataset.direction = direction;
  try {
    window.sessionStorage.setItem("philosopher-cafe-direction", direction);
  } catch {
    // Private browsing and restricted storage should not affect the scene.
  }
}

function applyBrightness(brightness: number) {
  document.documentElement.dataset.brightness = String(brightness);
  document.documentElement.style.setProperty("--scene-brightness", String(brightness / 100));
  try {
    window.sessionStorage.setItem("philosopher-cafe-brightness", String(brightness));
  } catch {
    // Private browsing and restricted storage should not affect the scene.
  }
}

function readBrightness(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BRIGHTNESS;
  return Math.min(MAX_BRIGHTNESS, Math.max(MIN_BRIGHTNESS, Math.round(parsed)));
}

export default function ArtDirectionControl() {
  const [direction, setDirection] = useState<ArtDirection>("gallery");
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS);

  useEffect(() => {
    let saved: string | null = null;
    let savedBrightness: string | null = null;
    try {
      saved = window.sessionStorage.getItem("philosopher-cafe-direction");
      savedBrightness = window.sessionStorage.getItem("philosopher-cafe-brightness");
    } catch {
      saved = null;
      savedBrightness = null;
    }
    const next = OPTIONS.some((option) => option.id === saved) ? (saved as ArtDirection) : "gallery";
    const nextBrightness = readBrightness(savedBrightness);
    setDirection(next);
    setBrightness(nextBrightness);
    applyDirection(next);
    applyBrightness(nextBrightness);
  }, []);

  const brightnessLabel = brightness < 92 ? "偏暗" : brightness > 106 ? "偏亮" : "平衡";

  return (
    <div className="art-direction-control" aria-label="场景色彩与亮度">
      <div className="art-direction-control__group">
        <span className="art-direction-control__label">色调</span>
        <div className="art-direction-control__options">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={direction === option.id ? "is-active" : ""}
              aria-label={option.label}
              aria-pressed={direction === option.id}
              onClick={() => {
                setDirection(option.id);
                applyDirection(option.id);
              }}
            >
              {option.short}
            </button>
          ))}
        </div>
      </div>

      <label className="art-direction-control__brightness">
        <span className="art-direction-control__label">暗度</span>
        <input
          type="range"
          min={MIN_BRIGHTNESS}
          max={MAX_BRIGHTNESS}
          step={1}
          value={brightness}
          aria-label="调整场景暗度"
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            setBrightness(next);
            applyBrightness(next);
          }}
        />
        <span className="art-direction-control__value" aria-live="polite">{brightnessLabel}</span>
      </label>
    </div>
  );
}
