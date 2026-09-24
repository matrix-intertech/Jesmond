"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { MessageCircle, X, ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import ChatConversation from "./ChatConversation";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const formatConversationTime = (dateValue: string) => {
  const date = new Date(dateValue);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString([], { day: "numeric", month: "short" });
};

export function CompactChatPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Prevent closing if they clicked on the messages button in the navbar
        // We'll just check if it's the chat panel itself
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    // Delay adding the click listener slightly so the toggle button click doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClickOutside), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    if (mounted) {
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        document.body.style.overflow = 'hidden';
      }
      return () => {
        if (isMobile) {
          document.body.style.overflow = 'unset';
        }
      };
    }
  }, [mounted]);

  // ... fetchConversations ...
  useEffect(() => {
    const fetchConversations = async () => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserId(payload.sub);

        const res = await fetch(`${apiBase}/api/v1/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        } else if (res.status === 401) {
          clearAuth();
          router.push("/login");
          onClose();
        } else {
          setError("Failed to load messages.");
        }
      } catch (err) {
        setError("Failed to load messages.");
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [router, onClose]);

  const handleConversationUpdated = useCallback((update: { conversationId: string; conversation?: any; readAt?: string }) => {
    setConversations((currentConversations) =>
      currentConversations.map((conv) => {
        if (conv.id !== update.conversationId) return conv;
        if (update.readAt) {
          return {
            ...conv,
            participants: conv.participants.map((p: any) =>
              p.userId === userId ? { ...p, lastReadAt: update.readAt } : p
            ),
          };
        }
        return { ...conv, ...update.conversation };
      })
    );
  }, [userId]);

  if (!mounted) return null;

  const isChatView = !!selectedConversationId;

  const desktopClasses = isChatView
    ? "sm:fixed sm:bottom-6 sm:right-6 sm:top-auto sm:w-[400px] sm:h-[450px] sm:max-h-[calc(100vh-48px)] sm:rounded-2xl"
    : "sm:fixed sm:top-20 sm:right-4 lg:right-12 xl:right-[max(3rem,calc(50vw-650px))] sm:bottom-auto sm:w-96 sm:h-[480px] sm:max-h-[calc(100vh-100px)] sm:rounded-2xl";

  const mobileClasses = "fixed inset-0 sm:inset-auto w-full h-[100dvh] sm:h-auto z-[150]";

  return createPortal(
    <div 
      ref={panelRef}
      className={`${mobileClasses} ${desktopClasses} bg-white shadow-2xl border-t sm:border border-slate-200 overflow-hidden flex flex-col`}
      onClick={(e) => e.stopPropagation()}
    >
      {selectedConversationId ? (
        <div className="flex flex-col h-full min-h-0 bg-white relative">
          <div className="absolute top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur z-20 border-b border-slate-100 flex items-center px-4">
            <button 
              onClick={() => setSelectedConversationId(null)}
              className="p-2 -ml-2 mr-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">
                {conversations.find(c => c.id === selectedConversationId)?.property?.name || "Chat"}
              </p>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden min-h-0 pt-14 pb-2 flex flex-col">
            <ChatConversation 
              conversationId={selectedConversationId} 
              backHref="#" 
              embedded={true}
              onConversationUpdated={handleConversationUpdated}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full bg-slate-50">
          <div className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4 shrink-0">
            <h3 className="font-bold text-slate-800">Messages</h3>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center p-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-rose-600 text-center">{error}</div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 h-full text-center">
                <MessageCircle className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm font-medium text-slate-600">No conversations yet</p>
                <Link href="/search" onClick={onClose} className="text-sm text-brand-orange hover:underline mt-2">
                  Browse properties
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {conversations.map((conv) => {
                  const latestMessage = conv.messages?.[0];
                  const otherParticipants = conv.participants?.filter((p: any) => p.userId !== userId) || [];
                  const participantNames = otherParticipants.map((p: any) => p.user?.firstName || "Host").join(", ") || "Host";
                  const myParticipant = conv.participants?.find((p: any) => p.userId === userId);
                  const unread = latestMessage && myParticipant && (!myParticipant.lastReadAt || new Date(latestMessage.createdAt) > new Date(myParticipant.lastReadAt)) && latestMessage.senderId !== userId;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`w-full text-left p-4 hover:bg-slate-100 transition-colors flex items-start gap-3 ${unread ? 'bg-orange-50/50' : 'bg-white'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 overflow-hidden relative border border-slate-100">
                        {conv.property?.thumbnailUrl ? (
                          <img src={conv.property.thumbnailUrl} alt="Property" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-50">
                            {conv.property?.name?.charAt(0) || "P"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <p className={`text-sm truncate pr-2 ${unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                            {conv.property?.name || "Property"}
                          </p>
                          {latestMessage && (
                            <span className="text-[11px] text-slate-400 shrink-0">
                              {formatConversationTime(latestMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-slate-500 truncate mb-1">
                          {participantNames}
                        </p>
                        <p className={`text-[13px] truncate ${unread ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                          {latestMessage ? latestMessage.encryptedPayload || "Message sent" : "No messages yet"}
                        </p>
                      </div>
                      {unread && <div className="w-2 h-2 rounded-full bg-brand-orange mt-1.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="p-3 bg-white border-t border-slate-100 text-center shrink-0">
            <Link 
              href="/messages" 
              onClick={onClose}
              className="text-sm font-semibold text-brand-orange hover:text-orange-600 transition-colors inline-block w-full py-1"
            >
              Open full chat
            </Link>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
