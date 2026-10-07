"use client";

import RetailGuard from "@/components/retail/RetailGuard";
import { AlertCircle, Calendar, Zap, CreditCard } from "lucide-react";

export default function PaymentSettingsPage() {
  return (
    <RetailGuard requirePermissions={['RETAIL_SETTINGS_MANAGE']}>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium text-text-primary">Billing / Monetization</h2>
          <p className="text-sm text-text-secondary">
            View future subscription and monetization capabilities.
          </p>
        </div>

        <div className="p-4 bg-brand-navy/5 text-brand-navy rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            Status: <span className="font-bold text-brand-orange ml-1">NOT ACTIVE</span><br/>
            Payments and subscriptions are currently disabled and will be rolled out in a future update.
          </p>
        </div>

        <div className="bg-surface border border-border/40 rounded-xl p-6 space-y-6">
          <div className="flex items-start justify-between pb-6 border-b border-border/40">
            <div className="space-y-1">
              <h3 className="font-medium text-text-primary flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Subscriptions
              </h3>
              <p className="text-sm text-text-secondary">
                Premium plans and provider subscriptions.
              </p>
            </div>
            <span className="text-xs font-bold text-text-muted bg-surface-muted px-2 py-1 rounded-md uppercase tracking-wider">Coming Soon</span>
          </div>

          <div className="flex items-start justify-between pb-6 border-b border-border/40">
            <div className="space-y-1">
              <h3 className="font-medium text-text-primary flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Paid Promotions
              </h3>
              <p className="text-sm text-text-secondary">
                Promote properties or boost marketplace visibility.
              </p>
            </div>
            <span className="text-xs font-bold text-text-muted bg-surface-muted px-2 py-1 rounded-md uppercase tracking-wider">Coming Soon</span>
          </div>

          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-medium text-text-primary flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Stripe Gateway
              </h3>
              <p className="text-sm text-text-secondary">
                Secure payment processing.
              </p>
            </div>
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md">Not Configured</span>
          </div>
        </div>
      </div>
    </RetailGuard>
  );
}
