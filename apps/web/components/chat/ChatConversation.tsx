"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { clearAuth, getAccessToken } from "@/utils/auth";

type ChatConversationProps = {
  conversationId: string;
  backHref: string;
  embedded?: boolean;
  onConversationUpdated?: (update: {
    conversationId: string;
    conversation?: any;
    readAt?: string;
  }) => void;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const placeholderImage = "/assets/property-placeholder.png";
const scrollBottomThreshold = 140;

const getPropertyImage = (property: any) =>
  property?.thumbnailUrl ||
  property?.imageUrl ||
  property?.coverImage ||
  property?.media?.[0]?.url ||
  property?.photos?.[0]?.url ||
  property?.images?.[0]?.url ||
  "";

const formatMessageDate = (dateValue: string) => {
  const date = new Date(dateValue);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

const formatMessageTime = (dateValue: string) =>
  new Date(dateValue).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const getMessageKey = (message: any) => message ? `${message.id || "message"}:${message.createdAt || ""}` : "";

export default function ChatConversation({ conversationId, backHref, embedded = false, onConversationUpdated }: ChatConversationProps) {
  const router = useRouter();
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const lastMessageKeyRef = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);
  const lastReadNotifiedKeyRef = useRef<string | null>(null);
  const onConversationUpdatedRef = useRef(onConversationUpdated);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");

  const messages = useMemo(() => conversation?.messages || [], [conversation?.messages]);
  const propertyImage = getPropertyImage(conversation?.property);
  const otherParticipants = useMemo(
    () => conversation?.participants?.filter((p: any) => p.userId !== currentUserId) || [],
    [conversation?.participants, currentUserId],
  );
  const participantLabel = otherParticipants
    .map((p: any) => [p.user?.firstName, p.user?.lastName].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(", ");

  useEffect(() => {
    onConversationUpdatedRef.current = onConversationUpdated;
  }, [onConversationUpdated]);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setCurrentUserId(payload.sub);
      } catch {}
    }
  }, []);

  const markRead = async (token: string, latestMessageKey?: string) => {
    const res = await fetch(`${apiBase}/api/v1/chat/conversations/${conversationId}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok && latestMessageKey && lastReadNotifiedKeyRef.current !== latestMessageKey) {
      lastReadNotifiedKeyRef.current = latestMessageKey;
      onConversationUpdatedRef.current?.({ conversationId, readAt: new Date().toISOString() });
    }
  };

  const fetchConversation = async (options?: { notifyParent?: boolean }) => {
    const token = getAccessToken();
    if (!token) return router.push("/login");

    try {
      const res = await fetch(`${apiBase}/api/v1/chat/conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const latestMessage = data.messages?.[data.messages.length - 1];
        const latestMessageKey = getMessageKey(latestMessage);

        setConversation(data);
        setError("");
        if (options?.notifyParent) {
          onConversationUpdatedRef.current?.({ conversationId, conversation: data });
        }
        void markRead(token, latestMessageKey);
      } else if (res.status === 401) {
        clearAuth();
        router.push("/login");
      } else {
        setError("You do not have access to this conversation.");
      }
    } catch {
      setError("Failed to load conversation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    lastMessageKeyRef.current = null;
    isNearBottomRef.current = true;
    lastReadNotifiedKeyRef.current = null;
    void fetchConversation();
    const interval = setInterval(fetchConversation, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    const latestMessage = messages[messages.length - 1];
    if (!scrollArea || !latestMessage) return;

    const latestMessageKey = getMessageKey(latestMessage);
    const previousMessageKey = lastMessageKeyRef.current;
    const isNewLatestMessage = latestMessageKey !== previousMessageKey;

    if (!isNewLatestMessage) return;

    const isInitialLoad = !previousMessageKey;
    const shouldScroll = isInitialLoad || latestMessage.senderId === currentUserId || isNearBottomRef.current;
    lastMessageKeyRef.current = latestMessageKey;

    if (shouldScroll) {
      requestAnimationFrame(() => {
        scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: isInitialLoad ? "auto" : "smooth" });
        isNearBottomRef.current = true;
      });
    }
  }, [messages, currentUserId]);

  const handleMessagesScroll = () => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const distanceFromBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
    isNearBottomRef.current = distanceFromBottom < scrollBottomThreshold;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = newMessage.trim();
    if (!messageText || sending) return;

    setSending(true);
    setSendError("");
    const token = getAccessToken();
    if (!token) {
      setSending(false);
      router.push("/login");
      return;
    }

    try {
      const res = await fetch(`${apiBase}/api/v1/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ encryptedPayload: messageText }),
      });

      if (res.ok) {
        setNewMessage("");
        await fetchConversation({ notifyParent: true });
      } else {
        const isJson = res.headers.get("content-type")?.includes("application/json");
        const body = isJson ? await res.json() : { message: await res.text() };
        setSendError(body.message || "Failed to send message.");
      }
    } catch {
      setSendError("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-8 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand-orange" />
        Loading conversation...
      </div>
    );
  }

  let lastDateLabel = "";

  return (
    <div className={`mx-auto flex w-full flex-col overflow-hidden bg-white ${embedded ? "h-full max-w-none" : "h-[calc(100vh-72px)] max-w-4xl sm:my-4 sm:h-[calc(100vh-104px)] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-sm"}`}>
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        <Link
          href={backHref}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-brand-orange"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <img src={propertyImage || placeholderImage} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-brand-navy sm:text-lg">
            {conversation?.property?.name || "Conversation"}
          </h1>
          <p className="text-xs font-medium text-slate-500">Private conversation</p>
          {participantLabel && <p className="truncate text-xs text-slate-400">{participantLabel}</p>}
        </div>
      </div>

      {error ? (
        <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : (
        <>
          <div ref={scrollAreaRef} onScroll={handleMessagesScroll} className="flex-1 min-h-0 overflow-y-auto bg-slate-50/70 px-4 py-5 sm:px-6">
            {messages.length === 0 ? (
              <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
                <h2 className="text-lg font-bold text-brand-navy">Start the conversation</h2>
                <p className="mt-2 text-sm text-slate-500">Send a message to begin your enquiry.</p>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-3">
                {messages.map((msg: any) => {
                  const isMe = msg.senderId === currentUserId;
                  const dateLabel = formatMessageDate(msg.createdAt);
                  const showDate = dateLabel !== lastDateLabel;
                  lastDateLabel = dateLabel;

                  return (
                    <div key={msg.id} className="flex flex-col gap-3">
                      {showDate && (
                        <div className="flex justify-center py-2">
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
                            {dateLabel}
                          </span>
                        </div>
                      )}
                      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <div
                          className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm sm:max-w-[72%] ${
                            isMe
                              ? "rounded-br-md bg-brand-navy text-white"
                              : "rounded-bl-md border border-slate-200 bg-white text-brand-navy"
                          }`}
                        >
                          {msg.encryptedPayload}
                        </div>
                        <div className={`mt-1 text-[11px] text-slate-400 ${isMe ? "pr-1" : "pl-1"}`}>
                          {formatMessageTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
            {sendError && <div className="mb-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{sendError}</div>}

            <form onSubmit={handleSendMessage} className="mx-auto flex max-w-3xl gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="min-h-11 flex-1 rounded-full border border-slate-300 px-4 text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/20 disabled:bg-slate-100"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-brand-orange px-4 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline">{sending ? "Sending" : "Send"}</span>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
