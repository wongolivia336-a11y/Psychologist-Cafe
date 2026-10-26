/**
 * 限流。这两个接口没有登录、直接花 API 钱，不设限就是把 key 挂在公网上。
 *
 * 两层：
 *   1. 每个 IP 的固定窗口（防单人刷）
 *   2. 全局日预算（防整体被烧穿：脚本换 IP 很容易，换不掉的是总量）
 *
 * 存储：
 *   - 设置 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN 时走 Upstash，
 *     所有实例共享计数，这是线上该用的。
 *   - 否则退回进程内存。Vercel 每个函数实例各算各的、冷启动就清零，
 *     只挡得住突发；README 写明了这一点，不要把它当成已经限住了。
 */

export type Scope = "chat" | "dish";

type Rule = { perIp: number; windowSec: number; daily: number };

function int(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** 视觉识别比对话贵一个量级，额度更紧 */
function rules(scope: Scope): Rule {
  return scope === "chat"
    ? { perIp: int("CAFE_RL_CHAT", 30), windowSec: 600, daily: int("CAFE_DAILY_CHAT", 400) }
    : { perIp: int("CAFE_RL_DISH", 10), windowSec: 600, daily: int("CAFE_DAILY_DISH", 80) };
}

// ── 存储 ─────────────────────────────────────────────────────

interface Store {
  /** 自增并返回新值；首次创建时设置过期 */
  incr(key: string, ttlSec: number): Promise<number>;
}

class MemoryStore implements Store {
  private m = new Map<string, { n: number; exp: number }>();
  async incr(key: string, ttlSec: number) {
    const now = Date.now();
    const cur = this.m.get(key);
    if (!cur || cur.exp <= now) {
      this.m.set(key, { n: 1, exp: now + ttlSec * 1000 });
      // 顺手清理，避免长期运行的实例无限增长
      if (this.m.size > 5000) for (const [k, v] of this.m) if (v.exp <= now) this.m.delete(k);
      return 1;
    }
    cur.n += 1;
    return cur.n;
  }
}

class UpstashStore implements Store {
  constructor(private url: string, private token: string) {}
  async incr(key: string, ttlSec: number) {
    // 一次 pipeline：INCR + EXPIRE NX（只在首次创建时设过期）
    const res = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, ttlSec, "NX"]]),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
    const json = (await res.json()) as { result: number }[];
    return Number(json[0]?.result ?? 0);
  }
}

let store: Store | null = null;
function getStore(): Store {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? new UpstashStore(url, token) : new MemoryStore();
  return store;
}

/** 仅供测试：换掉存储 */
export function _setStore(s: Store | null) {
  store = s;
}

// ── 判定 ─────────────────────────────────────────────────────

export type Verdict =
  | { ok: true }
  | { ok: false; reason: "ip" | "budget"; retryAfterSec: number };

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "anon";
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function checkLimit(scope: Scope, ip: string, now = new Date()): Promise<Verdict> {
  const r = rules(scope);
  const s = getStore();

  try {
    const window = Math.floor(now.getTime() / 1000 / r.windowSec);
    const n = await s.incr(`rl:${scope}:${ip}:${window}`, r.windowSec + 5);
    if (n > r.perIp) {
      const retryAfterSec = (window + 1) * r.windowSec - Math.floor(now.getTime() / 1000);
      return { ok: false, reason: "ip", retryAfterSec };
    }

    const d = await s.incr(`rl:${scope}:day:${dayKey(now)}`, 86400 + 60);
    if (d > r.daily) {
      const midnight = new Date(now);
      midnight.setUTCHours(24, 0, 0, 0);
      return {
        ok: false,
        reason: "budget",
        retryAfterSec: Math.ceil((midnight.getTime() - now.getTime()) / 1000),
      };
    }
    return { ok: true };
  } catch (err) {
    // 存储挂了不该把整个产品拖死；记一笔，放行。
    console.warn("[ratelimit] 存储不可用，本次放行：", (err as Error).message);
    return { ok: true };
  }
}

/** 429 的正文。用角色的语气，不用「rate limit exceeded」。 */
export function limitMessage(v: Exclude<Verdict, { ok: true }>): string {
  return v.reason === "budget"
    ? "今晚的桌子都坐满了。咖啡馆明天照常开门。"
    : "你刚才说得有点快。歇一会儿，过几分钟再坐下。";
}

export function limitResponse(v: Exclude<Verdict, { ok: true }>): Response {
  return Response.json(
    { error: limitMessage(v), reason: v.reason },
    { status: 429, headers: { "retry-after": String(v.retryAfterSec) } },
  );
}
