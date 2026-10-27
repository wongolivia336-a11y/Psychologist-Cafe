import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const BASE_URL = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:3011";
const OUTPUT_DIR = process.env.VISUAL_OUTPUT_DIR ?? path.join(process.cwd(), ".visual-regression");
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE;
const VIEWPORTS = [
  { name: "desktop-wide", width: 1440, height: 900 },
  { name: "desktop-compact", width: 1024, height: 768 },
  { name: "mobile-wide", width: 390, height: 844 },
  { name: "mobile-compact", width: 375, height: 812 },
];

// ponytail: use the already provisioned browser runtime; do not add Playwright to the product dependency graph.
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [PLAYWRIGHT_MODULE, "playwright"].filter(Boolean);
  let lastError;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `找不到 Playwright 运行时。请设置 PLAYWRIGHT_MODULE 指向已安装的 Playwright；未执行截图回归。\n${lastError}`,
  );
}

const { chromium } = loadPlaywright();

async function waitForConversationIdle(page) {
  await page.waitForFunction(() => document.querySelector(".conversation-scroll")?.getAttribute("aria-busy") === "false");
}

async function confirmAdult(page) {
  const gate = page.locator(".adult-gate__confirm");
  await page.locator(".adult-gate__confirm, .lobby-shell, .meal-shell").first().waitFor();
  if (await gate.count()) {
    await gate.click();
    await page.locator(".lobby-shell, .meal-shell").first().waitFor();
  }
}

async function capture(page, viewport, state) {
  const file = path.join(OUTPUT_DIR, `${viewport.name}--${state}.png`);
  if (["sources-open", "silence", "error"].includes(state)) {
    await page.locator(".conversation-panel").scrollIntoViewIfNeeded();
  }
  await page.screenshot({ path: file, fullPage: false, animations: "disabled" });
  return file;
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const captures = [];

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await confirmAdult(page);
    await page.locator(".lobby-shell").waitFor();
    captures.push(await capture(page, viewport, "lobby"));

    await page.goto(`${BASE_URL}/table/husserl`, { waitUntil: "domcontentloaded" });
    await page.locator(".table-stage").waitFor();
    await page.locator(".conversation-panel").waitFor();
    await page.locator("canvas[role='img']").waitFor();
    captures.push(await capture(page, viewport, "husserl-table"));

    await page.locator(".object-tray > button").click();
    await page.locator(".object-token").first().click();
    await page.locator(".object-settled").waitFor();
    captures.push(await capture(page, viewport, "memory-settled"));

    await page.locator(".conversation-input").fill("我先看看眼前的东西");
    await page.locator(".conversation-submit").click();
    await waitForConversationIdle(page);
    await page.locator(".source-drawer__toggle").waitFor();
    await page.locator(".source-drawer__toggle").click();
    await page.locator(".source-drawer__list").waitFor();
    await page.locator(".source-drawer__item").first().waitFor();
    captures.push(await capture(page, viewport, "sources-open"));

    await page.locator(".conversation-input").fill("先安静一会儿");
    await page.locator(".conversation-submit").click();
    await waitForConversationIdle(page);
    await page.locator(".conversation-panel--silence").waitFor();
    captures.push(await capture(page, viewport, "silence"));

    await page.route("**/api/chat**", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "模拟服务暂时不可用" }),
      });
    });
    await page.locator(".conversation-input").fill("测试错误状态");
    await page.locator(".conversation-submit").click();
    await page.locator(".error-note[role='alert']").waitFor();
    captures.push(await capture(page, viewport, "error"));
    await page.unroute("**/api/chat**");
    return captures;
  } finally {
    await context.close();
  }
}

async function choose(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
}

async function setRangeWithKeys(page, name, value) {
  const range = page.getByLabel(name, { exact: true });
  await range.focus();
  await page.keyboard.press("Home");
  for (let index = 0; index < value; index += 1) {
    await page.keyboard.press("ArrowRight");
  }
}

