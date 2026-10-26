import { NextRequest } from "next/server";
import { anthropic, MODEL } from "@/lib/claude";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 视觉识别一张菜品照片可能要十几秒，默认时限不够
export const maxDuration = 60;

/**
 * 照片 → 插画要素。
 *
 * 刻意不做的事：不识别菜名、不估份量、不判断种类。只提取「看起来是什么样子」——
 * 形状、颜色、质地。照片是证据，插画是景物；这个接口就是那次转换。
 */
const EXTRACT_PROMPT = `
你在看一张某人正要吃的食物照片。

请只描述它的外观，用于把它画成一幅静物插画。

严格禁止：
- 不要判断这是什么菜、什么菜系
- 不要估计份量、重量、热量、营养
- 不要评价健康与否、好吃与否、多与少
- 不要提到任何数字

只输出 JSON，不要任何其他文字：
{
  "items": ["盘子里可分辨的形状，用最朴素的词，如「一块褐色的方形」「几根细长的绿色」", "…"],
  "colors": ["主要颜色的中文描述，如「暗红」「奶白」", "…"],
  "palette": ["与 colors 一一对应的十六进制色值，如 \\"#7a3b2e\\"", "…"],
  "temperature": "热 或 温 或 凉 或 不确定",
  "vessel": "盛器的形状，如「浅口白瓷碗」",
  "note": "一句关于光线或摆放的中性观察"
}
`.trim();

const DishRequestSchema = z.object({
  imageBase64: z.string().min(1).max(12_000_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
});

const DishResponseSchema = z.object({
  items: z.array(z.string().max(120)).max(12).optional(),
  colors: z.array(z.string().max(40)).max(12).optional(),
  palette: z.array(z.string().regex(/^#[0-9a-f]{3,8}$/i)).max(12).optional(),
  temperature: z.string().max(20).optional(),
  vessel: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsedRequest = DishRequestSchema.safeParse(await req.json());
    if (!parsedRequest.success) {
      return Response.json({ error: "图片内容不符合这张桌子的格式" }, { status: 400 });
    }
    const { imageBase64, mediaType } = parsedRequest.data;

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({
        items: ["一组未命名的轮廓", "一处浅色反光"],
        colors: ["冷灰", "浅青"],
        palette: ["#87989c", "#d7dfdc"],
        temperature: "不确定",
        vessel: "浅口器皿",
        note: "预览模式暂未调用视觉模型，先留下一张中性的静物草图。",
      });
    }

    const res = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg",
                data: imageBase64,
              },
            },
            { type: "text", text: EXTRACT_PROMPT },
          ],
        },
      ],
    });

    const text = res.content
      .filter((b): b is { type: "text"; text: string; citations: null } => b.type === "text")
      .map((b) => b.text)
      .join("");

    // 模型可能包了 ```json 围栏，取第一个 {...} 块
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return Response.json(
        { error: "模型没有返回可解析的 JSON", raw: text },
        { status: 502 },
      );
    }

    const parsedResponse = DishResponseSchema.safeParse(JSON.parse(match[0]));
    if (!parsedResponse.success) {
      return Response.json({ error: "模型返回的静物描述格式不完整" }, { status: 502 });
    }

    return Response.json(parsedResponse.data);
  } catch (err) {
    console.error("[/api/dish]", err);
    return Response.json(
      { error: (err as Error).message ?? "识别失败" },
      { status: 500 },
    );
  }
}
