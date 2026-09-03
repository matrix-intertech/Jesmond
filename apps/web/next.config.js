/** @type {import('next').NextConfig} */
const remotePatterns = [];
const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

if (r2Url) {
  try {
    const parsedUrl = new URL(r2Url);
    remotePatterns.push({
      protocol: parsedUrl.protocol.replace(':', ''),
      hostname: parsedUrl.hostname,
    });
  } catch (e) {
    console.error('Invalid NEXT_PUBLIC_R2_PUBLIC_URL provided. Cannot parse hostname for next/image configuration.');
  }
}

// Add generic AWS domain to support legacy/seed records
remotePatterns.push({
  protocol: 'https',
  hostname: '*.amazonaws.com',
});

const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
