"use client";

export type DishData = {
  items?: string[];
  colors?: string[];
  palette?: string[];
  temperature?: string;
  vessel?: string;
  note?: string;
} | null;

/**
 * 盘子。它同时是这顿饭的计时器。
 *
 * progress 0 → 1 期间，插画从线稿慢慢上色。没有倒计时、没有百分比、没有"还剩几分钟"。
 * 吃得快的人会看到一张没画完的画——一个不带惩罚的提示。
 */
export default function Dish({
  dish,
  progress,
}: {
  dish: DishData;
  progress: number;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const palette =
    dish?.palette?.filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)) ?? [];
  const fallback = ["#8a5a3c", "#6f7a4a", "#b0894f", "#7a3b2e"];
  const colors = palette.length ? palette : fallback;

  // 食物的形状数量跟着识别结果走，最多 5 个，保证构图不崩
  const n = Math.max(2, Math.min(5, dish?.items?.length ?? 3));
  const blobs = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = 30 + (i % 2) * 12;
    return {
      cx: 150 + Math.cos(angle) * r,
      cy: 132 + Math.sin(angle) * r * 0.55,
      rx: 26 + ((i * 7) % 14),
      ry: 17 + ((i * 5) % 9),
      rot: (i * 47) % 360,
      color: colors[i % colors.length],
      label: dish?.items?.[i],
    };
  });

  return (
    <svg
      viewBox="0 0 300 220"
      className="h-auto w-full max-w-[420px]"
      role="img"
      aria-label={
        dish?.items?.length
          ? `桌上的插画：${dish.items.join("、")}`
          : "桌上还没有放东西"
      }
    >
      <defs>
        <radialGradient id="candleGlow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#c8974a" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#c8974a" stopOpacity="0" />
        </radialGradient>
        <filter id="soft">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
      </defs>

      {/* 烛光落在桌面上的一圈 */}
      <ellipse cx="150" cy="140" rx="140" ry="72" fill="url(#candleGlow)" />

      {/* 盛器：线稿始终在，颜色随进度浮现 */}
      <ellipse
        cx="150"
        cy="140"
        rx="92"
        ry="46"
        fill="#e8dcc8"
        fillOpacity={0.06 + p * 0.16}
        stroke="var(--bone-dim)"
        strokeWidth="1.1"
        strokeOpacity={0.5 + p * 0.35}
      />
      <ellipse
        cx="150"
        cy="136"
        rx="76"
        ry="37"
        fill="none"
        stroke="var(--bone-dim)"
        strokeWidth="0.7"
        strokeOpacity={0.28 + p * 0.3}
      />

      {/* 食物 */}
      {blobs.map((b, i) => {
        // 逐个上色：第 i 块要等到进度过了它的门槛才开始显色
        const gate = i / (blobs.length + 0.6);
        const local = Math.max(0, Math.min(1, (p - gate) / 0.42));
        return (
          <g key={i} transform={`rotate(${b.rot} ${b.cx} ${b.cy})`}>
            <ellipse
              cx={b.cx}
              cy={b.cy}
              rx={b.rx}
              ry={b.ry}
              fill={b.color}
              fillOpacity={local * 0.72}
              filter="url(#soft)"
            />
            <ellipse
              cx={b.cx}
              cy={b.cy}
              rx={b.rx}
              ry={b.ry}
              fill="none"
              stroke={b.color}
              strokeOpacity={0.32 + local * 0.5}
              strokeWidth="1"
            />
          </g>
        );
      })}

      {/* 蒸汽：只在识别为热的时候有，且随进度散去 */}
      {dish?.temperature === "热" && p < 0.75 && (
        <g stroke="var(--bone-dim)" strokeOpacity={0.22 * (1 - p)} fill="none">
          <path d="M132 104 q6 -14 0 -26 q-6 -12 0 -22" strokeWidth="1.1" />
          <path d="M152 100 q6 -14 0 -26 q-6 -12 0 -22" strokeWidth="1.1" />
          <path d="M172 106 q6 -14 0 -26 q-6 -12 0 -22" strokeWidth="1.1" />
        </g>
      )}

      {/* 桌面阴影 */}
      <ellipse cx="150" cy="188" rx="104" ry="12" fill="#000" fillOpacity="0.3" />
    </svg>
  );
}
