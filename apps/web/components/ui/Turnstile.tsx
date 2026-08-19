'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

interface TurnstileProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export default function Turnstile({ onVerify, onError, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // If turnstile is already present from a previous render
    if (window.turnstile) {
      setScriptLoaded(true);
    }
  }, []);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) {
      console.warn('Turnstile Site Key is missing');
      return;
    }

    if (!scriptLoaded || !window.turnstile || !containerRef.current) {
      return;
    }

    if (widgetIdRef.current) {
      return;
    }

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'error-callback': onError,
        'expired-callback': onExpire,
        theme: 'light',
      });
    } catch (e) {
      console.warn('Turnstile widget render failed', e);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [scriptLoaded, onVerify, onError, onExpire]);

  return (
    <div className="flex justify-center mt-4 mb-4">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} />
    </div>
  );
}

declare global {
  interface Window {
    turnstile: any;
  }
}
