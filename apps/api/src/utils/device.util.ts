export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
}

export function parseUserAgent(userAgent?: string | null): DeviceInfo {
  if (!userAgent) {
    return { type: 'unknown', browser: 'Unknown', os: 'Unknown' };
  }

  const ua = userAgent.toLowerCase();

  // OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac') && !ua.includes('iphone') && !ua.includes('ipad')) os = 'macOS';
  else if (ua.includes('linux') && !ua.includes('android')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  // Browser
  let browser = 'Unknown';
  if (ua.includes('edg/') || ua.includes('edge/')) browser = 'Edge';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';
  else if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';

  // Device Type
  let type: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'desktop';
  if (ua.includes('mobi') || ua.includes('android') || ua.includes('iphone')) type = 'mobile';
  if (ua.includes('ipad') || ua.includes('tablet')) type = 'tablet';

  // Special cases for macOS which is desktop
  if (os === 'macOS' || os === 'Windows' || os === 'Linux') {
    if (!ua.includes('mobi') && !ua.includes('tablet')) {
      type = 'desktop';
    }
  }

  return { type, browser, os };
}
