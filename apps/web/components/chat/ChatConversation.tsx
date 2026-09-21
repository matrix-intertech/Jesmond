"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearAuth, getAccessToken } from "@/utils/auth";

type ChatConversationProps = {
  conversationId: string;
  backHref: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ChatConversation({ conversationId, backHref }: ChatConversationProps) {
  const router = useRouter();
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setCurrentUserId(payload.sub);
      } catch {}
    }
  }, []);

  const markRead = async (token: string) => {
    await fetch(`${apiBase}/api/v1/chat/conversations/${conversationId}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  const fetchConversation = async () => {
    const token = getAccessToken();
    if (!token) return router.push("/login");

    try {
      const res = await fetch(`${apiBase}/api/v1/chat/conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setConversation(await res.json());
        setError("");
        void markRead(token);
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
    void fetchConversation();
    const interval = setInterval(fetchConversation, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = newMessage.trim();
    if (!messageText) return;

    setSending(true);
    setSendError("");
    const token = getAccessToken();
    if (!token) {
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
        await fetchConversation();
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

  if (loading) return <div className="p-8 text-center text-slate-500">Loading conversation...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center gap-4 mb-6 border-b border-slate-200 pb-4 shrink-0">
        <Link href={backHref} className="text-slate-500 hover:text-brand-orange">&larr;</Link>
        <div>
          <h1 className="text-xl font-bold text-brand-navy">{conversation?.property?.name || "Conversation"}</h1>
          <p className="text-xs text-slate-500 font-medium">Private conversation</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-6 pr-2">
            {conversation?.messages?.length === 0 ? (
              <div className="text-center text-slate-400 mt-10">No messages yet. Say hello!</div>
            ) : (
              conversation?.messages?.map((msg: any) => {
                const isMe = msg.senderId === currentUserId;

                return (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? "self-end" : "self-start"}`}>
                    <div className={`p-3 rounded-2xl ${isMe ? "bg-brand-navy text-white rounded-br-none" : "bg-slate-100 text-brand-navy rounded-bl-none"}`}>
                      {msg.encryptedPayload}
                    </div>
                    <div className={`text-[10px] text-slate-400 mt-1 ${isMe ? "self-end" : "self-start"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {sendError && <div className="mb-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{sendError}</div>}

          <form onSubmit={handleSendMessage} className="flex gap-2 shrink-0">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-full border-slate-300 focus:border-brand-navy focus:ring-brand-navy px-4"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-brand-orange text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              &rarr;
            </button>
          </form>
        </>
      )}
    </div>
  );
}
