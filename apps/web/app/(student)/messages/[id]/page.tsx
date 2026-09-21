"use client";

import { use } from "react";
import ChatConversation from "@/components/chat/ChatConversation";

export default function ChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return <ChatConversation conversationId={id} backHref="/messages" />;
}
