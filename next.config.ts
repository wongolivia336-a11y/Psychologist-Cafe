import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 语料索引在构建期生成，运行时由 API 路由用 fs 读取。
  outputFileTracingIncludes: {
    "/api/**": ["./data/index.json"],
  },
};

export default nextConfig;
