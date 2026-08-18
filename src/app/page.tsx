import Link from "next/link";
import { PERSONAS } from "@/lib/personas";

/**
 * 大堂：固定机位、一屏、不可行走。绣湖语法。
 * 亮着的桌子可以坐过去；暗的桌子有人，但「还不到时候」。
 */
export default function Lobby() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* 墙面与地板 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, var(--ink) 0%, var(--ink-2) 38%, var(--moss) 39%, #191512 100%)",
        }}
      />
      {/* 远处窗户：唯一的冷光源 */}
      <div
        className="absolute left-[8%] top-[14%] h-[18%] w-[13%] opacity-25"
        style={{
          background:
            "linear-gradient(160deg, #4a5a58 0%, #232c24 100%)",
          boxShadow: "0 0 90px 30px rgba(74,90,88,0.15)",
        }}
      />

      <header className="relative z-10 px-8 pt-12 sm:px-16">
        <h1 className="text-2xl tracking-[0.35em] text-[var(--bone)]">在　场</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--bone-dim)]">
          给独自吃饭的人，一顿有人在场的饭。
          <br />
          选一张亮着灯的桌子坐下。
        </p>
      </header>

      {/* 桌子 */}
      <div className="relative z-10 mx-auto mt-6 h-[62vh] w-full max-w-5xl">
        {PERSONAS.map((p) => {
          const inner = (
            <div className="flex flex-col items-center gap-2">
              {/* 烛火 */}
              <div className="relative h-10 w-10">
                {p.unlocked ? (
                  <>
                    <div
                      className="candle absolute inset-0 rounded-full blur-md"
                      style={{ background: "var(--amber)", opacity: 0.55 }}
                    />
                    <div
                      className="candle absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ background: "var(--amber-soft)" }}
                    />
                  </>
                ) : (
                  <div
                    className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ background: "#3a322a" }}
                  />
                )}
              </div>

              {/* 桌面 */}
              <div
                className="h-[10px] w-28 rounded-[50%]"
                style={{
                  background: p.unlocked ? "var(--wood-2)" : "#2a231c",
                  boxShadow: p.unlocked
                    ? "0 0 40px 14px rgba(200,151,74,0.13)"
                    : "none",
                }}
              />

              <div className="mt-1 text-center">
                <div
                  className="text-[13px] tracking-widest"
                  style={{ color: p.unlocked ? "var(--bone)" : "#4e453b" }}
                >
                  {p.unlocked ? p.name : "—"}
                </div>
                <div
                  className="mt-0.5 text-[10px] tracking-wider"
                  style={{ color: p.unlocked ? "var(--bone-dim)" : "#3d362e" }}
                >
                  {p.unlocked ? p.latin : "还不到时候"}
                </div>
              </div>
            </div>
          );

          const style = {
            left: `${p.table.x}%`,
            top: `${p.table.y}%`,
          } as const;

          return p.unlocked ? (
            <Link
              key={p.id}
              href={`/table/${p.id}`}
              style={style}
              className="group absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-500 hover:scale-[1.04]"
              title={p.tagline}
            >
              {inner}
            </Link>
          ) : (
            <div
              key={p.id}
              style={style}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-not-allowed select-none opacity-70"
              title="还不到时候"
            >
              {inner}
            </div>
          );
        })}
      </div>

      <footer className="relative z-10 px-8 pb-10 text-[11px] leading-relaxed text-[var(--bone-dim)] sm:px-16">
        <p>
          这不是心理咨询，也不是诊疗工具。这里没有任何数字，不记录你吃了什么，也不会统计你来过几次。
        </p>
        <p className="mt-1 opacity-70">
          如果你正处在危险中，请联系 12356 全国心理援助热线。
        </p>
      </footer>
    </main>
  );
}
