"use client";

import { useEffect, useRef } from 'react';
import { getAccessToken } from '@/utils/auth';

export function LeadTracker({ organizationId, propertyId }: { organizationId: string, propertyId?: string }): React.ReactNode {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current || !organizationId) return;
    tracked.current = true;

    const trackVisit = async () => {
      // Create or get anonymous visitor ID from localStorage
      let visitorId = localStorage.getItem('jesmond_visitor_id');
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem('jesmond_visitor_id', visitorId);
      }

      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/leads/track`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            visitorId,
            organizationId,
            propertyId
          })
        });
      } catch (err) {
        console.error('Lead tracking failed:', err);
      }
    };

    trackVisit();
  }, [organizationId, propertyId]);

  return null; // Silent component
}
