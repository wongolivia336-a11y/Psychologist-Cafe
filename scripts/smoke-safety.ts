/** 安全层冒烟测试：npx tsx scripts/smoke-safety.ts */
import { StreamingFilter, detectCrisis, findBanned } from "../src/lib/safety";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

console.log("── 流式禁语过滤 ──");
{
  const f = new StreamingFilter();
  const tokens = [
    "你面前", "这个东西", "。",
    "它大概有三百", "大卡", "。",
    "先别说它好不好", "。",
    "你尝到的第一个", "味道是什么", "？",
  ];
  let out = "";
  for (const t of tokens) out += f.push(t);
  out += f.flush();

  check("含「大卡」的整句被拦下", !out.includes("大卡"), JSON.stringify(out));
  check("其余句子正常放行", out.includes("先别说它好不好") && out.includes("味道是什么"));
  check("违规被记录", f.violations.length === 1, JSON.stringify(f.violations));
}

console.log("\n── 危机识别 ──");
check("口语夸张不误报：饿死了", detectCrisis("我今天饿死了").level === "none");
check("口语夸张不误报：累死了", detectCrisis("累死了，今天太忙").level === "none");
check("真危机：三天没吃", detectCrisis("我三天没吃了").level === "hard");
check("真危机：3 天没吃（数字）", detectCrisis("我 3 天没吃东西").level === "hard");
check("真危机：好几天没进食", detectCrisis("好几天没进食了").level === "hard");
check("真危机：不想活", detectCrisis("有时候真的不想活了").level === "hard");
check("真危机：催吐", detectCrisis("吃完就去催吐").level === "hard");
check("软信号：撑不住", detectCrisis("我有点撑不住了").level === "soft");
check("普通话不触发", detectCrisis("今天这个汤挺淡的").level === "none");

console.log("\n── 禁语词表 ──");
check("打气话术", findBanned("你要加油啊，坚持住").length > 0);
check("热量数字", findBanned("这份大概两百千卡").length > 0);
check("体型评价", findBanned("你看起来瘦了").length > 0);
check("食物道德化", findBanned("这是垃圾食品").length > 0);
check("进食指导", findBanned("你应该多吃点").length > 0);
check("正常句子不误伤", findBanned("这个汤的颜色很深，先尝一口。").length === 0);

console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
