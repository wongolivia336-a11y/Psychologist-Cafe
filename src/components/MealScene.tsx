"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Dish, { type DishData } from "./Dish";
import ArtDirectionControl from "./ArtDirectionControl";
import type { Persona } from "@/lib/personas";

type MemoryKey = "coin" | "photo" | "plate" | "key" | "uniform" | "letter";

const MEMORY_OBJECTS: { key: MemoryKey; name: string }[] = [
  { key: "coin", name: "一枚旧硬币" },
  { key: "photo", name: "一张全家福" },
  { key: "plate", name: "一个空盘子" },
  { key: "key", name: "一把钥匙" },
  { key: "uniform", name: "一件校服" },
  { key: "letter", name: "一封没寄出的信" },
];

type Msg = { role: "user" | "assistant"; content: string };
type Source = {
  id?: string;
  section: string;
  author: string;
  title: string;
  license: string;
  sourcePage?: string;
};

function ObjectGlyph({ kind }: { kind: MemoryKey }) {
  const common = {
    width: 27,
    height: 27,
    viewBox: "0 0 27 27",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "coin") {
    return <svg {...common}><circle cx="13.5" cy="13.5" r="8" /><path d="M10.5 10.5c2-1.4 4.9-.8 5.7 1.2.7 1.9-.8 3.2-2.7 3.2-1.8 0-2.8.8-2.3 2.1.5 1.4 2.5 2 4.4 1.1" /></svg>;
  }

  if (kind === "photo") {
    return <svg {...common}><rect x="5" y="6.5" width="17" height="14" rx="1" /><circle cx="10" cy="11" r="1.6" /><path d="m7 18 4.2-4 3.2 2.7 2.4-2.1 3.2 3.4" /></svg>;
  }

  if (kind === "plate") {
    return <svg {...common}><ellipse cx="13.5" cy="14" rx="9" ry="6" /><ellipse cx="13.5" cy="13.3" rx="6.6" ry="3.8" /><path d="M4.5 14c.7 3.3 4.5 5.6 9 5.6s8.3-2.3 9-5.6" /></svg>;
  }

  if (kind === "key") {
    return <svg {...common}><circle cx="9.5" cy="11" r="3.4" /><path d="m12 13.5 8.5 8.5M17 18.5l2-2M14.8 16.3l2-2" /></svg>;
  }

  if (kind === "uniform") {
    return <svg {...common}><path d="m9 6 4.5 3L18 6l3.8 3.1-2.2 4.1-2.2-1.4v9.1H9.6v-9.1l-2.2 1.4-2.2-4.1L9 6Z" /><path d="M13.5 9v11.9M11.5 12h4" /></svg>;
  }

  return <svg {...common}><path d="M5 7.5h17v12H5z" /><path d="m5.5 8 8 6 8-6M5 19l5.8-5.2M22 19l-5.8-5.2" /></svg>;
}

