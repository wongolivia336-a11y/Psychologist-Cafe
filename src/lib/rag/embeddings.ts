/**
 * 可选的向量层。Anthropic 不提供 embedding 接口，官方推荐的第三方是 Voyage AI。
 * 没有 VOYAGE_API_KEY 时整个模块自动禁用，检索退回纯 BM25——功能完整，只是长句语义弱一些。
 */

const ENDPOINT = "https://api.voyageai.com/v1/embeddings";
export const EMBED_MODEL = process.env.VOYAGE_MODEL ?? "voyage-3.5";

export function embeddingsEnabled(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

async function callVoyage(
  texts: string[],
  inputType: "document" | "query",
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY 未设置");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
      input_type: inputType,
      truncation: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Voyage HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    data: { index: number; embedding: number[] }[];
  };
  // 按 index 还原顺序，不依赖返回顺序
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** 批量嵌入文档（建索引时用）。自动分批 + 失败重试。 */
export async function embedDocuments(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const BATCH = 96;
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    let vecs: number[][] | null = null;

    for (let attempt = 1; attempt <= 3 && !vecs; attempt++) {
      try {
        vecs = await callVoyage(batch, "document");
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }

    out.push(...vecs!);
    onProgress?.(Math.min(i + BATCH, texts.length), texts.length);
  }
  return out;
}

/** 嵌入单条查询（检索时用）。失败返回 null，让调用方安静地退回 BM25。 */
export async function embedQuery(text: string): Promise<number[] | null> {
  if (!embeddingsEnabled()) return null;
  try {
    const [vec] = await callVoyage([text], "query");
    return vec ?? null;
  } catch (err) {
    console.warn("[rag] 查询向量化失败，退回 BM25：", (err as Error).message);
    return null;
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}
