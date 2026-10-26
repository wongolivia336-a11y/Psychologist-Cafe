import { describe, expect, it } from "vitest";
import { StreamingFilter, detectCrisis, findBanned } from "./safety";

/**
 * 安全层是这个产品的底线，不是功能。这里的用例分三组：
 *   1. 原 scripts/smoke-safety.ts 的 18 条（迁入后由 CI 强制执行）
 *   2. 对抗样本：模型换个说法能不能绕过去
 *   3. 已知的误报 / 漏报边界，写明现状，改了会被看见
 */

describe("危机识别 detectCrisis", () => {
  it.each([
    ["我今天饿死了", "none"],
    ["累死了，今天太忙", "none"],
    ["笑死我了", "none"],
    ["今天这个汤挺淡的", "none"],
  ])("口语夸张不误报：%s", (text, level) => {
    expect(detectCrisis(text).level).toBe(level);
  });

  it.each([
    "我三天没吃了",
    "我 3 天没吃东西",
    "好几天没进食了",
    "两天不吃饭了",
    "有时候真的不想活了",
    "吃完就去催吐",
    "我在吃泻药",
    "想割腕",
  ])("真危机直接出戏：%s", (text) => {
    expect(detectCrisis(text).level).toBe("hard");
  });

  it.each(["我有点撑不住了", "又暴食了，停不下来", "我恨自己"])(
    "软信号只加提示，不出戏：%s",
    (text) => {
      expect(detectCrisis(text).level).toBe("soft");
    },
  );

  it("硬信号优先于软信号", () => {
    const r = detectCrisis("撑不住了，三天没吃");
    expect(r.level).toBe("hard");
    expect(r.matched.length).toBeGreaterThan(0);
  });

  it("已知边界：「不想活得太累」会被当成硬危机（宁可误报）", () => {
    // 这是有意的取舍：漏掉一个真危机的代价远高于多出一次戏。
    // 如果将来要收窄，这条测试提醒你先想清楚。
    expect(detectCrisis("我不想活得太累").level).toBe("hard");
  });
});

describe("禁语词表 findBanned", () => {
  it.each([
    ["你要加油啊，坚持住", "打气话术"],
    ["你真棒", "打气话术"],
    ["别放弃", "打气话术"],
    ["这份大概两百千卡", "数字化食物"],
    ["大概 300 kcal", "数字化食物"],
    ["差不多一千焦", "数字化食物"],
    ["你看起来瘦了", "体型评价"],
    ["这是垃圾食品", "食物道德化"],
    ["你应该多吃点", "进食指导"],
    ["也就五十克吧", "份量数字"],
    ["大概 50g", "份量数字"],
    ["半斤左右", "数字化身体"],
    ["你的 BMI", "数字化身体"],
  ])("拦下：%s → %s", (text, why) => {
    const hits = findBanned(text);
    expect(hits.map((h) => h.why)).toContain(why);
  });

  it.each([
    "你尝到的第一个味道是什么？",
    "先别说它好不好。",
    "这盘菜的颜色很深。",
    "他放下了勺子。",
  ])("正常句子放行：%s", (text) => {
    expect(findBanned(text)).toEqual([]);
  });

  it("已知边界：「消瘦」「胖大海」这类词也会被拦（宁可少说）", () => {
    expect(findBanned("他脸色消瘦").length).toBeGreaterThan(0);
  });
});

describe("流式禁语过滤 StreamingFilter", () => {
  function run(tokens: string[]) {
    const f = new StreamingFilter();
    let out = "";
    for (const t of tokens) out += f.push(t);
    out += f.flush();
    return { out, f };
  }

  it("含禁语的整句被丢弃，其余句子正常放行", () => {
    const { out, f } = run([
      "你面前", "这个东西", "。",
      "它大概有三百", "大卡", "。",
      "先别说它好不好", "。",
      "你尝到的第一个", "味道是什么", "？",
    ]);
    expect(out).not.toContain("大卡");
    expect(out).toContain("先别说它好不好");
    expect(out).toContain("味道是什么");
    expect(f.violations).toHaveLength(1);
  });

  it("禁语被 token 边界切开也拦得住", () => {
    // 模型的 token 不按词切，「卡路里」可能是「卡」「路里」两段到达
    const { out } = run(["这大概有两百", "卡", "路里", "。", "别在意", "。"]);
    expect(out).not.toContain("卡路里");
    expect(out).toContain("别在意");
  });

  it("句子跨多次 push 才完整时，不会提前放行半句", () => {
    const f = new StreamingFilter();
    expect(f.push("这份有五十")).toBe("");
    expect(f.push("克")).toBe("");
    expect(f.push("。")).toBe("");
    expect(f.violations).toHaveLength(1);
  });

  it("末尾没有标点的残句在 flush 时检查", () => {
    const { out, f } = run(["你可以的"]);
    expect(out).toBe("");
    expect(f.violations).toHaveLength(1);
  });

  it("末尾残句干净则原样放出", () => {
    const { out } = run(["慢慢来", "，先看它一眼"]);
    expect(out).toBe("慢慢来，先看它一眼");
  });

  it("换行和省略号也算句末", () => {
    const { out } = run(["你真棒\n", "这盘菜的颜色很深…", "看它一会儿。"]);
    expect(out).not.toContain("你真棒");
    expect(out).toContain("颜色很深");
    expect(out).toContain("看它一会儿");
  });

  it("空 token 与纯空白不产生输出、不报违规", () => {
    const { out, f } = run(["", "  ", "\n"]);
    expect(out.trim()).toBe("");
    expect(f.violations).toHaveLength(0);
  });
});
