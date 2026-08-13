import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 다른 사이트가 iframe으로 내 앱을 감싸는 클릭재킹 방지
          { key: "X-Frame-Options", value: "DENY" },
          // 브라우저가 파일 타입을 함부로 재해석(스니핑)하지 못하게 함
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 다른 사이트로 이동할 때 내 앱 URL(경로)이 그대로 노출되지 않게 함
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
