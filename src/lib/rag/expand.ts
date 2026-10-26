/**
 * 跨语言查询扩展。
 *
 * 为什么需要：BM25 是词面匹配。用户用中文提问，胡塞尔原著是德文，
 * 两边一个词都对不上——不扩展的话对德文语料是零召回。
 *
 * 正解是多语言向量（设置 VOYAGE_API_KEY 后自动启用，见 embeddings.ts）。
 * 这里是零依赖的保底方案：把中文概念映射到原著里真实出现的德文术语。
 *
 * 映射表只收「原著中确实高频出现的词」。不要凭空加词——加了检索不到的词
 * 只会稀释查询。新增术语前先用 scripts/smoke-retrieve.ts 验证有召回。
 */

type LangMap = Record<string, string[]>;

/** 中文概念 -> 胡塞尔德文术语（1900–01 年正字法，注意 ß 与 -iren 拼法） */
const ZH_TO_DE: LangMap = {
  // 感知与显现
  看见: ["Anschauung", "anschaulich", "Erscheinung", "sehen"],
  看到: ["Anschauung", "Erscheinung", "Wahrnehmung"],
  呈现: ["Erscheinung", "erscheint", "gegeben", "Gegebenheit"],
  显现: ["Erscheinung", "erscheinen", "Phänomen"],
  知觉: ["Wahrnehmung", "wahrnehmen", "Perception"],
  感觉: ["Empfindung", "Empfindungen", "Gefühl"],
  尝: ["Empfindung", "sinnlich", "Qualität"],
  味道: ["Empfindung", "sinnlich", "Qualität"],
  颜色: ["Farbe", "Qualität", "sinnlich"],

  // 意识与体验
  意识: ["Bewußtsein", "Bewusstsein", "bewußt"],
  体验: ["Erlebnis", "Erlebnisse", "erleben"],
  经验: ["Erfahrung", "Erlebnis", "empirisch"],
  意向: ["Intention", "intentional", "Intentionalität"],
  关于: ["Intention", "gerichtet", "Gegenstand"],
  注意: ["Aufmerksamkeit", "Interesse"],

  // 对象
  对象: ["Gegenstand", "Gegenstände", "Object", "Objekt"],
  东西: ["Gegenstand", "Sache", "Ding"],
  事情: ["Sache", "Sachen", "Sachverhalt"],
  本身: ["selbst", "an sich", "Sache selbst"],

  // 判断与悬置
  判断: ["Urteil", "Urtheil", "urtheilen", "Beurtheilung"],
  应该: ["Urteil", "Urtheil", "Norm", "normativ"],
  不该: ["Urteil", "Urtheil", "Norm", "normativ"],
  对错: ["Wahrheit", "Richtigkeit", "falsch"],
  真: ["Wahrheit", "wahr", "Evidenz"],
  确定: ["Evidenz", "evident", "Gewißheit", "apodictisch"],
  明见: ["Evidenz", "evident", "Einsicht"],
  直观: ["Anschauung", "anschaulich", "Intuition"],

  // 时间
  时间: ["Zeit", "zeitlich", "Dauer"],
  慢: ["Dauer", "allmählich", "zeitlich"],
  持续: ["Dauer", "dauern", "beharrlich"],
  变化: ["Veränderung", "Wechsel", "verändern"],
  过程: ["Vorgang", "Verlauf", "Process"],

  // 本质与含义
  意义: ["Bedeutung", "Sinn", "bedeuten"],
  本质: ["Wesen", "wesentlich", "Idealität"],
  一般: ["Allgemeine", "allgemein", "Species"],
  抽象: ["Abstraction", "abstract", "Abstraction"],

  // 心理主义（卷一主题，用户问「为什么我脑子这样想」时能对上）
  心理: ["psychologisch", "Psychologie", "psychisch"],
  思维: ["Denken", "Denkgesetze", "Gedanke"],
  规律: ["Gesetz", "Gesetze", "Naturgesetz"],

  // 进食相关表达：不把临床标签当成胡塞尔的理论术语，
  // 只把它们引向语料里确实出现的「欲望、意志、身体与受阻」词群。
  厌食: ["Essen", "Unlust", "Abneigung", "Lust"],
  拒绝进食: ["Essen", "Widerstand", "gehemmt", "vermeiden", "Wille"],
  不想吃: ["Essen", "Unlust", "Abneigung", "Widerstand"],
  食欲: ["Lust", "Unlust", "Begehren", "Wille"],
  进食: ["Essen", "Lust", "Begehren"],

  // ── 以下为 v2 扩充：《逻辑研究》各研究的核心术语 ──
  // 上面的表是为餐桌场景写的（感知、时间、判断），对原著的主干概念几乎没有覆盖。
  // eval/husserl-gold.json 的评测把这点量化出来了：32 条概念提问 hit@5 只有 25%。
  // 下面每个德文词都核对过在索引里的文档频率（df ≥ 2），没有一个是凭空加的。

  // I. 表达与含义
  记号: ["Zeichen", "Anzeige", "Anzeichen"],
  符号: ["Zeichen", "Anzeige"],
  表达: ["Ausdruck", "Ausdrücke", "ausdrücken", "Bedeutung"],
  所指: ["Gegenstand", "Gegenständlichkeit", "Bedeutung"],
  独自: ["einsamen", "Seelenleben", "Mittheilung"],
  自言自语: ["einsamen", "Seelenleben"],
  说话的人: ["occasionellen", "schwankend", "Mittheilung"],
  观念: ["ideal", "ideale", "Idealität", "Idee"],
  心理活动: ["psychische", "Act", "Acte", "Erlebnis"],

  // II. 种与一般对象
  普遍: ["Allgemeine", "allgemein", "Allgemeinheit", "Species"],
  红: ["roth", "Röthe", "Farbe"],
  休谟: ["Hume"],
  洛克: ["Locke"],
  贝克莱: ["Berkeley"],
  密尔: ["Mill"],
  布伦塔诺: ["Brentano"],
  康德: ["Kant"],
  抽象观念: ["abstracte", "Ideen", "Abstraction"],

  // III. 整体与部分
  部分: ["Theil", "Theile", "Theilen", "Stück", "Moment"],
  整体: ["Ganze", "Ganzen", "Ganzes"],
  独立: ["selbständig", "selbständige", "Selbständigkeit"],
  单独: ["selbständig", "abtrennbar", "Selbständigkeit"],
  依赖: ["unselbständig", "unselbständige", "abhängig", "Fundirung"],
  奠基: ["Fundirung", "fundirt", "fundiren"],

  // IV. 含义的复合
  自己有意义: ["synkategorematische", "Synkategorematica", "kategorematisch"],
  助范畴: ["synkategorematische", "Synkategorematica"],
  无意义: ["Unsinn", "sinnlos", "Widersinn"],
  悖谬: ["Widersinn", "widersinnig"],
  荒谬: ["Widersinn", "widersinnig"],

  // V. 意向体验
  心理现象: ["psychische", "Phänomene", "Brentano", "intentionale"],
  行为: ["Act", "Acte", "Actcharakter"],
  质性: ["Qualität"],
  质料: ["Materie"],
  想象: ["Phantasie", "Einbildung", "Vorstellung"],
  表象: ["Vorstellung", "Vorstellungen", "Vorstellungsinhalt"],

  // VI. 充实与直观
  充实: ["Erfüllung", "erfüllt", "erfüllen", "Bedeutungsintention"],
  失望: ["Enttäuschung", "enttäuscht", "Widerstreit"],
  落空: ["Enttäuschung", "Widerstreit"],
  冲突: ["Widerstreit", "Streit"],
  期待: ["Erwartung", "erwarten", "Intention"],
  感性: ["sinnlich", "Sinnlichkeit"],
  范畴: ["kategorial", "kategoriale", "kategorialen", "Kategorien"],
  代现: ["Repräsentation", "Repräsentant", "Repräsentanten"],
  愿望: ["Wunsch", "Wünsche", "wünschen"],
  疑问: ["Frage", "Fragen"],
  客体化: ["objectivirende", "nichtobjectivirende"],

  // 卷一：纯粹逻辑学导引
  规范: ["normativ", "normative", "Norm", "Normen"],
  理论科学: ["theoretische", "Disciplin", "Wissenschaft"],
  技艺: ["Kunstlehre", "practische"],
  心理主义: ["Psychologismus", "psychologistische", "Psychologisten"],
  逻辑: ["Logik", "logischen", "logische"],
  论证: ["Beweis", "Beweisführung", "Argumente"],
  自然规律: ["Naturgesetze", "Naturgesetzen", "Naturgesetz"],
  矛盾律: ["Widerspruch", "Widerspruchs", "Satz", "Princip"],
  矛盾: ["Widerspruch", "Widerstreit"],
  相对主义: ["Relativismus", "relativistisch", "Skepticismus", "Anthropologismus"],
  怀疑: ["Skepticismus", "Skepsis"],
  思维经济: ["Denkökonomie", "denkökonomisch", "Mach", "Avenarius"],
  统一: ["Einheit", "einheitlich"],
  科学: ["Wissenschaft", "Wissenschaften", "Wissenschaftslehre"],
  纯粹逻辑: ["reine", "reinen", "Logik"],
};

