# Philosopher's Café handoff

## 当前分支

`codex/still-life-rebuild`

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

截图回归需要真实浏览器、运行中的 Next 开发服务器和 `data/index.json`；当前回归使用隔离的 `NEXT_DIST_DIR=.next-visual`，避免和其他本地 Next 进程抢占 `.next`。

回归脚本默认读取 Codex 环境预置的 Playwright；其他环境需要设置 `PLAYWRIGHT_MODULE` 和 `BROWSER_PATH`，不应把该测试运行时加入产品依赖。
