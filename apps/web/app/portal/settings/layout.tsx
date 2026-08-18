import SettingsLayout from "@/components/layout/SettingsLayout";
import { User, Shield, Bell, Lock, Building, Settings2, MessageCircle } from "lucide-react";

const links = [
  { label: "Profile", href: "/portal/settings/profile", icon: <User className="w-5 h-5" /> },
  { label: "Security", href: "/portal/settings/security", icon: <Shield className="w-5 h-5" /> },
  { label: "Notifications", href: "/portal/settings/notifications", icon: <Bell className="w-5 h-5" /> },
  { label: "Business Profile", href: "/portal/settings/business", icon: <Building className="w-5 h-5" /> },
  { label: "Property Defaults", href: "/portal/settings/property-defaults", icon: <Settings2 className="w-5 h-5" /> },
  { label: "Enquiry Preferences", href: "/portal/settings/enquiries", icon: <MessageCircle className="w-5 h-5" /> },
];

export default function PortalSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsLayout title="Provider Settings" description="Manage your organization and account preferences." links={links}>
      {children}
    </SettingsLayout>
  );
}
