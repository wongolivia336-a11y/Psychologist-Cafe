import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Regression runs can isolate Next's transient output from another local server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // 语料索引在构建期由 `npm run index` 生成，运行时由 /api/chat 用 fs 读取。
  // serverless 打包默认不会带上它，必须显式声明，否则线上检索直接零召回。
  // 两种 key 写法都留着：App Router 的 trace key 是 "/api/chat/route"，
  // 通配写法在不同 Next 版本上覆盖范围不一致。
  outputFileTracingIncludes: {
    "/api/chat/route": ["./data/index.json"],
    "/api/**": ["./data/index.json"],
  },
};

export default nextConfig;
