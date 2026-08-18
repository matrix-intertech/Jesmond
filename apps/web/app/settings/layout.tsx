import SettingsLayout from "@/components/layout/SettingsLayout";
import { User, Shield, Bell, Lock } from "lucide-react";

const links = [
  { label: "Profile", href: "/settings/profile", icon: <User className="w-5 h-5" /> },
  { label: "Security", href: "/settings/security", icon: <Shield className="w-5 h-5" /> },
  { label: "Notifications", href: "/settings/notifications", icon: <Bell className="w-5 h-5" /> },
  { label: "Privacy & Data", href: "/settings/privacy", icon: <Lock className="w-5 h-5" /> },
];

export default function StudentSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsLayout title="Account Settings" description="Manage your personal preferences." links={links}>
      {children}
    </SettingsLayout>
  );
}
