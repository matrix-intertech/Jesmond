"use client";

import { useEffect, useRef } from "react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { isAuthenticated } from "@/utils/auth";

export function PushNotificationInitializer(): null {
  const { isSupported, permission, subscribe } = usePushSubscription();
  const initAttempted = useRef(false);

  useEffect(() => {
    // Ensure we only attempt this once per session on the client
    if (initAttempted.current || !isSupported) return;

    const auth = isAuthenticated();
    if (!auth) return;

    if (permission === "default") {
      initAttempted.current = true;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (vapidKey) {
        subscribe(vapidKey).catch((err) => {
          console.error("[Push] Failed to subscribe:", err);
        });
      } else {
        console.warn("[Push] VAPID key is missing.");
      }
    } else if (permission === "granted") {
        // If already granted, the hook's checkSubscription handles checking if we are subscribed
        // But if not subscribed, we might want to ensure we resubscribe here
        initAttempted.current = true;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (vapidKey) {
           subscribe(vapidKey).catch(console.error);
        }
    }
  }, [isSupported, permission, subscribe]);

  return null;
}
