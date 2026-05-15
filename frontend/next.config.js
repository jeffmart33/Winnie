/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    serverComponentsExternalPackages: ['pg']
  },

  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: 'https://winnie-egkb.onrender.com/:path*'
      }
    ];
  }
};

module.exports = nextConfig;
