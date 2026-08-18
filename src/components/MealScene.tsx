"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Dish, { type DishData } from "./Dish";
import type { Persona } from "@/lib/personas";

const MEAL_MS = 12 * 60 * 1000;

/** 记忆物件。选物件，不描述事件——投射性距离。 */
const MEMORY_OBJECTS = [
  { key: "coin", glyph: "◎", name: "一枚旧硬币" },
  { key: "photo", glyph: "▣", name: "一张全家福" },
  { key: "plate", glyph: "○", name: "一个空盘子" },
  { key: "key", glyph: "⚿", name: "一把钥匙" },
  { key: "uniform", glyph: "▤", name: "一件校服" },
  { key: "letter", glyph: "✉", name: "一封没寄出的信" },
];

type Msg = { role: "user" | "assistant"; content: string };
type Source = {
  section: string;
  author: string;
  title: string;
  year?: number;
  license: string;
  sourcePage?: string;
  score: number;
  via: string[];
};

export default function MealScene({ persona }: { persona: Persona }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dish, setDish] = useState<DishData>(null);
  const [dishBusy, setDishBusy] = useState(false);
  const [memory, setMemory] = useState<{ object: string; label: string } | null>(null);
  const [memLabel, setMemLabel] = useState("");
  const [pickingMemory, setPickingMemory] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startedAt = useRef<number>(Date.now());
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // 开场白
  useEffect(() => {
    const o = persona.openings;
    if (o.length) {
      setMessages([{ role: "assistant", content: o[Math.floor(Math.random() * o.length)] }]);
    }
  }, [persona]);

  // 上色进度：这顿饭的唯一计时器，不显示数字
  useEffect(() => {
    const t = setInterval(() => {
      setProgress(Math.min(1, (Date.now() - startedAt.current) / MEAL_MS));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      setError(null);
      const next: Msg[] = [...messages, { role: "user", content: text.trim() }];
      setMessages([...next, { role: "assistant", content: "" }]);
      setInput("");
      setBusy(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            personaId: persona.id,
            messages: next,
            dish,
            memory,
          }),
        });

        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const frames = buf.split("\n\n");
          buf = frames.pop() ?? "";

          for (const frame of frames) {
            const evLine = frame.match(/^event:\s*(.+)$/m);
            const dataLine = frame.match(/^data:\s*(.+)$/m);
            if (!evLine || !dataLine) continue;

            const ev = evLine[1].trim();
            let payload: unknown;
            try {
              payload = JSON.parse(dataLine[1]);
            } catch {
              continue;
            }

            if (ev === "sources") {
              setSources(payload as Source[]);
            } else if (ev === "text") {
              const { text: t } = payload as { text: string };
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: copy[copy.length - 1].content + t,
                };
                return copy;
              });
            } else if (ev === "error") {
              setError((payload as { message: string }).message);
            }
          }
        }
      } catch (err) {
        setError((err as Error).message);
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, persona.id, dish, memory],
  );

  const onPhoto = useCallback(async (file: File) => {
    setDishBusy(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const res = await fetch("/api/dish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: btoa(bin), mediaType: file.type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDish(json as DishData);
      startedAt.current = Date.now();
      setProgress(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDishBusy(false);
    }
  }, []);

  return (
    <main className="relative min-h-screen">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 22%, #2a221a 0%, var(--ink-2) 45%, var(--ink) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
        {/* 抬头 */}
        <header className="flex items-start justify-between gap-4">
          <Link
            href="/"
            className="text-[11px] tracking-widest text-[var(--bone-dim)] transition-colors hover:text-[var(--bone)]"
          >
            ← 离席
          </Link>
          <div className="text-right">
            <div className="text-sm tracking-widest text-[var(--bone)]">{persona.name}</div>
            <div className="text-[10px] tracking-wider text-[var(--bone-dim)]">
              {persona.latin} · {persona.years}
            </div>
          </div>
        </header>

        <div className="mt-4 grid flex-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          {/* 左：桌面 */}
          <section className="flex flex-col items-center gap-4">
            {/* 面具 */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border text-[10px] tracking-widest"
                style={{ borderColor: "var(--edge)", background: "#1a1512", color: "var(--bone-dim)" }}
                title={persona.maskNote}
              >
                {persona.mask}
              </div>
              <div className="max-w-[260px] text-center text-[10px] leading-relaxed text-[var(--bone-dim)] opacity-70">
                {persona.maskNote}
              </div>
            </div>

            <Dish dish={dish} progress={progress} />

            {/* 拍照 */}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPhoto(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={dishBusy}
              className="rounded-sm border px-4 py-1.5 text-[11px] tracking-widest transition-colors disabled:opacity-40"
              style={{ borderColor: "var(--edge)", color: "var(--bone-dim)" }}
            >
              {dishBusy ? "正在落到桌上…" : dish ? "换一张" : "把今天这份放上桌"}
            </button>

            {/* 记忆物件位 */}
            <div className="w-full max-w-[320px]">
              {memory ? (
                <div className="rounded-sm border p-3 text-center" style={{ borderColor: "var(--edge)" }}>
                  <div className="text-lg text-[var(--amber-soft)]">
                    {MEMORY_OBJECTS.find((m) => m.name === memory.object)?.glyph}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--bone)]">{memory.object}</div>
                  {memory.label && (
                    <div className="mt-0.5 text-[10px] italic text-[var(--bone-dim)]">
                      「{memory.label}」
                    </div>
                  )}
                  <button
                    onClick={() => setMemory(null)}
                    className="mt-2 text-[10px] text-[var(--bone-dim)] underline underline-offset-2"
                  >
                    收回来
                  </button>
                </div>
              ) : pickingMemory ? (
                <div className="rounded-sm border p-3" style={{ borderColor: "var(--edge)" }}>
                  <div className="mb-2 text-[10px] leading-relaxed text-[var(--bone-dim)]">
                    放一件东西在桌上。不用解释它。
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MEMORY_OBJECTS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => {
                          setMemory({ object: m.name, label: memLabel.trim() });
                          setPickingMemory(false);
                          setMemLabel("");
                        }}
                        className="rounded-sm border px-2 py-2 text-center transition-colors hover:border-[var(--amber)]"
                        style={{ borderColor: "var(--edge)" }}
                      >
                        <div className="text-base text-[var(--bone-dim)]">{m.glyph}</div>
                        <div className="mt-0.5 text-[9px] text-[var(--bone-dim)]">{m.name}</div>
                      </button>
                    ))}
                  </div>
                  <input
                    value={memLabel}
                    onChange={(e) => setMemLabel(e.target.value)}
                    placeholder="想写一句就写（可以不写）"
                    className="mt-2 w-full bg-transparent text-[11px] text-[var(--bone)] outline-none placeholder:text-[var(--bone-dim)] placeholder:opacity-50"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setPickingMemory(true)}
                  className="w-full rounded-sm border border-dashed py-3 text-[11px] tracking-widest text-[var(--bone-dim)] transition-colors hover:border-[var(--amber)]"
                  style={{ borderColor: "var(--edge)" }}
                >
                  ＋ 桌上还有一个空位
                </button>
              )}
            </div>
          </section>

          {/* 右：对话 */}
          <section className="flex min-h-[420px] flex-col">
            <div ref={scroller} className="flex-1 space-y-5 overflow-y-auto pr-2">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`fade-up whitespace-pre-wrap text-[13px] leading-[1.9] ${
                    m.role === "user"
                      ? "pl-8 text-right text-[var(--bone-dim)]"
                      : "pr-6 text-[var(--bone)]"
                  }`}
                >
                  {m.content || (busy && i === messages.length - 1 ? "…" : "")}
                </div>
              ))}
              {error && (
                <div className="rounded-sm border px-3 py-2 text-[11px] text-[var(--blood)]" style={{ borderColor: "var(--blood)" }}>
                  {error}
                </div>
              )}
            </div>

            {/* 出处：让 RAG 是可验证的，不是黑箱 */}
            {sources.length > 0 && (
              <div className="mt-3 border-t pt-2" style={{ borderColor: "var(--edge)" }}>
                <button
                  onClick={() => setShowSources((v) => !v)}
                  className="text-[10px] tracking-widest text-[var(--bone-dim)]"
                >
                  {showSources ? "▾" : "▸"} 他刚才翻的是哪几页（{sources.length}）
                </button>
                {showSources && (
                  <ul className="mt-1.5 space-y-1.5">
                    {sources.map((s, i) => (
                      <li key={i} className="text-[10px] leading-relaxed text-[var(--bone-dim)]">
                        <span className="text-[var(--amber-soft)]">[{i + 1}]</span>{" "}
                        {s.author}《{s.title}》{s.year ?? ""}
                        <span className="ml-1 opacity-60">
                          · {s.license === "public-domain" ? "公有领域原文" : "概念卡片"} ·{" "}
                          {s.via.join("+")} · {s.score.toFixed(3)}
                        </span>
                        <div className="mt-0.5 opacity-60">{s.section}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 输入 */}
            <div className="mt-3 flex items-end gap-2 border-t pt-3" style={{ borderColor: "var(--edge)" }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={2}
                placeholder="说点什么，或者就这样坐着。"
                className="flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-[var(--bone)] outline-none placeholder:text-[var(--bone-dim)] placeholder:opacity-50"
              />
              <button
                onClick={() => void send(input)}
                disabled={busy || !input.trim()}
                className="shrink-0 rounded-sm border px-3 py-1.5 text-[11px] tracking-widest transition-colors disabled:opacity-30"
                style={{ borderColor: "var(--edge)", color: "var(--bone-dim)" }}
              >
                说
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--bone-dim)] opacity-60">
              这顿饭结束就结束了，不会被记下来。
              {persona.grounding !== "primary" && ` ${persona.groundingNote}`}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
