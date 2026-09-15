import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // 检索评测要加载 6MB 索引并跑几十次检索
    testTimeout: 30_000,
  },
});
