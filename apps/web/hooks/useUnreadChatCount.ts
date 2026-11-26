"use client";
import { getApiUrl } from '@/utils/api';

import { useState, useEffect, useCallback } from "react";
import { getAccessToken, buildAuthHeaders, hasBrowserAuth } from "@/utils/auth";

const apiBase = getApiUrl();

export function useUnreadChatCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    const token = getAccessToken();
    if (!hasBrowserAuth()) {
      setUnreadCount(0);
      return;
    }

    try {
      const parts = token.split(".");
      if (parts.length < 2) return;
      const payload = JSON.parse(atob(parts[1]));
      const userId = payload?.sub;
      if (!userId) return;

      const res = await fetch(`${apiBase}/api/v1/chat/conversations`, {
        headers: buildAuthHeaders(),
      });

      if (res.ok) {
        const conversations = await res.json();
        let count = 0;

        for (const conv of conversations) {
          const myParticipant = conv.participants?.find((p: any) => p.userId === userId);
          // Sort messages to get the latest one just in case
          const messages = conv.messages || [];
          if (messages.length === 0) continue;

          const sortedMessages = [...messages].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const latestMessage = sortedMessages[0];

          if (latestMessage && myParticipant && latestMessage.senderId !== userId) {
            if (!myParticipant.lastReadAt || new Date(latestMessage.createdAt) > new Date(myParticipant.lastReadAt)) {
              count++;
            }
          }
        }

        setUnreadCount(count);
      }
    } catch (e) {
      console.error("Failed to fetch unread chat count", e);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000); // poll every minute

    // Listen for custom event to update immediately
    window.addEventListener("chatUpdated", fetchUnreadCount);

    return () => {
      clearInterval(interval);
      window.removeEventListener("chatUpdated", fetchUnreadCount);
    };
  }, [fetchUnreadCount]);

  return unreadCount;
}
