import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const BASE_URL = process.env.PERFORMANCE_BASE_URL ?? "http://127.0.0.1:3020";
const OUTPUT_DIR = process.env.PERFORMANCE_OUTPUT_DIR ?? path.join(process.cwd(), ".performance-audit");
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE;

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const candidate of [PLAYWRIGHT_MODULE, "playwright"].filter(Boolean)) {
    try { return require(candidate); } catch { /* Try the next available runtime. */ }
  }
  throw new Error("找不到 Playwright 运行时；未执行性能基线。");
}

const { chromium } = loadPlaywright();

async function confirmAdult(page) {
  const gate = page.locator(".adult-gate__confirm");
  if (await gate.count()) await gate.click();
}

async function measure(browser, viewport, route) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__cafePerformance = { lcp: null, cls: 0, longTasks: 0 };
    new PerformanceObserver((entries) => {
      const last = entries.getEntries().at(-1);
      if (last) window.__cafePerformance.lcp = Math.round(last.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        if (!entry.hadRecentInput) window.__cafePerformance.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((entries) => {
      window.__cafePerformance.longTasks += entries.getEntries().length;
    }).observe({ type: "longtask", buffered: true });
  });
  try {
    await page.goto(BASE_URL + "/", { waitUntil: "networkidle" });
    await confirmAdult(page);
    await page.goto(BASE_URL + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    return await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      return {
        route: location.pathname,
        domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
        loadMs: Math.round(navigation.loadEventEnd),
        transferBytes: navigation.transferSize,
        lcpMs: window.__cafePerformance.lcp,
        cls: Number(window.__cafePerformance.cls.toFixed(4)),
        longTasks: window.__cafePerformance.longTasks,
      };
    });
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
  try {
    const results = [];
    for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
      const metrics = await measure(browser, viewport, "/table/husserl");
      results.push({ viewport: viewport.name, ...metrics });
      console.log("✓ " + viewport.name + " table: DCL " + metrics.domContentLoadedMs + "ms, LCP " + metrics.lcpMs + "ms");
    }
    await writeFile(path.join(OUTPUT_DIR, "report.json"), JSON.stringify({
      generatedAt: new Date().toISOString(),
      browser: await browser.version(),
      baseUrl: BASE_URL,
      note: "ponytail: local headless baseline only; use field RUM and real mobile hardware before setting performance budgets.",
      results,
    }, null, 2) + "\n");
    console.log("性能基线输出：" + OUTPUT_DIR);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
