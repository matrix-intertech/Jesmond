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

const extraImgOrigins = ['https://*.amazonaws.com'];
if (r2Url) {
  try {
    const parsedUrl = new URL(r2Url);
    extraImgOrigins.push(parsedUrl.origin);
  } catch {
    // Already logged above
  }
}

const extraConnectOrigins = [];
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
if (publicApiUrl) {
  try {
    extraConnectOrigins.push(new URL(publicApiUrl).origin);
  } catch {
    // Ignore invalid NEXT_PUBLIC_API_URL
  }
}

// Report-Only CSP based on inventoried origins (never enforced in Phase 1)
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com https://cdnjs.cloudflare.com https://raw.githubusercontent.com https://images.unsplash.com ${extraImgOrigins.join(' ')}`,
  `connect-src 'self' https://nominatim.openstreetmap.org https://challenges.cloudflare.com https://api.stripe.com ${extraConnectOrigins.join(' ')}`.trim(),
  "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(self)',
  },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: cspReportOnly,
  },
];

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  images: {
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
