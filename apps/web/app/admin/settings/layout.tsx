import SettingsLayout from "@/components/layout/SettingsLayout";
import { User, ShieldCheck, Database, List, Lock } from "lucide-react";

const links = [
  { label: "Profile", href: "/admin/settings/profile", icon: <User className="w-5 h-5" /> },
  { label: "Platform", href: "/admin/settings/platform", icon: <Database className="w-5 h-5" /> },
  { label: "Security", href: "/admin/settings/security", icon: <Lock className="w-5 h-5" /> },
  { label: "Features", href: "/admin/settings/features", icon: <ShieldCheck className="w-5 h-5" /> },
  { label: "Audit Logs", href: "/admin/settings/audit-logs", icon: <List className="w-5 h-5" /> },
];

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsLayout title="Admin Settings" description="Manage platform configuration and features." links={links}>
      {children}
    </SettingsLayout>
  );
}
