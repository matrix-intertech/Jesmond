'use client'

import Image, { ImageProps } from 'next/image';
import { useState, useEffect } from 'react';

const r2UrlStr = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
let r2Hostname = '';
if (r2UrlStr) {
  try {
    const parsed = new URL(r2UrlStr);
    r2Hostname = parsed.hostname;
  } catch (e) {
    // Ignore invalid url
  }
}

function isSafeUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    if (r2Hostname && parsedUrl.hostname === r2Hostname) {
      return true;
    }
    if (parsedUrl.hostname.endsWith('.amazonaws.com')) {
      return true;
    }
    return false;
  } catch {
    // Relative URL or invalid URL string
    if (url.includes('test.com') || url.includes('/properties/')) {
      return false;
    }
    return url.startsWith('/');
  }
}

export function SafeImage({ src, alt, fallback = '/assets/property-placeholder.png', ...props }: ImageProps & { fallback?: string }) {
  const initialSrc = (typeof src === 'string' && isSafeUrl(src)) ? src : fallback;
  const [imgSrc, setImgSrc] = useState<string>(initialSrc);

  useEffect(() => {
    const newSrc = (typeof src === 'string' && isSafeUrl(src)) ? src : fallback;
    setImgSrc(newSrc);
  }, [src, fallback]);

  return (
    <Image 
      {...props} 
      src={imgSrc} 
      alt={alt || 'Image'} 
      onError={() => {
        if (imgSrc !== fallback) {
          setImgSrc(fallback);
        }
      }}
    />
  );
}
