/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable server actions
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '..'),
  },
  // API proxy to gateway
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3006/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
