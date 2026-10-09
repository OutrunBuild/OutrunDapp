import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // e2e 专用产物目录：pnpm test:e2e 以 NEXT_DIST_DIR=.next-e2e 构建+启动，
  // 与运行中的 .next（dev / 生产预览）完全隔离（部署纪律见 AGENTS.md 已知坑）
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // 阶段 3 约束（architecture §12/runbook 步骤 2）：
  // next build 必须调用项目 .bin/tsc（TS 7.0.2）真检查，不得忽略类型错误。
  experimental: {
    useTypeScriptCli: true,
  },
  typescript: {
    // 不得出现 ignoreBuildErrors: true（runbook 明令禁止）
  },
  images: {
    // 原型阶段品牌图为本地静态资源，不经图像优化管线（避免 sharp 依赖）
    unoptimized: true,
  },
  async headers() {
    // CSP 不在此配置：proxy.ts 逐请求生成 nonce 的强制 CSP（architecture §14）
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63036000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // CJK 字体子集产物（决议 029 补充 2）：文件名含内容哈希，可安全 immutable
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // 覆盖清单 URL 不带哈希、每次重切内容会变，不得 immutable（仅对账闸读文件，
        // 此头只是防未来出现 HTTP 消费者时被缓存一年旧版）
        source: '/fonts/noto-sc-subset-chars.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