/** 概念卡片是中文的，德文提问时也扩一下，保证双向都能召回 */
const DE_TO_ZH: LangMap = {
  Wahrnehmung: ["知觉", "感知"],
  Empfindung: ["感觉", "味道"],
  Bewußtsein: ["意识"],
  Erlebnis: ["体验"],
  Gegenstand: ["对象"],
  Evidenz: ["明见", "确定"],
  Anschauung: ["直观"],
  Urteil: ["判断"],
  Zeit: ["时间"],
};

/**
 * 把查询扩展成「原查询 + 目标语言的等价术语」。
 * 只追加，不替换——原查询的词面命中依然有效。
 */
export function expandQuery(query: string, targetLangs: string[]): string {
  const extra = new Set<string>();

  if (targetLangs.includes("de")) {
    for (const [zh, de] of Object.entries(ZH_TO_DE)) {
      if (query.includes(zh)) for (const t of de) extra.add(t);
    }
  }
  if (targetLangs.includes("zh")) {
    const lower = query.toLowerCase();
    for (const [de, zh] of Object.entries(DE_TO_ZH)) {
      if (lower.includes(de.toLowerCase())) for (const t of zh) extra.add(t);
    }
  }

  return extra.size ? `${query} ${[...extra].join(" ")}` : query;
}
