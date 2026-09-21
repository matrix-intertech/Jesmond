"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAccessToken } from "@/utils/auth";
import { handleApiError } from "@/utils/api";

export default function ProfileCompletionBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [profileCompletion, setProfileCompletion] = useState<{ isComplete: boolean; missingFields: string[] } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    if (sessionStorage.getItem("profileCompletionDismissed")) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    const fetchCompletionStatus = async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await handleApiError(res, () => {});
        if (status === 'ok') {
          const json = await res.json();
          setProfileCompletion(json.profileCompletion);
        }
      } catch (e: any) {
        console.error("Failed to fetch profile completion status", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompletionStatus();
  }, []);

  // Do not block chat reading/replying with profile completion.
  const isProfilePage = pathname === '/settings/profile' || pathname === '/portal/settings/profile';
  const isChatPage = pathname === '/messages' || pathname.startsWith('/messages/') || pathname === '/portal/chats' || pathname.startsWith('/portal/chats/');

  if (loading || dismissed || isProfilePage || isChatPage || !profileCompletion || profileCompletion.isComplete) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem("profileCompletionDismissed", "true");
    setDismissed(true);
  };

  const handleComplete = () => {
    handleDismiss();
    if (window.location.pathname.startsWith('/student')) {
      router.push('/settings/profile');
    } else {
      router.push('/portal/settings/profile');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-xl font-bold text-brand-navy">Complete your profile</h2>
        </div>
        <p className="mb-6 text-gray-700">
          We've added a few new profile details. Please complete your profile to keep your account information up to date.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition font-medium"
          >
            Maybe Later
          </button>
          <button
            onClick={handleComplete}
            className="px-4 py-2 bg-brand-orange text-white rounded-md hover:bg-orange-600 transition font-medium"
          >
            Complete Profile
          </button>
        </div>
      </div>
    </div>
  );
}