export default function MealScene({ persona }: { persona: Persona }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dish, setDish] = useState<DishData>(null);
  const [dishBusy, setDishBusy] = useState(false);
  const [memory, setMemory] = useState<{ key: MemoryKey; object: string; label: string } | null>(null);
  const [memLabel, setMemLabel] = useState("");
  const [pickingMemory, setPickingMemory] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crisisActive, setCrisisActive] = useState(false);
  const [sceneKind, setSceneKind] = useState<"observe" | "respond" | "question" | "silence">("observe");

  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const o = persona.openings;
    if (o.length) setMessages([{ role: "assistant", content: o[Math.floor(Math.random() * o.length)] }]);
  }, [persona]);

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
            memory: memory ? { object: memory.object, label: memory.label } : null,
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

            if (ev === "crisis") {
              setCrisisActive(true);
            } else if (ev === "scene") {
              setSceneKind((payload as { kind: "observe" | "respond" | "question" | "silence" }).kind);
            } else if (ev === "sources") {
              setSources(payload as Source[]);
            } else if (ev === "text") {
              const { text: chunk } = payload as { text: string };
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: "assistant",
                  content: copy[copy.length - 1].content + chunk,
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
    [busy, dish, memory, messages, persona.id],
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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDishBusy(false);
    }
  }, []);

  return (
    <main className="meal-shell">
      <div className="meal-layout">
        <header className="meal-header">
          <Link href="/" className="quiet-link">← 离席</Link>
          <ArtDirectionControl />
          <div className="persona-heading">
            <div className="scene-kicker">桌边来客</div>
            <div className="persona-heading__name">{persona.name}</div>
            <div className="persona-heading__latin">{persona.latin}</div>
          </div>
        </header>

        <div className="meal-grid">
          <section className="table-stage" aria-label="桌上的静物">
            <div className="mask-seat">
              <div className="mask-seat__object" title={persona.maskNote}>{persona.mask}</div>
              <div className="mask-seat__note">{persona.maskNote}</div>
            </div>

            <div className="dish-stage">
              <Dish dish={dish} />
            </div>

            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPhoto(f);
                e.target.value = "";
              }}
            />
            <div className="ritual-actions">
              <button type="button" onClick={() => fileInput.current?.click()} disabled={dishBusy} className="ritual-button">
                {dishBusy ? "正在落到桌上…" : dish ? "换一幅静物" : "把眼前这一份放上桌"}
              </button>
            </div>

            <div className="object-tray">
              {memory ? (
                <div className="object-settled">
                  <div className="object-settled__copy">
                    <ObjectGlyph kind={memory.key} />
                    <span>
                      {memory.object}
                      {memory.label && <span className="object-settled__label">「{memory.label}」</span>}
                    </span>
                  </div>
                  <button type="button" onClick={() => setMemory(null)} className="quiet-link">收回来</button>
                </div>
              ) : pickingMemory ? (
                <>
                  <div className="object-tray__label">放一件东西在桌上。不用解释它。</div>
                  <div className="object-tray__grid">
                    {MEMORY_OBJECTS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setMemory({ key: item.key, object: item.name, label: memLabel.trim() });
                          setPickingMemory(false);
                          setMemLabel("");
                        }}
                        className="object-token"
                      >
                        <ObjectGlyph kind={item.key} />
                        <span className="object-token__name">{item.name}</span>
                      </button>
                    ))}
                  </div>
                  <input
                    value={memLabel}
                    onChange={(e) => setMemLabel(e.target.value)}
                    placeholder="想写一句就写（可以不写）"
                    className="field-note"
                    aria-label="记忆物件的补充说明"
                  />
                </>
              ) : (
                <button type="button" onClick={() => setPickingMemory(true)} className="ritual-button w-full">
                  桌上还有一个空位
                </button>
              )}
            </div>
          </section>

          <section className={`conversation-panel${sceneKind === "silence" ? " conversation-panel--silence" : ""}`} aria-label="桌边的谈话">
            <div className="conversation-heading">
              <div className="conversation-heading__title">桌边的谈话</div>
              <div className="conversation-heading__note">可以说，也可以坐着</div>
            </div>

            <div ref={scroller} className="conversation-scroll" aria-busy={busy}>
              {messages.map((message, index) => {
                const pending = busy && index === messages.length - 1 && !message.content;
                const guest = message.role === "user";
                return (
                  <div key={`${message.role}-${index}`} className={`conversation-entry fade-up${guest ? " conversation-entry--guest" : ""}`}>
                    <div className="conversation-entry__mark">{guest ? "你" : "他"}</div>
                    <div className="conversation-entry__body">
                      {pending ? (
                        <span className="turn-waiting"><span className="turn-waiting__ember" />他在看</span>
                      ) : message.content}
                    </div>
                  </div>
                );
              })}
              {error && <div className="error-note" role="alert">{error}</div>}
            </div>

            {sources.length > 0 && (
              <div className="source-drawer">
                <button type="button" onClick={() => setShowSources((v) => !v)} className="source-drawer__toggle" aria-expanded={showSources}>
                  {showSources ? "收起原页" : "翻开他刚才看过的原页"}
                </button>
                {showSources && (
                  <ul className="source-drawer__list">
                    {sources.map((source, index) => (
                      <li key={`${source.title}-${index}`} className="source-drawer__item">
                        {source.sourcePage ? (
                          <a href={source.sourcePage} target="_blank" rel="noreferrer">{source.author}《{source.title}》</a>
                        ) : (
                          <span>{source.author}《{source.title}》</span>
                        )}
                        <span className="source-drawer__section">
                          {source.license === "public-domain" ? "公有领域原文" : source.license === "original-summary" ? "概念卡片" : "授权文本"} · {source.section}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="conversation-form">
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
                className="conversation-input"
                aria-label="对桌边来客说话"
              />
              <button type="button" onClick={() => void send(input)} disabled={busy || !input.trim()} className="conversation-submit">
                落下一句
              </button>
            </div>
            <p className="conversation-footnote">
              这顿饭结束就结束了，不会被记下来。{crisisActive ? " 你可以先离开桌边，去找一个真实的人。" : persona.grounding !== "primary" ? ` ${persona.groundingNote}` : ""}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
