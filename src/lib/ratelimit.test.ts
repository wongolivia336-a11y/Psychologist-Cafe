import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _setStore, checkLimit, clientIp, limitResponse } from "./ratelimit";

/** 可控的内存存储：和 MemoryStore 行为一致，但能在测试里看到内部状态 */
function fakeStore() {
  const m = new Map<string, number>();
  return {
    m,
    async incr(key: string) {
      const n = (m.get(key) ?? 0) + 1;
      m.set(key, n);
      return n;
    },
  };
}

describe("checkLimit", () => {
  let store: ReturnType<typeof fakeStore>;
  beforeEach(() => {
    store = fakeStore();
    _setStore(store);
    process.env.CAFE_RL_CHAT = "3";
    process.env.CAFE_DAILY_CHAT = "5";
  });
  afterEach(() => {
    _setStore(null);
    delete process.env.CAFE_RL_CHAT;
    delete process.env.CAFE_DAILY_CHAT;
  });

  it("窗口内不超额则放行", async () => {
    const now = new Date("2026-09-15T10:00:00Z");
    for (let i = 0; i < 3; i++) expect((await checkLimit("chat", "1.1.1.1", now)).ok).toBe(true);
  });

  it("同一 IP 超过窗口额度被拒，并告知多久后再来", async () => {
    const now = new Date("2026-09-15T10:00:00Z");
    for (let i = 0; i < 3; i++) await checkLimit("chat", "1.1.1.1", now);
    const v = await checkLimit("chat", "1.1.1.1", now);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toBe("ip");
      expect(v.retryAfterSec).toBeGreaterThan(0);
      expect(v.retryAfterSec).toBeLessThanOrEqual(600);
    }
  });

  it("不同 IP 各算各的", async () => {
    const now = new Date("2026-09-15T10:00:00Z");
    for (let i = 0; i < 3; i++) await checkLimit("chat", "1.1.1.1", now);
    expect((await checkLimit("chat", "2.2.2.2", now)).ok).toBe(true);
  });

  it("换 IP 也绕不过全局日预算", async () => {
    const now = new Date("2026-09-15T10:00:00Z");
    for (let i = 0; i < 5; i++) await checkLimit("chat", `10.0.0.${i}`, now);
    const v = await checkLimit("chat", "10.0.0.99", now);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("budget");
  });

  it("日预算按 UTC 日切换", async () => {
    const d1 = new Date("2026-09-15T23:59:00Z");
    for (let i = 0; i < 5; i++) await checkLimit("chat", `10.0.0.${i}`, d1);
    expect((await checkLimit("chat", "10.0.0.99", d1)).ok).toBe(false);
    const d2 = new Date("2026-09-16T00:01:00Z");
    expect((await checkLimit("chat", "10.0.0.99", d2)).ok).toBe(true);
  });

  it("chat 与 dish 额度互不影响", async () => {
    const now = new Date("2026-09-15T10:00:00Z");
    for (let i = 0; i < 3; i++) await checkLimit("chat", "1.1.1.1", now);
    expect((await checkLimit("dish", "1.1.1.1", now)).ok).toBe(true);
  });

  it("存储抛错时放行而不是把产品拖死", async () => {
    _setStore({ incr: async () => { throw new Error("redis down"); } });
    expect((await checkLimit("chat", "1.1.1.1")).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("优先取 x-forwarded-for 的第一个", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("没有头时不崩", () => {
    expect(clientIp(new Headers())).toBe("anon");
  });
});

describe("limitResponse", () => {
  it("429 + retry-after + 前端能读的 error 字段", async () => {
    const res = limitResponse({ ok: false, reason: "ip", retryAfterSec: 42 });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    const body = (await res.json()) as { error: string };
    expect(body.error.length).toBeGreaterThan(0);
    expect(body.error).not.toMatch(/rate|limit/i);
  });
});
