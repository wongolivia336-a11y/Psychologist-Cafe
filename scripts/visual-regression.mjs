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
    const report = {
      baseUrl: BASE_URL,
      browser: await browser.version(),
      generatedAt: new Date().toISOString(),
      results,
    };
    await writeFile(path.join(OUTPUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`视觉回归通过：${VIEWPORTS.length} 个视口，${VIEWPORTS.length * 6} 张截图`);
    console.log(`输出：${OUTPUT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
