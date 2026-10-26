/**
 * 安全层。三道：
 *   1. 危机识别（用户输入）—— 命中则角色出戏，转真人渠道
 *   2. 禁语过滤（模型输出）—— 逐句拦截，不让违规句子流到前端
 *   3. system prompt 里的行为约束（见 personas.ts SHARED_FRAME）
 *
 * ⚠️ 上线前必须做的人工审查：
 *   - 找一位真正的进食障碍方向临床工作者审一遍 personas.ts 的话术
 *   - 按部署地区再次确认危机渠道与服务时段
 */

// ── 1. 危机识别 ──────────────────────────────────────────────

/** 「几天」的各种写法。中文数字必须覆盖——用户不会写「3天没吃」。 */
const DAYS = "(?:好?几|[一二两三四五六七八九十百]+|\\d+)\\s*天";

/** 高置信度：直接出戏 */
const CRISIS_HARD: RegExp[] = [
  /自杀|想死|不想活|活不下去|结束(自己的)?生命|了结自己/,
  /自残|自伤|割腕|割自己|烫自己|伤害自己/,
  /(催吐|抠吐|抠喉|吐出来|吐掉)/,
  /(吃|用)(泻药|减肥药|利尿剂)/,
  // 天数要同时认中文数字和阿拉伯数字：「三天没吃」和「3 天没吃」都必须命中
  new RegExp(`(${DAYS})(没|不)(吃|进食|吃东西)`),
  new RegExp(`(绝食|断食|不吃(东西|饭))\\s*(${DAYS})`),
];

/** 低置信度：不出戏，但给模型加一条更小心的提示 */
const CRISIS_SOFT: RegExp[] = [
  /没有意义|撑不住|好累啊?[，,。]?$|崩溃|恨自己|恶心自己/,
  /(暴食|吃太多了|停不下来)/,
];

/** 明显是口语夸张，不应触发 */
const FALSE_POSITIVE = [/饿死了|累死了|困死了|笑死|吓死/];

export type CrisisLevel = "none" | "soft" | "hard";

export function detectCrisis(text: string): {
  level: CrisisLevel;
  matched: string[];
} {
  let scrubbed = text;
  for (const fp of FALSE_POSITIVE) scrubbed = scrubbed.replace(fp, "");

  const matched: string[] = [];
  for (const re of CRISIS_HARD) {
    const m = scrubbed.match(re);
    if (m) matched.push(m[0]);
  }
  if (matched.length) return { level: "hard", matched };

  for (const re of CRISIS_SOFT) {
    const m = scrubbed.match(re);
    if (m) matched.push(m[0]);
  }
  return { level: matched.length ? "soft" : "none", matched };
}

export const CRISIS_RESOURCES = [
  { name: "全国统一心理援助热线", phone: "12356", note: "各地接线时段以实际接通提示为准" },
  {
    name: "当地紧急服务",
    phone: "请使用所在地的紧急服务号码",
    note: "如果你正处于立即危险中",
  },
];

export function crisisMessage(): string {
  const lines = CRISIS_RESOURCES.map(
    (r) => `　　${r.name}　${r.phone}（${r.note}）`,
  ).join("\n");
  return [
    "（他放下了勺子。烛火晃了一下。）",
    "",
    "我得先停下来，不装了。",
    "",
    "我是一个程序，不是能在这种时候陪着你的人。你刚才说的那件事需要一个真的人，现在就需要。",
    "",
    lines,
    "",
    "如果你身边有任何一个人——不用是懂的人，只要是个人——现在给他发条消息也行。",
    "",
    "这张桌子会一直在。你先去找个人。",
  ].join("\n");
}

/** soft 级别时追加给模型的提示 */
export const SOFT_NOTE = `
[系统提示] 对方刚才的话里有情绪压力的信号。不要追问，不要安慰，不要给建议。
把节奏放得更慢，句子更短。可以只是承认这句话很重，然后停在那里。
不要提任何数字或食物评价。
`.trim();

// ── 2. 禁语过滤 ──────────────────────────────────────────────

/** 命中即整句丢弃。宁可少说一句，不可说错一句。 */
const BANNED: { re: RegExp; why: string }[] = [
  { re: /热量|卡路里|千卡|大卡|kcal/i, why: "数字化食物" },
  { re: /体重|公斤|kg\b|\d+\s*斤|BMI/i, why: "数字化身体" },
  { re: /减肥|瘦身|增重|塑形|身材/, why: "体型评价" },
  { re: /(很|太|好)?(瘦|胖)(了|吗|啊)?/, why: "体型评价" },
  { re: /健康(的)?食(物|品)|垃圾食品|(不)?健康饮食|营养均衡/, why: "食物道德化" },
  { re: /你(应该|得|需要|最好)(多|少)?吃/, why: "进食指导" },
  { re: /加油|坚持住|你可以的|你很棒|你做得很好|会好起来的/, why: "打气话术" },
  { re: /\d+\s*(克|g\b|毫升|ml\b)/i, why: "份量数字" },
];

export function findBanned(text: string): { term: string; why: string }[] {
  const hits: { term: string; why: string }[] = [];
  for (const b of BANNED) {
    const m = text.match(b.re);
    if (m) hits.push({ term: m[0], why: b.why });
  }
  return hits;
}

/**
 * 流式禁语过滤器。
 * 攒够一个完整句子才检查、才放行——这样既能真正拦下违规句，
 * 又不至于把整段回复憋到最后一次性吐出来。
 */
export class StreamingFilter {
  private buf = "";
  private blocked: { term: string; why: string }[] = [];

  /** 喂入一个 token，返回可以安全发给前端的文本（可能为空） */
  push(token: string): string {
    this.buf += token;
    let out = "";

    // 句末标点或换行处切句
    const re = /[^。！？\n…]*[。！？\n…]+/g;
    let m: RegExpExecArray | null;
    let consumed = 0;

    while ((m = re.exec(this.buf)) !== null) {
      const sentence = m[0];
      consumed = m.index + sentence.length;
      const hits = findBanned(sentence);
      if (hits.length) {
        this.blocked.push(...hits);
        console.warn("[safety] 拦截句子：", sentence.trim(), hits);
      } else {
        out += sentence;
      }
    }

    if (consumed > 0) this.buf = this.buf.slice(consumed);
    return out;
  }

  /** 流结束，冲掉残留（最后一句可能没有标点） */
  flush(): string {
    const tail = this.buf;
    this.buf = "";
    if (!tail.trim()) return "";
    const hits = findBanned(tail);
    if (hits.length) {
      this.blocked.push(...hits);
      console.warn("[safety] 拦截尾句：", tail.trim(), hits);
      return "";
    }
    return tail;
  }

  get violations() {
    return this.blocked;
  }
}
