"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccessToken } from "@/utils/auth";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function useUnreadChatCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUnreadCount(0);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.sub;

      const res = await fetch(`${apiBase}/api/v1/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
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
