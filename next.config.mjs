/** @type {import('next').NextConfig} */
const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim();
const backendBaseUrl = (/^https?:\/\//u.test(configuredApiUrl)
  ? configuredApiUrl
  : 'https://tracker-backend-mocha.vercel.app/api/v1'
).replace(/\/+$/u, '');

const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
