"use client";

import { useEffect, useState } from "react";

export type ArtDirection = "gallery" | "mineral" | "nocturnal";

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

export default function ArtDirectionControl() {
  const [direction, setDirection] = useState<ArtDirection>("gallery");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.sessionStorage.getItem("philosopher-cafe-direction");
    } catch {
      saved = null;
    }
    const next = OPTIONS.some((option) => option.id === saved) ? (saved as ArtDirection) : "gallery";
    setDirection(next);
    applyDirection(next);
  }, []);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="art-direction-control" aria-label="开发期视觉方向预览">
      <span className="art-direction-control__label">direction</span>
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
  );
}
