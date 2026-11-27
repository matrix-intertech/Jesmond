"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationPolling, NotificationItem } from '@/hooks/useNotificationPolling';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { CheckCheck, Bell, ExternalLink } from 'lucide-react';

interface NotificationDropdownProps {
  organizationId?: string | null;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function NotificationDropdown({ organizationId }: NotificationDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotificationPolling({ organizationId, limit: 10 });

  const { isSupported, permission, subscribe } = usePushSubscription();

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      await markAsRead(n.id);
    }
    if (n.actionUrl) {
      setOpen(false);
      router.push(n.actionUrl);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-11 w-11 items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface-muted rounded-full transition focus:outline-none focus:ring-2 focus:ring-primary/20"
        aria-label="Notifications"
        data-testid="notification-bell-button"
      >
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-accent text-white text-[10px] font-bold rounded-full ring-2 ring-white flex items-center justify-center leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <Bell className="w-5 h-5" />
      </button>

      {open && (
        <div
          data-testid="notification-dropdown-panel"
          className="fixed inset-x-3 top-[68px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 bg-surface border border-border-strong shadow-xl rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border-subtle flex justify-between items-center bg-surface-muted/50">
            <span className="font-semibold text-sm text-text-primary flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="text-xs font-normal text-text-muted">({unreadCount} unread)</span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1 transition"
                data-testid="mark-all-read-button"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* Web Push Prompt if default */}
          {isSupported && permission === 'default' && (
            <div className="p-3 bg-info-bg/50 border-b border-border-subtle flex flex-col gap-2">
              <p className="text-xs text-brand-indigo">Enable browser notifications to stay updated immediately.</p>
              <button
                onClick={() => {
                  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                  if (vapidKey) subscribe(vapidKey);
                }}
                className="text-xs font-semibold bg-primary text-white py-1 px-3 rounded w-max hover:bg-brand-purple transition"
              >
                Enable
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-border-subtle">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 cursor-pointer transition hover:bg-surface-lavender/60 flex items-start gap-3 ${
                    n.isRead ? 'opacity-75 bg-transparent' : 'bg-primary/5'
                  }`}
                  data-testid={`notification-item-${n.id}`}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      n.isRead ? 'bg-transparent' : 'bg-accent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium truncate ${n.isRead ? 'text-text-secondary' : 'text-text-primary'}`}>
                        {n.title}
                      </p>
                      <span className="text-[11px] text-text-muted shrink-0">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                    {n.actionUrl && (
                      <span className="text-[11px] text-primary hover:underline mt-1.5 inline-flex items-center gap-1">
                        View details <ExternalLink size={10} />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
