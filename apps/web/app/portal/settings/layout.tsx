"use client";

import { useEffect, useState } from "react";
import SettingsLayout from "@/components/layout/SettingsLayout";
import { getCurrentUser } from "@/utils/auth";
import { User, Shield, Bell, Building, Settings2, MessageCircle, CreditCard } from "lucide-react";

const providerLinks = [
 { label: "Profile", href: "/portal/settings/profile", icon: <User className="w-5 h-5" /> },
 { label: "Security", href: "/portal/settings/security", icon: <Shield className="w-5 h-5" /> },
 { label: "Notifications", href: "/portal/settings/notifications", icon: <Bell className="w-5 h-5" /> },
 { label: "Business Profile", href: "/portal/settings/business", icon: <Building className="w-5 h-5" /> },
 { label: "Property Defaults", href: "/portal/settings/property-defaults", icon: <Settings2 className="w-5 h-5" /> },
 { label: "Enquiry Preferences", href: "/portal/settings/enquiries", icon: <MessageCircle className="w-5 h-5" /> },
 { label: "Subscription", href: "/portal/settings/subscription", icon: <CreditCard className="w-5 h-5" /> },
];

const businessLinks = [
 { label: "Profile", href: "/portal/settings/profile", icon: <User className="w-5 h-5" /> },
 { label: "Security", href: "/portal/settings/security", icon: <Shield className="w-5 h-5" /> },
 { label: "Notifications", href: "/portal/settings/notifications", icon: <Bell className="w-5 h-5" /> },
 { label: "Business Profile", href: "/portal/settings/business", icon: <Building className="w-5 h-5" /> },
 { label: "Subscription", href: "/portal/settings/subscription", icon: <CreditCard className="w-5 h-5" /> },
];

export default function PortalSettingsLayout({ children }: { children: React.ReactNode }) {
 const [isNonAccommodationBusiness, setIsNonAccommodationBusiness] = useState(false);

 useEffect(() => {
  const user = getCurrentUser();
  const cat = (user?.businessCategory || "").toUpperCase();
  const isProviderOrAgency = user?.orgType === "PROVIDER" || user?.orgType === "AGENCY";
  if (cat === "FOOD" || cat === "MECHANICS" || cat === "SERVICES" || (cat === "RENTALS" && !isProviderOrAgency)) {
   setIsNonAccommodationBusiness(true);
  }
 }, []);

 return (
 <SettingsLayout
  title={isNonAccommodationBusiness ? "Business Settings" : "Provider Settings"}
  description="Manage your organization and account preferences."
  links={isNonAccommodationBusiness ? businessLinks : providerLinks}
 >
 {children}
 </SettingsLayout>
 );
}
