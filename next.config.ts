import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
