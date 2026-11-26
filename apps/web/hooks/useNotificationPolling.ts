"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAccessToken, buildAuthHeaders, hasBrowserAuth } from "@/utils/auth";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  metadata?: any;
}

export interface UseNotificationPollingOptions {
  organizationId?: string | null;
  limit?: number;
}

const ACTIVE_POLL_INTERVAL_MS = 60000; // 60 seconds when active
const HIDDEN_POLL_INTERVAL_MS = 300000; // 300 seconds when background/hidden

export function useNotificationPolling(options?: UseNotificationPollingOptions) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const orgId = options?.organizationId;
  const limit = options?.limit || 10;

  const fetchNotifications = useCallback(async () => {
    const token = getAccessToken();
    if (!hasBrowserAuth()) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const headers: Record<string, string> = buildAuthHeaders();
      if (orgId) {
        headers["X-Organization-Id"] = orgId;
      }

      const queryParams = new URLSearchParams({ limit: String(limit) });
      if (orgId) {
        queryParams.set("organizationId", orgId);
      }

      const [listRes, countRes] = await Promise.all([
        fetch(`/api/v1/notifications?${queryParams.toString()}`, { headers }),
        fetch(
          `/api/v1/notifications/unread-count${orgId ? `?organizationId=${orgId}` : ""}`,
          { headers },
        ),
      ]);

      if (listRes.ok) {
        const listData = await listRes.json();
        setNotifications(listData.data || listData || []);
      }

      if (countRes.ok) {
        const countData = await countRes.json();
        setUnreadCount(countData.count ?? 0);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  }, [orgId, limit]);

  // Dynamic timer adjusting between active (60s) and hidden (300s) tabs
  const scheduleNextPoll = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const isHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    const delay = isHidden ? HIDDEN_POLL_INTERVAL_MS : ACTIVE_POLL_INTERVAL_MS;

    timerRef.current = setTimeout(async () => {
      await fetchNotifications();
      scheduleNextPoll();
    }, delay);
  }, [fetchNotifications]);

  useEffect(() => {
    setLoading(true);
    fetchNotifications();
    scheduleNextPoll();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Tab brought to foreground: immediate refresh
        fetchNotifications();
        scheduleNextPoll();
      } else {
        // Tab sent to background: adjust interval
        scheduleNextPoll();
      }
    };

    const handleFocus = () => {
      fetchNotifications();
      scheduleNextPoll();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [fetchNotifications, scheduleNextPoll]);

  // Immediate optimistic update on mark as read
  const markAsRead = useCallback(
    async (id: string) => {
      const token = getAccessToken();
      if (!hasBrowserAuth()) return;

      // Optimistic cache update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        const headers: Record<string, string> = buildAuthHeaders();
        if (orgId) headers["X-Organization-Id"] = orgId;

        await fetch(`/api/v1/notifications/${id}/read`, {
          method: "PATCH",
          headers,
        });
      } catch (err) {
        // If request fails, revert by refetching
        fetchNotifications();
      }
    },
    [orgId, fetchNotifications],
  );

  // Immediate optimistic update on mark all as read
  const markAllAsRead = useCallback(async () => {
    const token = getAccessToken();
    if (!hasBrowserAuth()) return;

    // Optimistic cache update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      if (orgId) headers["X-Organization-Id"] = orgId;

      await fetch("/api/v1/notifications/read-all", {
        method: "PATCH",
        headers,
        body: JSON.stringify(orgId ? { organizationId: orgId } : {}),
      });
    } catch (err) {
      fetchNotifications();
    }
  }, [orgId, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