async function assertAppearance(page, expected) {
  const actual = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    contrast: document.documentElement.dataset.contrast,
    motion: document.documentElement.dataset.motion,
  }));
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) throw new Error(`外观状态错误：${key}=${actual[key]}，预期 ${value}`);
  }
}

async function runAppearanceAudit(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const captures = [];
  const themes = [["浅色", "light"], ["深色", "dark"]];
  const chroma = [[0, "淡"], [50, "适中"], [100, "浓"]];
  const contrasts = [["标准", "normal"], ["增强", "high"]];
  const motion = [["完整", "full"], ["减少", "reduced"]];

  try {
    await page.goto(`${BASE_URL}/table/husserl`, { waitUntil: "domcontentloaded" });
    await confirmAdult(page);
    await page.locator(".meal-shell").waitFor();
    await page.getByRole("button", { name: "外观", exact: true }).click();
    await page.locator(".appearance-panel[data-open='true']").waitFor();

    let combinations = 0;
    for (const [themeLabel, theme] of themes) {
      await choose(page, themeLabel);
      for (const [chromaValue, chromaLabel] of chroma) {
        await setRangeWithKeys(page, "调整色彩浓度", chromaValue);
        const chromaText = await page.locator(".appearance-range").nth(1).locator("span").textContent();
        if (chromaText !== chromaLabel) throw new Error(`色彩浓度标签错误：${chromaText}，预期 ${chromaLabel}`);
        for (const [contrastLabel, contrast] of contrasts) {
          await choose(page, contrastLabel);
          for (const [motionLabel, motionValue] of motion) {
            await choose(page, motionLabel);
            await assertAppearance(page, { theme, contrast, motion: motionValue });
            combinations += 1;
          }
        }
      }
    }

    await setRangeWithKeys(page, "调整场景暗度", 28);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "appearance-desktop-dark.png"), animations: "disabled" });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".meal-shell").waitFor();
    await assertAppearance(page, { theme: "dark", contrast: "high", motion: "reduced" });

    const trigger = page.getByRole("button", { name: "外观", exact: true });
    await trigger.click();
    await page.keyboard.press("Escape");
    if (await trigger.getAttribute("aria-expanded") !== "false") throw new Error("Escape 没有关闭外观设置");
    await trigger.focus();
    if (!(await trigger.evaluate((element) => document.activeElement === element))) throw new Error("外观设置关闭后焦点没有回到触发器");

    await trigger.click();
    await page.locator(".table-stage").click({ position: { x: 5, y: 5 } });
    if (await trigger.getAttribute("aria-expanded") !== "false") throw new Error("点击外部没有关闭外观设置");

    await trigger.click();
    await choose(page, "浅色");
    await choose(page, "标准");
    await choose(page, "完整");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".appearance-panel[data-open='true']").waitFor();
    captures.push(path.join(OUTPUT_DIR, "appearance-mobile-light.png"));
    await page.screenshot({ path: captures[0], animations: "disabled" });

    return { combinations, captures };
  } finally {
    await context.close();
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || chromium.executablePath(),
    args: ["--disable-gpu", "--in-process-gpu", "--use-angle=swiftshader", "--disable-software-rasterizer"],
  });
  const results = [];
  try {
    for (const viewport of VIEWPORTS) {
      const captures = await runViewport(browser, viewport);
      results.push({ viewport, captures });
      console.log(`✓ ${viewport.name}: ${captures.length} screenshots`);
    }
    const appearance = await runAppearanceAudit(browser);
    console.log(`✓ 外观：${appearance.combinations} 个浅/深、色彩、对比和动态组合；${appearance.captures.length} 张补充截图`);
    const report = {
      baseUrl: BASE_URL,
      browser: await browser.version(),
      generatedAt: new Date().toISOString(),
      results,
      appearance,
    };
    await writeFile(path.join(OUTPUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`视觉回归通过：${VIEWPORTS.length} 个视口，${VIEWPORTS.length * 6 + appearance.captures.length + 1} 张截图`);
    console.log(`输出：${OUTPUT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
