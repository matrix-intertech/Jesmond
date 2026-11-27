"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiUrl } from "@/utils/api";

export function FooterPricingLink() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${getApiUrl()}/api/v1/subscriptions/public/config`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.subscriptionsEnabled === true) {
          setVisible(true);
        }
      })
      .catch(() => {
        // Keep hidden when config cannot be verified
      });
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <li>
      <Link href="/pricing" className="hover:text-primary transition-colors">
        Pricing
      </Link>
    </li>
  );
}
