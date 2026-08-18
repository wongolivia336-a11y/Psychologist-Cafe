/**
 * 检索冒烟测试：npx tsx scripts/smoke-retrieve.ts "你的问题"
 * 不传参数则跑一组预设查询，用来检查跨语言召回是否正常。
 */
import { retrieve } from "../src/lib/rag/retrieve";

const DEFAULTS = [
  "我尝到了什么",
  "这个味道在嘴里慢慢变了",
  "我不该吃这个",
  "明见性和直观",
  "Evidenz Anschauung",
  "厌食 拒绝进食",
];

async function main() {
  const queries = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS;

  for (const q of queries) {
    // 与线上一致：胡塞尔这张桌子只检索 husserl 语料（全德文）
    const hits = await retrieve(q, { philosophers: ["husserl"], topK: 3 });
    console.log(`\n【${q}】 -> ${hits.length} 条`);
    for (const h of hits) {
      const lic = h.meta.license === "public-domain" ? "原著" : "卡片";
      console.log(
        `  ${h.score.toFixed(4)} [${lic}/${h.philosopher}/${h.via.join("+")}] ${h.section.slice(0, 60)}`,
      );
    }
    if (!hits.length) console.log("  ⚠ 零召回");
  }
}

main();
