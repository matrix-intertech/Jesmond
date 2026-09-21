"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

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

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title="Messages" description="Private conversations with property hosts" />

      {error && <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex animate-pulse items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="h-16 w-16 rounded-xl bg-slate-100" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-4 w-1/2 rounded bg-slate-100" />
                <div className="h-3 w-3/4 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-bold text-brand-navy">Your messages will appear here.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Start from a property page when you are ready to contact a host.</p>
          <Link href="/search" className="mt-6 inline-flex rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600">
            Browse properties
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => {
            const myParticipant = conv.participants?.find((p: any) => p.userId === userId);
            const latestMessage = conv.messages?.[0];
            const latestMessagePreview = typeof latestMessage?.encryptedPayload === "string" && latestMessage.encryptedPayload.trim()
              ? latestMessage.encryptedPayload
              : "No messages yet";
            const latestActivityAt = latestMessage?.createdAt || conv.updatedAt;
            const isUnread = myParticipant && latestActivityAt && (!myParticipant.lastReadAt || new Date(myParticipant.lastReadAt) < new Date(latestActivityAt));
            const propertyImage = getPropertyImage(conv.property);

            return (
              <button
                key={conv.id}
                type="button"
                className={`group flex w-full items-center gap-4 rounded-2xl border bg-white p-3 text-left transition hover:border-brand-orange hover:shadow-md sm:p-4 ${
                  isUnread ? "border-brand-orange shadow-sm ring-1 ring-brand-orange/20" : "border-slate-200"
                }`}
                onClick={() => router.push(`/messages/${conv.id}`)}
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-20 sm:w-20">
                  <img src={propertyImage || placeholderImage} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className={`truncate text-base font-bold group-hover:text-brand-orange ${isUnread ? "text-brand-navy" : "text-slate-800"}`}>
                      {conv.property?.name || "Unknown Property"}
                    </h3>
                    {latestActivityAt && <span className="shrink-0 text-xs font-medium text-slate-400">{formatConversationTime(latestActivityAt)}</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {isUnread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-orange" aria-label="Unread conversation" />}
                    <p className={`truncate text-sm ${isUnread ? "font-semibold text-brand-navy" : "text-slate-500"}`}>{latestMessagePreview}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
