export type ChunkMeta = {
  /** 真实原著为 source_id；概念卡片为 card:<philosopher> */
  sourceId: string;
  title: string;
  author: string;
  translator?: string;
  year?: number;
  lang: string;
  /** public-domain | original-summary | licensed-private */
  license: string;
  url?: string;
  sourcePage?: string;
};

export type Chunk = {
  id: string;
  /** 归属哲学家 id。一个 persona 可以检索多个哲学家的语料（见 personas.ts 的 corpusOf）。 */
  philosopher: string;
  /** 章节标题或原著定位（如 "§12" / "S. 143"） */
  section: string;
  text: string;
  tags: string[];
  meta: ChunkMeta;
};

export type IndexedChunk = Chunk & {
  /** 词频表 */
  tf: Record<string, number>;
  /** 词元总数（BM25 的 |D|） */
  len: number;
  /** 可选：向量（设置 VOYAGE_API_KEY 后由 build-index 生成） */
  vec?: number[];
};

export type CorpusIndex = {
  version: number;
  builtAt: string;
  embedModel: string | null;
  chunks: IndexedChunk[];
  /** 文档频率：term -> 含该 term 的文档数 */
  df: Record<string, number>;
  /** 平均文档长度 */
  avgdl: number;
  /** 文档总数 */
  n: number;
};

export type Retrieved = Chunk & {
  score: number;
  /** 命中来源，便于调试与前端出处标注 */
  via: ("bm25" | "vector")[];
};
