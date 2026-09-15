# 在场 · Philosopher's Café

> 给独自吃饭的人，一顿有人在场的饭。

**[▸ 在线预览](https://psychologist-caf.vercel.app)** ｜ [一键部署](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwongolivia336-a11y%2FPsychologist-Cafe&env=ANTHROPIC_API_KEY&envDescription=Claude%20API%20key%EF%BC%8C%E7%94%A8%E4%BA%8E%E5%AF%B9%E8%AF%9D%E4%B8%8E%E8%8F%9C%E5%93%81%E8%AF%86%E5%88%AB&envLink=https%3A%2F%2Fconsole.anthropic.com%2Fsettings%2Fkeys&project-name=philosopher-cafe&repository-name=philosopher-cafe)

> 预览里点亮的是胡塞尔那一桌。没有 `ANTHROPIC_API_KEY` 时页面照常渲染，
> 但一开口对话会报错——这是预期行为，不是坏了。

一个陪餐产品的原型。你拍下面前这顿饭，它变成一幅插画落在桌上；对面坐着一位哲学家，
你们一起把这顿饭吃完。插画在这段时间里慢慢上色——画完了，饭就吃完了。

不是心理咨询，不是饮食记录，不是冥想 app。

---

## 跑起来

```bash
npm install
cp .env.example .env.local   # 填入 ANTHROPIC_API_KEY
npm run fetch                # 下载公有领域原著（约 2MB）
npm run index                # 构建检索索引
npm run dev
```

打开 http://localhost:3000 ，点亮着灯的那张桌子。

> **代理**：所有 npm 脚本已带 `NODE_USE_ENV_PROXY=1`。Node 的 fetch 默认不读
> `HTTPS_PROXY` 环境变量，没有这个开关的话下载语料和调用 API 都会超时。

自检：

```bash
npm test                # vitest：安全层 42 项、限流、检索组件、§ 定位、检索质量回归线
npm run eval            # 检索质量评测（下面「检索质量」那张表就是它打出来的）
npm run test:retrieve   # 手动看几条检索结果
```

CI（`.github/workflows/ci.yml`）在每次 push 上跑 typecheck → 建索引 → 全部测试 → 评测表贴进 job summary。

### ⚠️ 已知问题：不能在 G: 盘跑生产构建

`npm run dev` 在 G: 上正常。但 `npm run build` 会报：

```
Error: EISDIR: illegal operation on a directory, readlink '...'
```

原因是 G: 不是标准本地卷，对**普通文件**调 `fs.readlinkSync` 返回 `EISDIR`
（POSIX 语义应为 `EINVAL`），而 Next 的模块解析依赖这个语义。换 Turbopack 也一样，
因为它挂在 "Collecting page data" 阶段。

- 本地要出生产包：把项目复制到 C: 盘再 `npm run build`（已实测通过，5 条路由全部产出）
- 部署到 Vercel / Linux CI：不受影响

---

## 部署到 Vercel

导入仓库后 **只需要做一件事**：在 Settings → Environment Variables 加

| Key | Value | 环境 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 你的 Claude API key | Production / Preview / Development 全勾 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | **强烈建议**。限流计数的共享存储，免费档够用 | 同上 |
| `VOYAGE_API_KEY` | 可选。加了检索升级为 BM25 + 多语言向量 | 同上 |

其余全部用默认值（Framework 自动识别 Next.js，Build Command 用 `package.json` 里的 `build`）。

### 限流：这是公开的付费接口

两个 API 路由没有登录，每一次调用都花钱。`src/lib/ratelimit.ts` 做两层：

| 层 | 默认 | 挡的是什么 |
|---|---|---|
| 每 IP 固定窗口 | 对话 30 次 / 10 分钟；识图 10 次 / 10 分钟 | 单人刷 |
| 全站日预算 | 对话 400 次 / 天；识图 80 次 / 天 | 换 IP 的脚本——换得掉 IP，换不掉总量 |

超限返回 429，正文是角色语气的一句话（「今晚的桌子都坐满了」），前端照常显示。

**没设 Upstash 时计数在进程内存里**：Vercel 每个函数实例各算各的，冷启动清零。
这只挡得住突发，不要把它当成已经限住了。额度可用 `CAFE_RL_*` / `CAFE_DAILY_*` 覆盖，见 `.env.example`。

### 为什么语料要提交进仓库

`npm run build` 会先跑 `npm run index` 建检索索引。如果公有领域原著靠
`npm run fetch` 在构建时现下，**部署就绑定在 archive.org 的可用性上**——
实测撞到过它返回 503，那样一次抖动就是一次部署失败。

所以 `data/corpus/sources/` 刻意不 gitignore（2MB，公有领域，合法可分发），
构建是确定性的。`npm run fetch` 保留给「新增语料源」用，不在部署链路上。

### 索引怎么进的函数包

`data/index.json`（约 6.6MB）是构建产物，运行时由 `/api/chat` 用 `fs` 读。
serverless 打包默认不带它，必须在 `next.config.ts` 里声明
`outputFileTracingIncludes`，否则线上检索会静默零召回——页面不报错，
但哲学家再也引用不到任何原文。这是这个项目部署时最容易踩空的一处。

两个 API 路由都设了 `maxDuration = 60`：SSE 流式对话和菜品视觉识别都会超过默认时限。

---

## 设计约束（改代码前先读这一节）

这个产品面向的是进食障碍人群。这类产品设计不当，会变成一个更好看的强迫工具。
以下不是功能取舍，是底线：

| 约束 | 为什么 |
|---|---|
| **永不出现任何数字** | 热量、克数、体重、频次、天数。一个都不能有。数字是进食障碍大脑最好的武器。 |
| **永不做连续打卡（streak）** | 断签在这个语境里等于羞耻螺旋。所有游戏化在这个人群里是**有害**，不是无效。 |
| **解锁只累加、永不衰减** | 打卡惩罚缺席，解锁只奖励在场。消失三个月回来，咖啡馆和你走时一模一样。 |
| **插画默认不存档** | 一旦能横向对比，它就变成自我审判的素材。不做时间轴、不做"回顾你的 30 顿饭"。 |
| **角色不给饮食建议、不诊断、不打气** | 见 `src/lib/personas.ts` 的 `SHARED_FRAME`。 |
| **对话不跨场留存** | 容器必须有边界，创伤才敢进来。 |

安全实现在 `src/lib/safety.ts`：危机识别（用户输入）+ 禁语流式过滤（模型输出）。

### ⚠️ 上线前必须做

- [ ] 核实 `CRISIS_RESOURCES` 里的热线号码当前有效（号码会变更，不要照抄）
- [ ] 找一位真正的进食障碍方向临床工作者，审一遍 `personas.ts` 全部话术
- [ ] 补一个成年确认与知情说明页

---

## 语料与版权

**这是这个项目最需要如实交代的部分。** 语料分三类，`meta.license` 区分，前端如实展示：

| 类型 | 目录 | 说明 |
|---|---|---|
| `public-domain` | `data/corpus/sources/` | 真实原著全文，`npm run fetch` 从公开源下载。已 gitignore。 |
| `original-summary` | `data/corpus/cards/` | 人工撰写的概念卡片。**不是原著节录**，不可作为引文出处。 |
| `licensed-private` | `data/corpus/licensed/` | 你自行合法取得的文本。已 gitignore，不随仓库分发。 |

### 各角色的语料真实性

| 角色 | 语料 | 状态 |
|---|---|---|
| **胡塞尔** | 《逻辑研究》卷一、卷二（1900–01）德文原版全文，archive.org 扫描本 | ✅ 真实原著 |
| 拉康 | 概念卡片 + 弗洛伊德公有领域原著 | ⚠️ 混合（v1 未启用） |
| 梅洛-庞蒂 | 概念卡片 + 其师胡塞尔原著 | ⚠️ 混合（v1 未启用） |
| 齐泽克 | 仅概念卡片 | ⚠️ 无原文（v1 未启用） |

拉康（卒于 1981）、梅洛-庞蒂（卒于 1961）、齐泽克（在世）的著作全部在版权期内，
**不存在合法的开源全文**。想给这些角色接入真实文本，只能自行取得授权后放进
`data/corpus/licensed/`。

新增语料源：编辑 `data/sources.json` 加一条，把 `active` 设成 `true`，重跑
`npm run fetch && npm run index`。不需要改脚本。

---

## RAG 是怎么做的

```
用户提问
  ↓
跨语言查询扩展 (expand.ts)   中文提问 → 补上原著里真实出现的德文术语
  ↓
┌─────────────┬──────────────────┐
│ BM25         │ 向量（可选）      │   两路独立召回
│ (bm25.ts)    │ (embeddings.ts)  │
└─────────────┴──────────────────┘
  ↓
RRF 融合 (retrieve.ts)        只看排名，换语料/换模型都不用重调权重
  ↓
注入 system prompt (prompt.ts)  带出处，前端可展开核对
```

**为什么需要查询扩展**：BM25 是词面匹配。用户用中文问，胡塞尔原著是德文，
一个词都对不上——不扩展就是零召回。正解是多语言向量：

```bash
# .env.local 里加上，重跑 npm run index，检索自动升级为 BM25 + 向量混合
VOYAGE_API_KEY=pa-...
```

不设也能完整跑通，只是长句语义检索弱一些。

### 出处能核对到 §

原著 OCR 文本没有可靠的标题行，之前每块只能拿首句快照当定位。现在 `build-index`
沿着正文里连续的「§ N.」编号追踪（`src/lib/rag/sections.ts`），每块都归到
「VI. Untersuchung §39」这样的位置——2663 块里 98% 有定位。前端出处可以真的翻书核对，
评测也才有了可判定的黄金集。每卷的单元结构写在 `data/sources.json` 的 `structure` 里。

### 检索质量

`eval/husserl-gold.json`：32 条中文概念提问，每条对应《逻辑研究》里的一个 § 区间
（按 1900–01 年初版目录定，粒度是「落在正确的那几节里」，不是逐段人工标注）。
`npm run eval` 对三种配置各跑一遍：

| 配置 | hit@1 | hit@3 | hit@5 | MRR@5 | 随机基线 hit@5 |
| :-- | --: | --: | --: | --: | --: |
| bm25（关掉扩展） | 0% | 0% | 0% | 0.00 | 7% |
| bm25+expand（线上） | 31% | 59% | 75% | 0.47 | 7% |
| hybrid（+Voyage 向量） | — | — | — | — | 未跑 |

*2026-09-15，2663 块，topK=5。*

三件事从这张表里读出来：

1. **不扩展就是零**。中文提问对德文原著没有一个词面能对上，BM25 完全失效——这不是猜的。
2. **扩展表 v1 只有 25%**。它是为餐桌场景写的（感知、时间、判断），对原著主干概念几乎没覆盖。
   v2 把六个研究的核心术语补上（每个德文词都核对过在索引里的文档频率），到 75%。
3. **剩下 8 条是语义题**（「是」从哪来、「意识」的几种意思、感性直观 vs 范畴直观），
   词面扩展到头了，这是上向量的理由——`VOYAGE_API_KEY` 一设，评测会自动多跑一行。

`src/lib/rag/retrieve.eval.test.ts` 把 hit@5 ≥ 65%、MRR ≥ 0.40 设成回归线，
改分词或扩展表让检索变差会在 CI 里直接红。

一个诚实的注脚：v2 术语表是看着这份评测的失败项补的。词都是标准译法、概念级而非提问级，
但黄金集和术语表出自同一个人，overfit 的风险存在。下一步应该让别人出题。

手动看几条：

```bash
npx tsx scripts/smoke-retrieve.ts "我尝到了什么"
```

---

## 目录

```
data/
  sources.json           语料源清单 + 每卷的 § 结构（改这里加语料）
  corpus/{sources,cards,licensed}/
  index.json             构建产物
eval/
  husserl-gold.json      检索评测黄金集
scripts/
  fetch-corpus.ts        下载公有领域原著
  build-index.ts         分块 + § 定位 + BM25 统计 + 可选向量
  eval-retrieve.ts       检索质量评测
  smoke-retrieve.ts      手动看检索结果
src/
  lib/
    personas.ts          人格库 / 禁语框架 / 桌位与解锁
    safety.ts            危机识别 + 禁语流式过滤
    ratelimit.ts         每 IP 窗口 + 全站日预算
    prompt.ts            system prompt 组装 + 缓存分块
    rag/                 tokenize / chunk / sections / bm25 / embeddings / expand / retrieve
    **/*.test.ts         vitest；retrieve.eval.test.ts 是检索质量回归线
  app/
    page.tsx             大堂（固定机位，绣湖语法）
    table/[id]/          拼桌
    api/chat/            SSE 流式对话
    api/dish/            照片 → 插画要素（不识别菜名、不估份量）
  components/
    MealScene.tsx        拼桌场景
    Dish.tsx             盘子插画（同时是这顿饭的计时器）
```

---

## v1 的范围

只点亮胡塞尔一张桌子。其余桌子有人坐，但"还不到时候"——绣湖式的锁住的门，
是原生表达，不是缩水。

要验证的是一件事：**放下一个物件、听一个怪人对着它说了十二分钟话之后，人是什么感觉。**

### 还没做

- 3D 建模场景（当前是 CSS/SVG 占位。方案：Blender 固定机位预渲染成分层 PNG，
  只有盘子是唯一的 3D hero object）
- 语音（当前是文字。声音的可视化应该是烛火呼吸，不做抽象光球）
- 其余三位角色的 system prompt（`personas.ts` 里已留位，`system` 字段为空）
- 胡塞尔之外的语料接入（`data/sources.json` 里已备好条目，改 `active` 即可）
