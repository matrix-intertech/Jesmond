"use client";

import { use } from "react";
import StudentMessagesWorkspace from "@/components/chat/StudentMessagesWorkspace";

export default function ChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return <StudentMessagesWorkspace selectedConversationId={id} />;
}
