/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // xlsx 같은 Node.js 전용 패키지를 서버에서만 사용
  serverExternalPackages: ['xlsx'],
}

export default nextConfig
