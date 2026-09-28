"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/v1/notifications?limit=5');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
      }
      const countRes = await fetch('/api/v1/notifications/unread-count');
      if (countRes.ok) {
        const countData = await countRes.json();
        setUnreadCount(countData.count || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
        aria-label="Notifications"
      >
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-orange/100 rounded-full ring-2 ring-white"></span>
        )}
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden z-50">
          <div className="p-4 border-b border-slate-100 font-semibold text-slate-800">
            Notifications ({unreadCount})
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-500">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} onClick={() => markAsRead(n.id)} className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 ${n.isRead ? 'opacity-70' : 'bg-blue-50/20'}`}>
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{n.body}</p>
                  {n.actionUrl && (
                    <Link href={n.actionUrl} className="text-xs text-brand-orange mt-2 inline-block">
                      View
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
