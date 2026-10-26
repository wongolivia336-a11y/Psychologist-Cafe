# Evaluation fixtures

这些文件是可重复的低成本护栏，不把它们冒充成模型质量评测：

- `personas/`：角色边界与桌边行为的人工审查提示。
- `grounding/`：查询至少能召回可解释语料的回归样例。
- `safety/`：危机识别与禁语过滤的确定性样例。
- `experience/`：真实浏览器截图回归的视口、状态和验收选择器。

运行确定性套件：

```bash
npm run eval:contract
```

真实浏览器截图回归需要先启动本地页面，再运行：

```bash
npm run dev -- --hostname 127.0.0.1 --port 3011
npm run test:visual
```

脚本使用环境已提供的 Playwright + Chromium，不把浏览器依赖加入产品包；截图和
`report.json` 写入 `.visual-regression`（可用 `VISUAL_OUTPUT_DIR` 覆盖）。如果
运行环境没有预置 Playwright，可用 `PLAYWRIGHT_MODULE` 和 `BROWSER_PATH` 指向
现有安装。错误状态由浏览器侧把 `/api/chat` 拦截为 503，因此不会修改应用生产路径。

模型输出仍需人工评审。尤其是 `personas/` 中的角色话术，在上线前必须由进食障碍方向的临床工作者逐条审阅并签字；当前不把这项审查标记为已完成。
