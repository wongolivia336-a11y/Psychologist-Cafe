# Philosopher's Café handoff

## 当前分支

`codex/still-life-rebuild`

## 2026-10-27 追加完成

- 外观从仅色调/暗度改为本地持久化的浅色、深色、系统跟随、色彩浓度、文字对比和动态偏好；不再使用全页 brightness 或 saturation filter。
- 修复了未保存暗度被错误压到最暗、浅色 WebGL 静物黑色矩形，以及外观设置在生产构建不可见的问题。
- 对话支持取消、受控跟随滚动和有上限的自适应输入框；服务端丢弃客户端伪造的 assistant 历史，并收敛内部错误回显。
- 真实 Chromium 生产构建回归现为 26 张截图：原 24 个场景状态，加外观深色桌面和浅色移动端；外观另覆盖 24 组主题/色彩/对比/动态组合、持久化、Escape 和外部点击。
- 增加 `npm run test:performance`：Chromium 本地基线为桌面 DCL 34ms / LCP 96ms、390 宽度 DCL 23ms / LCP 68ms；不是线上 RUM 或真机性能结论。
- 交付文档：`docs/DESIGN_AUDIT.md`、`docs/DESIGN_SYSTEM.md`、`docs/ARCHITECTURE.md`、`docs/VERIFICATION.md`、`docs/CONTINUATION_PROMPT.md`。

## 本轮真实完成

- 增加 `npm run test:visual`：使用环境已提供的真实 Chromium/Playwright，覆盖 `1440×900`、`1024×768`、`390×844`、`375×812`，每个视口检查并截图大厅、胡塞尔桌、记忆物件、来源抽屉、沉默和浏览器侧模拟 503 错误，共 24 张。
- 修复移动端离席链接换行、错误态在来源抽屉下不可见，以及三个方向下固定棕色文本的对比度问题。
- 已检查大厅、胡塞尔桌、记忆物件选择/落桌、来源抽屉、沉默状态和模拟错误状态。
- 修复中文「厌食 拒绝进食」对胡塞尔德文语料的零召回；映射只指向索引中实际存在的现象学词群，并加入 grounding eval。
- 加入成年确认与知情说明页；确认状态只保留在当前标签页会话。
- 将危机资源收敛到已核验的 `12356` 与当地紧急服务提示，删除未核验的旧号码。
- 建立 `eval/personas`、`eval/grounding`、`eval/safety`、`eval/experience`，并提供 `npm run eval`。
- `npm run eval` 运行胡塞尔黄金集检索评测；`npm run eval:contract` 运行上述四类确定性护栏。

## Mock / 未验证 / 阻塞

- 对话截图走的是无 `ANTHROPIC_API_KEY` 的本地 Mock；没有把 Mock 结果当成模型评测。
- 当前没有真实 Blender 资产、GLB/glTF 文件或 R3F 性能数据：Blender 不在 PATH，工作区也没有现成资产。当前 `ThreeStillLife` 只是原生 Three.js 程序化实验，不是 GLB/R3F 交付。详见 `docs/3D_PIPELINE.md`。
- `personas.ts` 的人工临床审查尚未完成；详见 `docs/SAFETY_REVIEW.md`。
- 截图输出保存在本次 Codex 可视化目录，不作为源码资产提交；开发模式截图会带 Next 的开发指示器，它不属于产品界面。

## 本地检查

```bash
npm run typecheck
npm run test
npm run test:turn
npm run test:retrieve
npm run eval
npm run eval:contract
```

G 盘执行 npm run build 会在 Next 读取 src/app/api/dish/route.ts 时复现 EISDIR readlink；相同源码在 D 盘隔离副本生成了 6 条路由。该卷兼容性限制已记录在 README，不应把 D 盘构建结果误写成 G 盘通过。

截图回归需要真实浏览器、运行中的 Next 开发服务器和 `data/index.json`；当前回归使用隔离的 `NEXT_DIST_DIR=.next-visual`，避免和其他本地 Next 进程抢占 `.next`。

回归脚本默认读取 Codex 环境预置的 Playwright；其他环境需要设置 `PLAYWRIGHT_MODULE` 和 `BROWSER_PATH`，不应把该测试运行时加入产品依赖。
