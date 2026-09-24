"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAuth, getAccessToken } from "@/utils/auth";
import ChatConversation from "@/components/chat/ChatConversation";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const placeholderImage = "/assets/property-placeholder.png";

const getPropertyImage = (property: any) =>
  property?.thumbnailUrl ||
  property?.imageUrl ||
  property?.coverImage ||
  property?.media?.[0]?.url ||
  property?.photos?.[0]?.url ||
  property?.images?.[0]?.url ||
  "";

const getUserIdFromToken = () => {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const tokenPayload = JSON.parse(atob(token.split(".")[1]));
    return tokenPayload.sub || null;
  } catch {
    return null;
  }
};

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

type StudentMessagesWorkspaceProps = {
  selectedConversationId?: string;
};

export default function StudentMessagesWorkspace({ selectedConversationId }: StudentMessagesWorkspaceProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchConversations = async () => {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        const res = await fetch(`${apiBase}/api/v1/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
          setError("");

          try {
            const tokenPayload = JSON.parse(atob(token.split(".")[1]));
            setUserId(tokenPayload.sub);
          } catch {}
        } else if (res.status === 401) {
          clearAuth();
          router.push("/login");
        } else {
          setError("Failed to load messages.");
        }
      } catch {
        setError("Failed to load messages.");
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [router]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conv) => {
      const latestMessage = conv.messages?.[0]?.encryptedPayload || "";
      const propertyName = conv.property?.name || "";
      return `${propertyName} ${latestMessage}`.toLowerCase().includes(query);
    });
  }, [conversations, searchQuery]);

  const handleConversationUpdated = useCallback((update: { conversationId: string; conversation?: any; readAt?: string }) => {
    setConversations((currentConversations) =>
      currentConversations.map((conv) => {
        if (conv.id !== update.conversationId) return conv;

        const latestMessage = update.conversation?.messages?.[update.conversation.messages.length - 1];
        const currentUserId = userId || getUserIdFromToken();
        const nextParticipants = update.readAt && currentUserId
          ? (update.conversation?.participants || conv.participants)?.map((participant: any) =>
              participant.userId === currentUserId ? { ...participant, lastReadAt: update.readAt } : participant,
            )
          : update.conversation?.participants || conv.participants;

        return {
          ...conv,
          ...(update.conversation || {}),
          property: update.conversation?.property || conv.property,
          participants: nextParticipants,
          messages: latestMessage ? [latestMessage] : update.conversation?.messages || conv.messages,
          updatedAt: update.conversation?.updatedAt || latestMessage?.createdAt || conv.updatedAt,
        };
      }),
    );
  }, [userId]);

  const renderConversationList = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex animate-pulse items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="h-14 w-14 rounded-xl bg-slate-100" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-4 w-2/3 rounded bg-slate-100" />
                <div className="h-3 w-4/5 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (conversations.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
          <h2 className="text-base font-bold text-brand-navy">Your messages will appear here.</h2>
          <p className="mt-2 text-sm text-slate-500">Start from a property page when you are ready to contact a host.</p>
          <Link href="/search" className="mt-5 inline-flex rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600">
            Browse properties
          </Link>
        </div>
      );
    }

    if (filteredConversations.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
          No conversations match your search.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredConversations.map((conv) => {
          const myParticipant = conv.participants?.find((p: any) => p.userId === userId);
          const latestMessage = conv.messages?.[0];
          const latestMessagePreview = typeof latestMessage?.encryptedPayload === "string" && latestMessage.encryptedPayload.trim()
            ? latestMessage.encryptedPayload
            : "No messages yet";
          const latestActivityAt = latestMessage?.createdAt || conv.updatedAt;
          const isUnread = myParticipant && latestActivityAt && (!myParticipant.lastReadAt || new Date(myParticipant.lastReadAt) < new Date(latestActivityAt));
          const propertyImage = getPropertyImage(conv.property);
          const isActive = conv.id === selectedConversationId;

          return (
            <button
              key={conv.id}
              type="button"
              className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-brand-orange hover:bg-white hover:shadow-sm ${
                isActive
                  ? "border-brand-orange bg-white shadow-sm ring-1 ring-brand-orange/20"
                  : isUnread
                    ? "border-brand-orange/60 bg-orange-50/40"
                    : "border-slate-200 bg-white"
              }`}
              onClick={() => router.push(`/messages/${conv.id}`)}
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                <img src={propertyImage || placeholderImage} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`truncate text-sm font-bold group-hover:text-brand-orange ${isUnread || isActive ? "text-brand-navy" : "text-slate-800"}`}>
                    {conv.property?.name || "Unknown Property"}
                  </h3>
                  {latestActivityAt && <span className="shrink-0 text-[11px] font-medium text-slate-400">{formatConversationTime(latestActivityAt)}</span>}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-orange" aria-label="Unread conversation" />}
                  <p className={`truncate text-xs ${isUnread ? "font-semibold text-brand-navy" : "text-slate-500"}`}>{latestMessagePreview}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`mx-auto w-full max-w-7xl sm:px-6 lg:h-[calc(100vh-48px)] lg:min-h-0 lg:py-6 ${
      selectedConversationId 
        ? "fixed inset-0 top-[72px] sm:top-auto sm:inset-auto z-40 bg-white sm:static sm:bg-transparent sm:z-auto h-[calc(100vh-72px)] sm:h-auto" 
        : "min-h-[calc(100vh-72px)] px-4 py-6"
    }`}>
      {error && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className={`overflow-hidden bg-white lg:grid lg:h-full lg:grid-cols-[360px_minmax(0,1fr)] lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm xl:grid-cols-[400px_minmax(0,1fr)] ${
        selectedConversationId ? "h-full" : ""
      }`}>
        <aside className={`${selectedConversationId ? "hidden lg:flex" : "flex"} min-h-0 flex-col bg-white lg:border-r lg:border-slate-200`}>
          <div className="shrink-0 border-b border-slate-200 px-4 py-5 sm:px-5">
            <h1 className="text-2xl font-bold text-brand-navy">Messages</h1>
            <p className="mt-1 text-sm text-slate-500">Your conversations with property hosts</p>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations"
                className="h-11 w-full rounded-full border border-slate-300 bg-white pl-10 pr-4 text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-3 sm:p-4">
            {renderConversationList()}
          </div>
        </aside>

        <section className={`${selectedConversationId ? "flex" : "hidden lg:flex"} min-h-0 flex-col bg-white`}>
          {selectedConversationId ? (
            <ChatConversation conversationId={selectedConversationId} backHref="/messages" embedded onConversationUpdated={handleConversationUpdated} />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-50/70 p-8 text-center">
              <div className="max-w-sm">
                <h2 className="text-xl font-bold text-brand-navy">Select a conversation</h2>
                <p className="mt-2 text-sm text-slate-500">Choose a property conversation from the list to continue messaging.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
