import SettingsLayout from "@/components/layout/SettingsLayout";
import { Shield, Building, Users } from "lucide-react";
import RetailGuard from "@/components/retail/RetailGuard";

const links = [
  { label: "Delivery & Takeaway", href: "/portal/retail/settings", icon: <Building className="w-5 h-5" /> },
  { label: "Employee Permissions", href: "/portal/retail/settings/permissions", icon: <Shield className="w-5 h-5" /> },
];

export default function RetailSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RetailGuard requirePermissions={['RETAIL_SETTINGS_VIEW']}>
      <SettingsLayout title="Retail Settings" description="Manage your retail operations and employee permissions." links={links}>
        {children}
      </SettingsLayout>
    </RetailGuard>
  );
}
