"use client";

import { useEffect, useState } from "react";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
          setError("");

          try {
            const tokenPayload = JSON.parse(atob(token.split(".")[1]));
            setUserId(tokenPayload.sub);
          } catch(e) {}
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
    <div className="max-w-4xl mx-auto px-4 py-8 min-h-screen">
      <PageHeader title="Messages" description="Private conversations with property hosts" />

      {error && <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-16 bg-slate-100 rounded-xl"></div>
          <div className="h-16 bg-slate-100 rounded-xl"></div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
          No messages yet. Contact a property host to start chatting!
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {conversations.map(conv => {
            const myParticipant = conv.participants?.find((p: any) => p.userId === userId);
            const latestMessage = conv.messages?.[0];
            const latestActivityAt = latestMessage?.createdAt || conv.updatedAt;
            const isUnread = myParticipant && latestActivityAt && (!myParticipant.lastReadAt || new Date(myParticipant.lastReadAt) < new Date(latestActivityAt));

            return (
              <div key={conv.id} className={`p-4 bg-white border ${isUnread ? "border-brand-navy shadow-sm" : "border-slate-200"} rounded-xl hover:shadow-md transition-shadow cursor-pointer flex justify-between items-center relative`} onClick={() => router.push(`/messages/${conv.id}`)}>
                {isUnread && (
                  <div className="absolute top-4 right-4 w-3 h-3 bg-brand-orange rounded-full"></div>
                )}
                <div>
                  <h3 className={`font-semibold ${isUnread ? "text-brand-navy font-bold" : "text-slate-800"}`}>{conv.property?.name || "Unknown Property"}</h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                    {latestMessage ? "New message" : "No messages yet"}
                  </p>
                </div>
                <div className="text-xs text-slate-400 mt-6 md:mt-0">
                  {new Date(latestActivityAt).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
