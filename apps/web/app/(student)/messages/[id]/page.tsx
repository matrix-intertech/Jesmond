"use client";

import { useEffect, useState, use } from "react";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Stub E2EE functions
const encryptMessage = (plaintext: string) => {
  // In a real E2EE system, this would use SubtleCrypto with the recipient's public key
  // For the stub, we just base64 encode it and prepend a fake IV
  return {
    iv: "stub-iv-123",
    encryptedPayload: btoa(plaintext)
  };
};

const decryptMessage = (encryptedPayload: string, iv?: string) => {
  // In a real E2EE system, this would use SubtleCrypto with the user's private key
  try {
    return atob(encryptedPayload);
  } catch {
    return "[Encrypted Message]";
  }
};

export default function ChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    // Very basic decode to get user id for UI differentiation
    const token = getAccessToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.sub);
      } catch {}
    }
  }, []);

  const fetchConversation = async () => {
    const token = getAccessToken();
    if (!token) return router.push("/login");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/chat/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setConversation(await res.json());
      } else {
        router.push("/messages");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversation();
    // Simple polling for new messages could go here
    const interval = setInterval(fetchConversation, 5000);
    return () => clearInterval(interval);
  }, [id, router]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    const token = getAccessToken();
    const { encryptedPayload, iv } = encryptMessage(newMessage);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/chat/conversations/${id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ encryptedPayload, iv })
      });
      if (res.ok) {
        setNewMessage("");
        fetchConversation();
      }
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading secure chat...</div>;
  if (!conversation) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center gap-4 mb-6 border-b border-slate-200 pb-4 shrink-0">
        <Link href="/messages" className="text-slate-500 hover:text-brand-orange">&larr;</Link>
        <div>
          <h1 className="text-xl font-bold text-brand-navy">{conversation.property.name}</h1>
          <p className="text-xs text-green-600 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> End-to-End Encrypted
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-6 pr-2">
        {conversation.messages.length === 0 ? (
          <div className="text-center text-slate-400 mt-10">No messages yet. Say hello!</div>
        ) : (
          conversation.messages.map((msg: any) => {
            const isMe = msg.senderId === currentUserId;
            // Stub Decryption
            const decrypted = decryptMessage(msg.encryptedPayload, msg.iv);

            return (
              <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}>
                <div className={`p-3 rounded-2xl ${isMe ? 'bg-brand-navy text-white rounded-br-none' : 'bg-slate-100 text-brand-navy rounded-bl-none'}`}>
                  {decrypted}
                </div>
                <div className={`text-[10px] text-slate-400 mt-1 flex items-center gap-1 ${isMe ? 'self-end' : 'self-start'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  <span title="Server only sees ciphertext">🔒</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSendMessage} className="flex gap-2 shrink-0">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type an encrypted message..."
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
    </div>
  );
}
