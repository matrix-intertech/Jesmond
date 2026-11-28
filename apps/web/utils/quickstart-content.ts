import { DashboardId, DashboardQuickstartConfig } from './quickstart';

const APPOINTMENT_STEPS = [
  {
    id: 'header-overview',
    title: 'Welcome to Your Business Dashboard',
    description:
      'Your central workspace for managing incoming customer bookings, staff assignments, and daily service operations.',
    targetSelector: '[data-testid="dashboard-header-title"]',
    placement: 'bottom' as const,
  },
  {
    id: 'nav-appointments',
    title: 'Appointments & Bookings',
    description:
      'Review pending requests, confirm or decline bookings, and filter your full appointment schedule.',
    targetSelector: 'nav a[href="/portal/business/appointments?tab=list"]',
    placement: 'right' as const,
    requiredCapabilities: ['APPOINTMENTS' as const],
  },
  {
    id: 'nav-services',
    title: 'Service Catalog & Pricing',
    description:
      'Create and update service offerings, durations, and pricing shown to Jesmond customers.',
    targetSelector: 'nav a[href="/portal/business/services"]',
    placement: 'right' as const,
    requiredCapabilities: ['APPOINTMENT_SERVICES' as const],
  },
  {
    id: 'nav-staff',
    title: 'Staff & Availability',
    description:
      'Manage team members, working hours, and time-off schedules so customers only book available slots.',
    targetSelector: 'nav a[href="/portal/business/staff"]',
    placement: 'right' as const,
    requiredCapabilities: ['APPOINTMENT_STAFF' as const],
  },
  {
    id: 'nav-verification',
    title: 'Business Verification & Licences',
    description:
      'Submit ABN and trade/workshop credentials to earn the Verified Partner badge on Jesmond.',
    targetSelector: 'nav a[href="/portal/business/verification"]',
    placement: 'right' as const,
  },
  {
    id: 'quickstart-reopen',
    title: 'Reopen Quickstart Anytime',
    description:
      'Click the Quickstart Guide icon in the header whenever you want to read the full guide or restart this tutorial.',
    targetSelector: '[data-testid="quickstart-header-btn"]',
    placement: 'bottom' as const,
  },
];

