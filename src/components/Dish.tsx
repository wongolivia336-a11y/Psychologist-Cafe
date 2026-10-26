"use client";

import { useEffect, useRef, useState } from "react";

export type DishData = {
  items?: string[];
  colors?: string[];
  palette?: string[];
  temperature?: string;
  vessel?: string;
  note?: string;
} | null;

type Palette = {
  ink: string;
  paper: string;
  muted: string;
  line: string;
  accent: string;
  surface: string;
};

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function rgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  if (![3, 6].includes(clean.length)) return `rgba(71, 111, 135, ${alpha})`;
  const value = clean.length === 3 ? clean.split("").map((part) => part + part).join("") : clean;
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function blobPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number,
) {
  const points = Array.from({ length: 9 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2;
    const wobble = 0.88 + ((index * 13) % 17) / 100;
    const x = Math.cos(angle) * rx * wobble;
    const y = Math.sin(angle) * ry * wobble;
    return {
      x: cx + x * Math.cos(rotation) - y * Math.sin(rotation),
      y: cy + x * Math.sin(rotation) + y * Math.cos(rotation),
    };
  });

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[i - 1];
    ctx.quadraticCurveTo(previous.x, previous.y, (previous.x + current.x) / 2, (previous.y + current.y) / 2);
  }
  ctx.quadraticCurveTo(points[points.length - 1].x, points[points.length - 1].y, points[0].x, points[0].y);
  ctx.closePath();
}

