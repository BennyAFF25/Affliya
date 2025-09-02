/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Skip type checking during builds on Vercel
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip ESLint checks during builds on Vercel
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;