export const QUICKSTART_CONFIGS: Record<DashboardId, DashboardQuickstartConfig> = {
  STUDENT: {
    dashboardId: 'STUDENT',
    title: 'Customer Dashboard Quickstart',
    subtitle: 'Search accommodation, track applications, save listings, and message providers.',
    tutorialVersion: 1,
    targetRoles: ['STUDENT'],
    sections: [
      {
        id: 'intro',
        title: 'Dashboard Overview',
        summary: 'Track your active accommodation applications, saved properties, and messages from one place.',
        bullets: [
          'View application status updates and complete checkout when payments are enabled.',
          'Monitor unread messages from property managers and local providers.',
        ],
      },
      {
        id: 'navigation',
        title: 'Key Navigation',
        summary: 'Use the left sidebar to switch between discovery, saved listings, and support.',
        bullets: [
          'Search Accommodation: Filter verified listings by city, university, and budget.',
          'Saved: Revisit bookmarked properties and compare room options.',
          'Messages & My Applications: Follow up directly with providers.',
        ],
      },
      {
        id: 'settings',
        title: 'Account & Security Settings',
        summary: 'Keep your profile, saved addresses, and two-factor authentication up to date.',
        bullets: [
          'Update contact details, notification preferences, and 2FA under Settings.',
        ],
      },
    ],
    steps: [
      {
        id: 'student-welcome',
        title: 'Welcome to Your Customer Dashboard',
        description:
          'View your accommodation applications, booking statuses, and key updates right from this workspace.',
        targetSelector: '[data-testid="dashboard-header-title"]',
        placement: 'bottom',
      },
      {
        id: 'student-search',
        title: 'Search Accommodation',
        description:
          'Browse accommodation near your university with filters for location, room type, and weekly rent.',
        targetSelector: 'nav a[href="/search"]',
        placement: 'right',
      },
      {
        id: 'student-saved',
        title: 'Saved Properties',
        description:
          'Access your bookmarked listings anytime to compare rooms before submitting an application.',
        targetSelector: 'nav a[href="/student/saved"]',
        placement: 'right',
      },
      {
        id: 'student-messages',
        title: 'Direct Messaging',
        description:
          'Chat securely with accommodation providers and businesses about your enquiries or bookings.',
        targetSelector: 'nav a[href="/messages"]',
        placement: 'right',
      },
      {
        id: 'student-settings',
        title: 'Profile & Security',
        description:
          'Manage your personal details, saved addresses, notifications, and 2FA security settings.',
        targetSelector: 'nav a[href="/settings/profile"]',
        placement: 'right',
      },
      {
        id: 'student-help',
        title: 'Quickstart Guide Always Available',
        description:
          'Click this icon anytime to review the Customer Quickstart Guide or restart this walkthrough.',
        targetSelector: '[data-testid="quickstart-header-btn"]',
        placement: 'bottom',
      },
    ],
  },

  ADMIN: {
    dashboardId: 'ADMIN',
    title: 'Admin Dashboard Quickstart',
    subtitle: 'Oversee properties, users, applications, and business credential verification.',
    tutorialVersion: 1,
    targetRoles: ['ADMIN'],
    sections: [
      {
        id: 'intro',
        title: 'Platform Moderation Overview',
        summary: 'Review pending property submissions, verify partner credentials, and manage platform users.',
        bullets: [
          'Pending Property Approvals appear directly on the Admin Dashboard overview.',
          'Use Business Credentials and ABN Exemptions to review compliance documents.',
        ],
      },
      {
        id: 'navigation',
        title: 'Core Admin Sections',
        summary: 'Navigate moderation queues and platform governance tools from the sidebar.',
        bullets: [
          'Properties & Applications: Approve listings and inspect tenant application flows.',
          'Users: Search accounts, verify roles, and manage account statuses.',
          'Business Credentials & ABN Exemptions: Review licences and exemption requests.',
        ],
      },
      {
        id: 'settings',
        title: 'Admin Settings & Audit Logs',
        summary: 'Configure platform settings and inspect administrative audit trails.',
        bullets: [
          'Review security and audit logs under Settings.',
        ],
      },
    ],
    steps: [
      {
        id: 'admin-welcome',
        title: 'Welcome to the Admin Dashboard',
        description:
          'Monitor pending property approvals and oversee marketplace operations across Jesmond.',
        targetSelector: '[data-testid="dashboard-header-title"]',
        placement: 'bottom',
      },
      {
        id: 'admin-properties',
        title: 'Property Moderation',
        description:
          'Inspect submitted accommodation listings, verify details, and approve or reject properties.',
        targetSelector: 'nav a[href="/admin/properties"]',
        placement: 'right',
      },
      {
        id: 'admin-users',
        title: 'User Management',
        description:
          'Look up customer, business, and staff accounts and manage account status or roles.',
        targetSelector: 'nav a[href="/admin/users"]',
        placement: 'right',
      },
      {
        id: 'admin-credentials',
        title: 'Business Credentials Queue',
        description:
          'Verify uploaded business licences, ABNs, and compliance documents submitted by partners.',
        targetSelector: 'nav a[href="/admin/credentials"]',
        placement: 'right',
      },
      {
        id: 'admin-settings',
        title: 'Platform Settings',
        description:
          'Access platform configuration, audit logs, and your admin profile security settings.',
        targetSelector: 'nav a[href="/admin/settings"]',
        placement: 'right',
      },
      {
        id: 'admin-help',
        title: 'Quickstart Guide',
        description:
          'Open the Quickstart Guide anytime from the header to review admin workflows or restart this tour.',
        targetSelector: '[data-testid="quickstart-header-btn"]',
        placement: 'bottom',
      },
    ],
  },

  SUPER_ADMIN: {
    dashboardId: 'SUPER_ADMIN',
    title: 'Super Admin Dashboard Quickstart',
    subtitle: 'Full platform governance, feature flags, credential compliance, and audit controls.',
    tutorialVersion: 1,
    targetRoles: ['SUPER_ADMIN'],
    sections: [
      {
        id: 'intro',
        title: 'Super Admin Control Center',
        summary: 'Manage all marketplace moderation queues plus global feature flags such as Payments & Booking.',
        bullets: [
          'Toggle platform-wide feature flags directly from the dashboard and Settings > Features.',
          'Review pending properties, credentials, ABN exemptions, and business name change requests.',
        ],
      },
      {
        id: 'navigation',
        title: 'Governance & Compliance',
        summary: 'Full access to users, properties, applications, credentials, and audit logs.',
        bullets: [
          'Properties, Users & Applications: Full marketplace oversight.',
          'Business Credentials & ABN Exemptions: Final compliance decisions.',
          'Settings: Platform configuration, Feature Flags, and Audit Logs.',
        ],
      },
    ],
    steps: [
      {
        id: 'sa-welcome',
        title: 'Welcome, Super Admin',
        description:
          'This workspace provides full platform governance, pending property approvals, and feature flag controls.',
        targetSelector: '[data-testid="dashboard-header-title"]',
        placement: 'bottom',
      },
      {
        id: 'sa-properties',
        title: 'Property & Listing Approvals',
        description:
          'Review and moderate all accommodation properties across Jesmond.',
        targetSelector: 'nav a[href="/admin/properties"]',
        placement: 'right',
      },
      {
        id: 'sa-credentials',
        title: 'Credentials & Compliance',
        description:
          'Audit partner licences, ABN verification, and exemption requests.',
        targetSelector: 'nav a[href="/admin/credentials"]',
        placement: 'right',
      },
      {
        id: 'sa-settings',
        title: 'Platform, Features & Audit Logs',
        description:
          'Manage global feature flags, security policies, and system audit logs.',
        targetSelector: 'nav a[href="/admin/settings"]',
        placement: 'right',
      },
      {
        id: 'sa-help',
        title: 'Quickstart Guide',
        description:
          'Click here anytime to reopen the Super Admin Quickstart Guide or restart the walkthrough.',
        targetSelector: '[data-testid="quickstart-header-btn"]',
        placement: 'bottom',
      },
    ],
  },

  ACCOMMODATION: {
    dashboardId: 'ACCOMMODATION',
    title: 'Accommodation Partner Quickstart',
    subtitle: 'Manage properties, room listings, customer applications, enquiries, and agency teams.',
    tutorialVersion: 1,
    targetRoles: ['ORG_STAFF'],
    sections: [
      {
        id: 'intro',
        title: 'Partner Overview',
        summary: 'Monitor your property portfolio, draft listings, and incoming customer accommodation applications.',
        bullets: [
          'Track published vs draft properties and pending customer applications at a glance.',
          'Complete Business Verification to display the Verified Partner badge.',
        ],
      },
      {
        id: 'workflows',
        title: 'Listings, Applications & Chats',
        summary: 'Keep room availability accurate and respond quickly to prospective customers.',
        bullets: [
          'My Properties: Create listings, configure room hierarchies, house rules, and residents.',
          'Applications & Enquiries: Review customer submissions and convert leads.',
          'Chats & Agency: Communicate with applicants and manage agency team members.',
        ],
      },
    ],
    steps: [
      {
        id: 'acc-welcome',
        title: 'Accommodation Partner Dashboard',
        description:
          'Monitor your properties, active listings, and incoming customer applications from this overview.',
        targetSelector: '[data-testid="dashboard-header-title"]',
        placement: 'bottom',
      },
      {
        id: 'acc-properties',
        title: 'Manage Properties & Rooms',
        description:
          'Add properties, configure room types, set house rules, and manage current residents.',
        targetSelector: 'nav a[href="/portal/properties"]',
        placement: 'right',
      },
      {
        id: 'acc-applications',
        title: 'Customer Applications',
        description:
          'Review incoming accommodation applications, verify applicant details, and update booking statuses.',
        targetSelector: 'nav a[href="/portal/applications"]',
        placement: 'right',
      },
      {
        id: 'acc-chats',
        title: 'Applicant Chats & Enquiries',
        description:
          'Respond to customer messages and enquiries directly inside your partner portal.',
        targetSelector: 'nav a[href="/portal/chats"]',
        placement: 'right',
      },
      {
        id: 'acc-verification',
        title: 'Verification & Licences',
        description:
          'Upload your business credentials to verify your organisation and build customer trust.',
        targetSelector: 'nav a[href="/portal/business/verification"]',
        placement: 'right',
      },
      {
        id: 'acc-help',
        title: 'Quickstart Guide',
        description:
          'Reopen this guide or restart the tutorial anytime from the header help icon.',
        targetSelector: '[data-testid="quickstart-header-btn"]',
        placement: 'bottom',
      },
    ],
  },

  RETAIL: {
    dashboardId: 'RETAIL',
    title: 'Retail & POS Dashboard Quickstart',
    subtitle: 'Manage branches, catalog, inventory, orders, customers, and Point of Sale.',
    tutorialVersion: 1,
    targetRoles: ['ORG_STAFF'],
    sections: [
      {
        id: 'intro',
        title: 'Retail Overview',
        summary: 'Track daily revenue, active POS terminals, low-stock alerts, and recent customer orders.',
        bullets: [
          'Monitor real-time store metrics across your branches.',
          'Permissions control which staff members see POS, Inventory, Employees, or Settings.',
        ],
      },
      {
        id: 'operations',
        title: 'Catalog, Inventory & POS',
        summary: 'Keep stock synced between your storefront and in-store POS registers.',
        bullets: [
          'Business Catalog & Inventory: Manage SKUs, pricing, barcodes, and branch stock levels.',
          'POS & Terminals: Process in-person sales and manage register terminals.',
          'Orders & Sales History: Fulfill online pickup/delivery orders and audit sales.',
        ],
      },
    ],
    steps: [
      {
        id: 'retail-welcome',
        title: 'Welcome to Retail Overview',
        description:
          'Track today’s revenue, active terminals, customer count, and low-stock alerts at a glance.',
        targetSelector: '[data-testid="dashboard-header-title"]',
        placement: 'bottom',
      },
      {
        id: 'retail-catalog',
        title: 'Product Catalog',
        description:
          'Add and organize products, prices, and barcodes for your online store and POS.',
        targetSelector: 'nav a[href="/portal/retail/catalog"]',
        placement: 'right',
        requiredPermissions: ['CATALOG_VIEW', 'CATALOG_MANAGE'],
      },
      {
        id: 'retail-inventory',
        title: 'Branch Inventory',
        description:
          'Monitor stock quantities per branch and restock items before they run low.',
        targetSelector: 'nav a[href="/portal/retail/inventory"]',
        placement: 'right',
        requiredPermissions: ['INVENTORY_VIEW', 'INVENTORY_MANAGE'],
      },
      {
        id: 'retail-orders',
        title: 'Customer Orders',
        description:
          'Track and fulfill incoming customer orders across your branches.',
        targetSelector: 'nav a[href="/portal/retail/orders"]',
        placement: 'right',
        requiredPermissions: ['ORDERS_VIEW', 'ORDERS_MANAGE'],
      },
      {
        id: 'retail-pos',
        title: 'Point of Sale (POS)',
        description:
          'Launch the in-store POS register to scan barcodes and complete walk-in sales.',
        targetSelector: 'nav a[href="/portal/retail/pos"]',
        placement: 'right',
        requiredPermissions: ['POS_ACCESS'],
      },
      {
        id: 'retail-settings',
        title: 'Retail Settings & Permissions',
        description:
          'Configure payment preferences, branch settings, and staff role permissions.',
        targetSelector: 'nav a[href="/portal/retail/settings"]',
        placement: 'right',
        requiredPermissions: ['RETAIL_SETTINGS_VIEW'],
      },
      {
        id: 'retail-help',
        title: 'Quickstart Guide',
        description:
          'Click the Quickstart Guide icon anytime to revisit store setup steps or restart this tour.',
        targetSelector: '[data-testid="quickstart-header-btn"]',
        placement: 'bottom',
      },
    ],
  },

  FOOD: {
    dashboardId: 'FOOD',
    title: 'Food & Hospitality Quickstart',
    subtitle: 'Manage live kitchen orders, order statuses, and your digital menu.',
    tutorialVersion: 1,
    targetRoles: ['ORG_STAFF'],
    sections: [
      {
        id: 'intro',
        title: 'Live Order Board',
        summary: 'Incoming food orders refresh automatically so your kitchen can accept, prepare, and complete them.',
        bullets: [
          'Filter orders by Pending, Accepted, Preparing, Ready, Completed, or Cancelled.',
          'Click into any order to update preparation status for pickup or delivery.',
        ],
      },
      {
        id: 'menu',
        title: 'Menu & Verification',
        summary: 'Keep menu items, pricing, and food safety credentials current.',
        bullets: [
          'Menu Management: Add dishes, categories, modifiers, and availability.',
          'Verification & Licences: Upload food business registration and ABN details.',
        ],
      },
    ],
    steps: [
      {
        id: 'food-welcome',
        title: 'Welcome to Food Orders',
        description:
          'Monitor live customer orders grouped by status—new orders refresh automatically every 15 seconds.',
        targetSelector: '[data-testid="dashboard-header-title"]',
        placement: 'bottom',
      },
      {
        id: 'food-orders',
        title: 'Food Orders Queue',
        description:
          'Accept incoming orders, move them through Preparing and Ready, and mark them Completed.',
        targetSelector: 'nav a[href="/portal/business/orders"]',
        placement: 'right',
        requiredCapabilities: ['ORDERS'],
      },
      {
        id: 'food-menu',
        title: 'Menu Management',
        description:
          'Update your dishes, prices, dietary tags, and item availability for customers.',
        targetSelector: 'nav a[href="/portal/business/menu"]',
        placement: 'right',
        requiredCapabilities: ['MENU'],
      },
      {
        id: 'food-verification',
        title: 'Verification & Licences',
        description:
          'Submit your food business registration and ABN to earn the Verified Partner badge.',
        targetSelector: 'nav a[href="/portal/business/verification"]',
        placement: 'right',
      },
      {
        id: 'food-help',
        title: 'Quickstart Guide',
        description:
          'Open the Quickstart Guide anytime from the header to review workflows or restart this tutorial.',
        targetSelector: '[data-testid="quickstart-header-btn"]',
        placement: 'bottom',
      },
    ],
  },

  MECHANICS: {
    dashboardId: 'MECHANICS',
    title: 'Mechanics & Automotive Quickstart',
    subtitle: 'Manage workshop bookings, automotive services, mechanics, and customer history.',
    tutorialVersion: 1,
    targetRoles: ['ORG_STAFF'],
    sections: [
      {
        id: 'intro',
        title: 'Workshop Overview',
        summary: 'Manage vehicle servicing bookings, assign mechanics, and track daily bay capacity.',
        bullets: [
          'Switch between Overview, List, Pending, and Day/Week Calendar views.',
          'Assign eligible mechanics to confirmed workshop appointments.',
        ],
      },
      {
        id: 'catalog',
        title: 'Services, Staff & Licences',
        summary: 'Configure workshop services, staff availability, and motor vehicle repairer licences.',
        bullets: [
          'Services: Define servicing packages, inspection durations, and pricing.',
          'Verification & Licences: Upload your MVRL / workshop credentials.',
        ],
      },
    ],
    steps: APPOINTMENT_STEPS,
  },

  SERVICES: {
    dashboardId: 'SERVICES',
    title: 'Services & Trades Quickstart',
    subtitle: 'Manage client appointments, service listings, staff schedules, and customer history.',
    tutorialVersion: 1,
    targetRoles: ['ORG_STAFF'],
    sections: [
      {
        id: 'intro',
        title: 'Appointments Overview',
        summary: 'Track incoming service requests, assign team members, and manage your calendar.',
        bullets: [
          'Review pending bookings and view Day/Week schedules in the Calendar tab.',
          'Access customer booking history under Customers.',
        ],
      },
      {
        id: 'catalog',
        title: 'Services, Staff & Verification',
        summary: 'Keep your service catalog, team availability, and trade licences current.',
        bullets: [
          'Services & Staff: Configure offerings, durations, and working hours.',
          'Verification & Licences: Upload trade licences and ABN documentation.',
        ],
      },
    ],
    steps: APPOINTMENT_STEPS,
  },

  RENTALS: {
    dashboardId: 'RENTALS',
    title: 'Rentals & Vehicle Hire Quickstart',
    subtitle: 'Manage rental bookings, fleet services, staff availability, and verification.',
    tutorialVersion: 1,
    targetRoles: ['ORG_STAFF'],
    sections: [
      {
        id: 'intro',
        title: 'Rentals Overview',
        summary: 'Manage vehicle hire bookings, pickup schedules, and customer requests.',
        bullets: [
          'Track pending rental bookings and manage your Day/Week schedule.',
          'Keep fleet service listings and pricing up to date.',
        ],
      },
      {
        id: 'catalog',
        title: 'Fleet Services & Verification',
        summary: 'Configure hire packages, staff availability, and business licences.',
        bullets: [
          'Services & Availability: Set hire options and operating hours.',
          'Verification & Licences: Complete ABN and rental compliance checks.',
        ],
      },
    ],
    steps: APPOINTMENT_STEPS,
  },

  SETTINGS: {
    dashboardId: 'SETTINGS',
    title: 'Account Settings Quickstart',
    subtitle: 'Manage your profile, saved addresses, 2FA security, notifications, and privacy.',
    tutorialVersion: 1,
    targetRoles: ['STUDENT', 'ORG_STAFF', 'ADMIN', 'SUPER_ADMIN'],
    sections: [
      {
        id: 'intro',
        title: 'Account Preferences',
        summary: 'Update your personal profile, security controls, and notification channels.',
        bullets: [
          'Profile & Saved Addresses: Keep contact details and delivery addresses accurate.',
          'Security: Enable Two-Factor Authentication (2FA) and manage active sessions.',
          'Notifications & Privacy: Control email/SMS/WhatsApp alerts and data export.',
        ],
      },
    ],
    steps: [
      {
        id: 'settings-welcome',
        title: 'Account Settings',
        description:
          'Manage your personal profile, security, notifications, and privacy preferences here.',
        targetSelector: '[data-testid="dashboard-header-title"]',
        placement: 'bottom',
      },
      {
        id: 'settings-help',
        title: 'Quickstart Guide',
        description:
          'Click this icon anytime to reopen the Quickstart Guide or restart this walkthrough.',
        targetSelector: '[data-testid="quickstart-header-btn"]',
        placement: 'bottom',
      },
    ],
  },
};