function drawStillLife(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dish: DishData,
  reveal: number,
) {
  const scale = Math.min(width / 360, height / 260);
  const palette: Palette = {
    ink: cssVar("--paper", "#20272b"),
    paper: cssVar("--ink", "#f1f2ee"),
    muted: cssVar("--paper-faint", "#77878b"),
    line: cssVar("--line-strong", "rgba(32,39,43,.3)"),
    accent: cssVar("--candle", "#476f87"),
    surface: cssVar("--ink-raised", "#e2e6e3"),
  };

  const colors = dish?.palette?.filter((color) => /^#[0-9a-f]{3,8}$/i.test(color)) ?? [];
  const fallback = ["#778b91", "#8da29b", "#9b8b79", "#607988"];
  const foodColors = colors.length ? colors : fallback;
  const items = dish?.items ?? [];

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(scale, scale);

  const w = 360;
  const h = 260;
  const table = ctx.createLinearGradient(0, 170, 0, h);
  table.addColorStop(0, rgba(palette.surface, 0.35));
  table.addColorStop(1, rgba(palette.ink, 0.08));
  ctx.fillStyle = table;
  ctx.beginPath();
  ctx.moveTo(0, 168);
  ctx.lineTo(w, 188);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = rgba(palette.line, 0.45);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, 168);
  ctx.lineTo(w, 188);
  ctx.stroke();

  ctx.save();
  ctx.translate(174, 165);
  ctx.scale(1.2, 0.36);
  ctx.fillStyle = rgba(palette.ink, 0.15);
  ctx.filter = "blur(7px)";
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const ceramic = ctx.createLinearGradient(112, 90, 200, 166);
  ceramic.addColorStop(0, rgba(palette.paper, 0.92));
  ceramic.addColorStop(0.48, rgba(palette.surface, 0.88));
  ceramic.addColorStop(1, rgba(palette.muted, 0.28));
  ctx.fillStyle = ceramic;
  ctx.strokeStyle = rgba(palette.ink, 0.55);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(166, 139, 93, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = rgba(palette.line, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(166, 135, 76, 31, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(palette.paper, 0.72);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(166, 137, 84, Math.PI * 1.13, Math.PI * 1.78);
  ctx.stroke();

  if (items.length) {
    items.slice(0, 5).forEach((_, index) => {
      const angle = (index / Math.max(items.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const cx = 166 + Math.cos(angle) * (30 + (index % 2) * 12);
      const cy = 130 + Math.sin(angle) * (13 + (index % 2) * 4);
      const rx = 21 + ((index * 7) % 14);
      const ry = 12 + ((index * 5) % 7);
      const rotation = (index * 0.47) % 1.4 - 0.7;
      const local = Math.max(0, Math.min(1, reveal * 1.25 - index * 0.16));

      ctx.save();
      ctx.shadowColor = rgba(palette.ink, 0.25);
      ctx.shadowBlur = 7;
      ctx.shadowOffsetY = 4;
      blobPath(ctx, cx, cy, rx, ry, rotation);
      const ingredient = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      ingredient.addColorStop(0, rgba(foodColors[index % foodColors.length], 0.96 * local));
      ingredient.addColorStop(0.65, rgba(foodColors[index % foodColors.length], 0.72 * local));
      ingredient.addColorStop(1, rgba(palette.ink, 0.18 * local));
      ctx.fillStyle = ingredient;
      ctx.fill();
      ctx.restore();

      ctx.save();
      blobPath(ctx, cx, cy - 1, rx - 2, ry - 2, rotation);
      ctx.strokeStyle = rgba(palette.paper, 0.38 * local);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    });
  } else {
    ctx.strokeStyle = rgba(palette.accent, 0.46);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(157, 127);
    ctx.lineTo(175, 145);
    ctx.moveTo(175, 127);
    ctx.lineTo(157, 145);
    ctx.stroke();
  }

  // A glass and a sheet of paper establish the scene's scale and camera.
  ctx.save();
  ctx.translate(259, 113);
  ctx.rotate(-0.08);
  const glass = ctx.createLinearGradient(-18, 0, 18, 0);
  glass.addColorStop(0, rgba(palette.accent, 0.04));
  glass.addColorStop(0.5, rgba(palette.paper, 0.26));
  glass.addColorStop(1, rgba(palette.accent, 0.08));
  ctx.fillStyle = glass;
  ctx.strokeStyle = rgba(palette.ink, 0.42);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-16, -28);
  ctx.quadraticCurveTo(0, -22, 16, -28);
  ctx.lineTo(12, 27);
  ctx.quadraticCurveTo(0, 34, -12, 27);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -28, 16, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(palette.paper, 0.72);
  ctx.beginPath();
  ctx.moveTo(-8, -20);
  ctx.lineTo(-6, 18);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(72, 110);
  ctx.rotate(-0.12);
  ctx.fillStyle = rgba(palette.paper, 0.9);
  ctx.strokeStyle = rgba(palette.ink, 0.32);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-34, -27);
  ctx.lineTo(31, -20);
  ctx.lineTo(26, 30);
  ctx.lineTo(-39, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = rgba(palette.accent, 0.42);
  ctx.lineWidth = 0.7;
  for (let line = 0; line < 4; line += 1) {
    ctx.beginPath();
    ctx.moveTo(-27, -11 + line * 8);
    ctx.lineTo(18, -6 + line * 8);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

/**
 * Procedural still-life renderer used until a measured Blender asset is available.
 * It is a real canvas scene with geometry, material gradients, contact shadows and a fixed camera,
 * rather than a collection of decorative SVG ellipses.
 */
export default function Dish({ dish }: { dish: DishData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reveal, setReveal] = useState(dish?.items?.length ? 0 : 0);

  useEffect(() => {
    const target = dish?.items?.length ? 1 : 0;
    let frame = 0;
    let started = 0;
    const duration = 900;
    const from = reveal;

    const tick = (time: number) => {
      if (!started) started = time;
      const next = Math.min(1, (time - started) / duration);
      setReveal(from + (target - from) * (1 - Math.pow(1 - next, 3)));
      if (next < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // The animation is intentionally tied to a scene change, never to meal duration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dish]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      drawStillLife(context, canvas.width / ratio, canvas.height / ratio, dish, reveal);
    };

    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    render();
    return () => observer.disconnect();
  }, [dish, reveal]);

  return (
    <div className="dish-canvas-wrap">
      <canvas ref={canvasRef} className="dish-canvas" role="img" aria-label={dish?.items?.length ? `桌上的静物：${dish.items.join("、")}` : "桌上还没有放下一件静物"} />
      {!dish?.items?.length && <span className="dish-empty-label">等一件景物</span>}
    </div>
  );
}
