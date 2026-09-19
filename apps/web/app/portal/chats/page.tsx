"use client";

import { useEffect, useState } from "react";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";

export default function HostChatsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data);

          try {
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            setUserId(tokenPayload.sub);
          } catch(e) {}
        } else if (res.status === 401) {
          clearAuth();
          router.push("/login");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [router]);

  return (
    <div className="max-w-6xl mx-auto py-8">
      <PageHeader title="Chats" description="Communicate directly with interested seekers" />

      <div className="bg-brand-navy/5 border border-brand-navy/10 rounded-xl p-4 mb-8 text-sm text-brand-navy">
        <strong>Security Notice:</strong> All messages sent on this platform are End-to-End Encrypted (E2EE).
      </div>

      {loading ? (
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-16 bg-slate-100 rounded-xl"></div>
          <div className="h-16 bg-slate-100 rounded-xl"></div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-200">
          No enquiries or chats yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {conversations.map(conv => {
            const myParticipant = conv.participants?.find((p: any) => p.userId === userId);
            const otherParticipant = conv.participants?.find((p: any) => p.userId !== userId);
            const isUnread = myParticipant && conv.updatedAt && (!myParticipant.lastReadAt || new Date(myParticipant.lastReadAt) < new Date(conv.updatedAt));

            return (
              <div
                key={conv.id}
                className={`p-6 bg-white border ${isUnread ? 'border-brand-orange shadow-md ring-1 ring-brand-orange' : 'border-slate-200 hover:shadow-md'} rounded-2xl transition-all cursor-pointer relative`}
                onClick={() => router.push(`/messages/${conv.id}`)}
              >
                {isUnread && (
                  <div className="absolute top-4 right-4 bg-brand-orange text-white text-[10px] font-bold px-2 py-1 rounded-full">NEW</div>
                )}

                <h3 className="font-bold text-brand-navy truncate pr-12">{conv.property?.name || 'Unknown Property'}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Seeker: <span className="font-medium text-slate-700">{otherParticipant?.user?.firstName || 'Unknown'} {otherParticipant?.user?.lastName || ''}</span>
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <p className="text-sm text-slate-400 italic">
                    {conv.messages && conv.messages.length > 0 ? 'Encrypted Message' : 'No messages'}
                  </p>
                  <div className="text-xs font-medium text-slate-400">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
