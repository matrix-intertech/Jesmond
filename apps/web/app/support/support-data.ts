export interface SupportCategory {
  slug: string;
  title: string;
  desc: string;
  icon: "home" | "user" | "briefcase" | "document" | "shield" | "credit-card";
  relatedLinks: Array<{ label: string; href: string }>;
}

export interface SupportArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  tags: string[];
  relatedHref?: string;
  relatedLabel?: string;
}

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    slug: "finding-accommodation",
    title: "Finding Accommodation",
    desc: "Tips for searching, viewing properties, and comparing options.",
    icon: "home",
    relatedLinks: [
      { label: "Accommodation Guide", href: "/guide" },
      { label: "Search Listings", href: "/search" },
    ],
  },
  {
    slug: "students",
    title: "Students",
    desc: "Account setup, applications, and moving in.",
    icon: "user",
    relatedLinks: [
      { label: "Moving to Australia", href: "/moving" },
      { label: "Cost of Living", href: "/cost" },
      { label: "Student Visa Guide", href: "/visa" },
      { label: "Safety Guide", href: "/safety" },
    ],
  },
  {
    slug: "providers",
    title: "Providers",
    desc: "Listing properties, managing rooms, and processing applications.",
    icon: "briefcase",
    relatedLinks: [
      { label: "Partner with Jesmond", href: "/providers" },
      { label: "Verification Process", href: "/verification" },
      { label: "Pricing & Plans", href: "/pricing" },
      { label: "Provider Portal", href: "/portal" },
    ],
  },
  {
    slug: "applications",
    title: "Applications",
    desc: "Understanding the review process, lease agreements, and terms.",
    icon: "document",
    relatedLinks: [
      { label: "Student Portal", href: "/student" },
      { label: "Securing Your Room", href: "/guide" },
      { label: "International Checklist", href: "/international" },
    ],
  },
  {
    slug: "account-security",
    title: "Account & Security",
    desc: "Passwords, 2FA, data privacy, and managing your profile.",
    icon: "shield",
    relatedLinks: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Profile Settings", href: "/settings/profile" },
      { label: "Security & 2FA", href: "/settings/security" },
    ],
  },
  {
    slug: "payments",
    title: "Payments",
    desc: "Rent, bond, fees, invoices, and billing history.",
    icon: "credit-card",
    relatedLinks: [
      { label: "Cost of Living Breakdown", href: "/cost" },
      { label: "Provider Pricing", href: "/pricing" },
      { label: "Billing Support", href: "/contact" },
    ],
  },
];

export const SUPPORT_ARTICLES: SupportArticle[] = [
  // Finding Accommodation
  {
    id: "fa-1",
    slug: "how-to-apply-for-student-accommodation",
    title: "How do I apply for student accommodation on Jesmond?",
    category: "finding-accommodation",
    summary: "Step-by-step guidance on browsing, selecting room types, and submitting a digital application.",
    content: "Browse listings in your target city, select your preferred room type, and click 'Apply Now'. You will be guided through a secure digital application where you can upload your passport and student confirmation of enrolment.",
    tags: ["apply", "application", "room", "booking", "listings", "search", "passport", "enrolment", "accommodation"],
    relatedHref: "/guide",
    relatedLabel: "Student Accommodation Guide",
  },
  {
    id: "fa-2",
    slug: "types-of-student-accommodation",
    title: "What types of student accommodation are available in Australia?",
    category: "finding-accommodation",
    summary: "Overview of Purpose-Built Student Accommodation (PBSA), residential colleges, private rentals, and homestays.",
    content: "Jesmond specializes in Purpose-Built Student Accommodation (PBSA), which offers private or shared rooms with communal facilities like gyms, cinemas, and study spaces. Other options include on-campus residential colleges, private rentals, and local homestays.",
    tags: ["pbsa", "residential colleges", "private rentals", "homestay", "room types", "facilities", "amenities", "furnished"],
    relatedHref: "/guide",
    relatedLabel: "Compare Housing Types",
  },
  {
    id: "fa-3",
    slug: "when-to-start-looking",
    title: "When should I start looking for student accommodation?",
    category: "finding-accommodation",
    summary: "Recommended timelines for securing student rooms before university semesters begin.",
    content: "The student housing market in Australia is competitive, especially in major cities like Sydney, Melbourne, and Brisbane. We strongly recommend starting your search at least 3 to 4 months before your university semester begins.",
    tags: ["timeline", "timing", "when to look", "semester", "intake", "availability", "early booking"],
    relatedHref: "/guide",
    relatedLabel: "Planning Advice",
  },
  {
    id: "fa-4",
    slug: "inspecting-and-comparing-listings",
    title: "How can I compare properties or arrange inspections?",
    category: "finding-accommodation",
    summary: "Tools for comparing room dimensions, campus distances, utility inclusions, and verified photos.",
    content: "Every listing on Jesmond features verified photos, campus transit distances, utility breakdowns, and floor plans. You can save properties to compare them side-by-side or message the provider directly for virtual or in-person viewings.",
    tags: ["compare", "inspection", "virtual tour", "transit distance", "saved listings", "amenities", "photos"],
    relatedHref: "/search",
    relatedLabel: "Explore Listings",
  },

  // Students
  {
    id: "st-1",
    slug: "student-visa-work-rights",
    title: "What are the work rights on an Australian Student Visa (Subclass 500)?",
    category: "students",
    summary: "Rules governing fortnightly working hours during semester terms and breaks.",
    content: "Under Condition 8105 of the Student Visa (Subclass 500), international students are permitted to work up to 48 hours per fortnight while university is in session, and unlimited hours during officially recognized semester breaks.",
    tags: ["visa", "work rights", "hours", "subclass 500", "employment", "fortnight", "unlimited hours", "jobs"],
    relatedHref: "/visa",
    relatedLabel: "Student Visa Resources",
  },
  {
    id: "st-2",
    slug: "official-minimum-living-cost",
    title: "What is the official minimum living cost requirement for Australia?",
    category: "students",
    summary: "Department of Home Affairs financial capacity threshold for student visa holders.",
    content: "Under Department of Home Affairs regulations updated in May 2024, international applicants for the Student Visa (Subclass 500) must demonstrate evidence of financial capacity of at least AUD $29,710 per year to cover living expenses.",
    tags: ["living cost", "cost of living", "finance", "financial capacity", "budget", "visa requirement", "funds"],
    relatedHref: "/cost",
    relatedLabel: "Cost of Living Breakdown",
  },
  {
    id: "st-3",
    slug: "pre-departure-arrival-checklist",
    title: "What should I arrange before departing for Australia?",
    category: "students",
    summary: "Essential checklist covering visas, student banking, TFN, transit passes, and biosecurity.",
    content: "Make sure you have your Visa Grant Notice and CoE, open an Australian student bank account online prior to arrival, apply for a Tax File Number (TFN) once in Australia, and ensure you declare all food and plant items on your incoming passenger card.",
    tags: ["pre-departure", "checklist", "moving", "bank account", "tfn", "tax file number", "biosecurity", "customs"],
    relatedHref: "/moving",
    relatedLabel: "Moving to Australia Checklist",
  },
  {
    id: "st-4",
    slug: "emergency-and-crisis-support",
    title: "What emergency and health services are available for students?",
    category: "students",
    summary: "Emergency contacts (000), campus security protocols, Lifeline, and OSHC healthcare.",
    content: "For any life-threatening emergency, call Triple Zero (000) immediately from any phone. For 24/7 crisis support and mental health, contact Lifeline on 13 11 14. International students also maintain mandatory Overseas Student Health Cover (OSHC) for medical visits.",
    tags: ["emergency", "000", "lifeline", "oshc", "medical", "police", "health", "safety", "campus security"],
    relatedHref: "/safety",
    relatedLabel: "Student Safety Guide",
  },

  // Providers
  {
    id: "pr-1",
    slug: "are-providers-verified",
    title: "Are accommodation providers on Jesmond verified?",
    category: "providers",
    summary: "How Jesmond verifies ABNs, corporate registration, and property leasing authority.",
    content: "Yes. Every property provider undergoes strict identity and property checks, including Australian Business Number (ABN) verification and title authorization, ensuring a scam-free experience.",
    tags: ["verification", "abn", "acn", "verified partner", "scam free", "screening", "security", "legitimate"],
    relatedHref: "/verification",
    relatedLabel: "Provider Verification Process",
  },
  {
    id: "pr-2",
    slug: "how-to-list-properties",
    title: "How do accommodation providers list properties on Jesmond?",
    category: "providers",
    summary: "Joining the provider portal, listing rooms, and managing inquiries.",
    content: "Accommodation providers can register through the Partner Portal, submit their Australian business verification details, and manage property rooms, availability calendars, rates, and direct student inquiries from a centralized dashboard.",
    tags: ["list property", "partner", "portal", "rooms", "calendar", "inquiries", "onboarding"],
    relatedHref: "/providers",
    relatedLabel: "Partner with Jesmond",
  },
  {
    id: "pr-3",
    slug: "provider-pricing-and-plans",
    title: "What listing plans and pricing tiers are available for providers?",
    category: "providers",
    summary: "Starter, Growth, and Enterprise plans with transparent month-to-month terms.",
    content: "Jesmond offers a Starter plan allowing independent providers to list up to 3 properties at zero upfront cost. Growth and Enterprise plans provide multi-property management, PMS webhooks, and priority placement with no lock-in contracts.",
    tags: ["pricing", "plans", "starter", "growth", "enterprise", "zero upfront", "contracts", "fees"],
    relatedHref: "/pricing",
    relatedLabel: "View Listing Plans",
  },
  {
    id: "pr-4",
    slug: "pms-software-integration",
    title: "Can property managers and PBSA operators integrate external software?",
    category: "providers",
    summary: "REST APIs and webhooks for Property Management Systems (PMS).",
    content: "Yes. Enterprise partners have access to property management software (PMS) webhooks and REST APIs to synchronize room availability, real-time pricing, and tenancy applications seamlessly with existing software.",
    tags: ["pms", "software", "api", "webhooks", "integration", "synchronize", "automation", "real-time"],
    relatedHref: "/pricing",
    relatedLabel: "API & Software Integrations",
  },

  // Applications
  {
    id: "ap-1",
    slug: "how-application-review-works",
    title: "How does the accommodation application and review process work?",
    category: "applications",
    summary: "Review milestones from digital submission to provider offer and contract.",
    content: "After submitting your application with your passport and Confirmation of Enrolment (CoE), the accommodation provider evaluates your details. Providers usually review and respond within 24 to 48 business hours via your Jesmond student portal.",
    tags: ["application", "review", "timeline", "response", "approval", "status", "student portal", "process"],
    relatedHref: "/student",
    relatedLabel: "Track in Student Portal",
  },
  {
    id: "ap-2",
    slug: "documents-needed-for-application",
    title: "What documents do I need to submit with my accommodation application?",
    category: "applications",
    summary: "Identification, enrollment confirmation, and visa documentation required for booking.",
    content: "To apply for student housing, you generally need a valid passport, Confirmation of Enrolment (CoE) or university acceptance letter, Student Visa (Subclass 500) confirmation, and emergency contact details.",
    tags: ["documents", "passport", "coe", "confirmation of enrolment", "visa grant", "id", "requirements"],
    relatedHref: "/international",
    relatedLabel: "International Student Guide",
  },
  {
    id: "ap-3",
    slug: "cancellation-and-visa-refusal",
    title: "What should I do if I need to cancel my accommodation booking?",
    category: "applications",
    summary: "Cancellation procedures and 'No Visa, No Pay' refund terms for student bookings.",
    content: "Review your provider's cancellation terms in your tenancy agreement. If you experience visa refusal, most Purpose-Built Student Accommodation (PBSA) providers offer full refund policies upon providing official proof.",
    tags: ["cancel", "cancellation", "refund", "visa refusal", "no visa no pay", "policy", "lease termination"],
    relatedHref: "/contact",
    relatedLabel: "Contact Support Team",
  },
  {
    id: "ap-4",
    slug: "signing-lease-agreements",
    title: "How are residential tenancy agreements signed and managed?",
    category: "applications",
    summary: "Digital lease review, statutory state tenancy compliance, and electronic signing.",
    content: "When an application is accepted, the provider issues a standard state-compliant tenancy agreement. You can review all terms, lease duration, bond amounts, and house rules before signing digitally within the Jesmond platform.",
    tags: ["lease", "agreement", "contract", "signing", "digital signature", "terms", "tenancy", "state compliance"],
    relatedHref: "/student",
    relatedLabel: "Manage Leases",
  },

  // Account & Security
  {
    id: "as-1",
    slug: "two-factor-authentication",
    title: "How do I set up Two-Factor Authentication (2FA)?",
    category: "account-security",
    summary: "Securing your Jesmond account with authenticator apps and backup codes.",
    content: "Navigate to Account Settings > Security and enable Two-Factor Authentication. Scan the displayed QR code with your preferred authenticator app (such as Google Authenticator) and enter the 6-digit verification code to confirm.",
    tags: ["2fa", "two-factor", "mfa", "security", "authenticator", "qr code", "protect", "login", "settings"],
    relatedHref: "/settings/security",
    relatedLabel: "Security Settings",
  },
  {
    id: "as-2",
    slug: "privacy-and-data-protection",
    title: "How is my personal information protected on Jesmond?",
    category: "account-security",
    summary: "Compliance with Australian Privacy Principles, SSL/TLS encryption, and data rights.",
    content: "Jesmond strictly adheres to the Australian Privacy Principles (APPs). All personal identity documents and credentials are encrypted in transit and at rest using modern encryption standards. We never sell student data to unauthorized third parties.",
    tags: ["privacy", "data", "encryption", "australian privacy principles", "app", "security", "protection", "gdpr"],
    relatedHref: "/privacy",
    relatedLabel: "Privacy Policy",
  },
  {
    id: "as-3",
    slug: "resetting-your-password",
    title: "How do I reset my password if I am locked out?",
    category: "account-security",
    summary: "Self-service password recovery instructions and security tips.",
    content: "Click 'Forgot Password' on the login screen and enter your registered email address. You will receive a secure password reset link valid for 60 minutes. If you are already logged in, you can update your password directly in Account Settings > Security.",
    tags: ["password", "reset", "forgot password", "recovery", "locked", "change password", "credentials"],
    relatedHref: "/forgot-password",
    relatedLabel: "Password Recovery",
  },
  {
    id: "as-4",
    slug: "preventing-rental-scams",
    title: "How can students avoid rental accommodation scams in Australia?",
    category: "account-security",
    summary: "Warning signs of fraudulent listings and safe booking practices.",
    content: "Never transfer money via untraceable methods (cryptocurrency, Western Union) before verifying the provider's Australian Business Number (ABN) and legal lease contract. All residential rental bonds must be lodged with state tenancy authorities rather than paid into an individual's personal account.",
    tags: ["scam", "fraud", "scam prevention", "warning", "fake listings", "bond safety", "abn", "wire transfer"],
    relatedHref: "/safety",
    relatedLabel: "Safety & Scam Prevention",
  },

  // Payments
  {
    id: "pm-1",
    slug: "how-rental-bonds-are-handled",
    title: "How are rental bonds handled in Australia?",
    category: "payments",
    summary: "Statutory government authorities (RTBA, RBO, RTA) and official deposit receipts.",
    content: "Rental bonds are legally lodged with independent statutory government authorities (such as the RTBA in Victoria or RBO in New South Wales). You receive an official receipt directly from the state authority.",
    tags: ["bond", "rental bond", "security deposit", "rtba", "rbo", "rta", "lodgement", "statutory authority", "receipt"],
    relatedHref: "/cost",
    relatedLabel: "Cost & Bond Details",
  },
  {
    id: "pm-2",
    slug: "utilities-and-bills-inclusion",
    title: "Are utilities typically included in Australian student accommodation?",
    category: "payments",
    summary: "Breakdown of water, electricity, heating, and Wi-Fi inclusions across housing types.",
    content: "In Purpose-Built Student Accommodation (PBSA), utilities such as electricity, water, heating, and unlimited high-speed Wi-Fi are almost always included in the weekly rent. In private rentals or sharehouses, utilities are usually billed separately.",
    tags: ["utilities", "bills", "electricity", "water", "wi-fi", "gas", "internet", "inclusive", "weekly rent"],
    relatedHref: "/cost",
    relatedLabel: "Living Cost Guide",
  },
  {
    id: "pm-3",
    slug: "payment-methods-and-schedules",
    title: "What payment methods and billing schedules are supported?",
    category: "payments",
    summary: "Accepted payment forms (direct debit, credit card, BPAY) and billing frequencies.",
    content: "Accommodation providers accept Australian bank direct debit, BPAY, Visa, and MasterCard. Rent is commonly charged on a fortnightly or monthly basis as specified in your residential tenancy agreement.",
    tags: ["payment methods", "bpay", "credit card", "direct debit", "billing schedule", "fortnightly", "monthly", "invoices"],
    relatedHref: "/pricing",
    relatedLabel: "Pricing & Billing",
  },
  {
    id: "pm-4",
    slug: "disputed-or-incorrect-charges",
    title: "What should I do if I notice an incorrect fee or charge?",
    category: "payments",
    summary: "Steps to review ledger statements, contact property managers, or request billing support.",
    content: "If you notice an unexpected fee, first check your payment history and tenancy ledger in your student portal. You can message your provider directly through the platform or contact Jesmond Support for billing assistance.",
    tags: ["dispute", "incorrect fee", "charge", "refund", "billing inquiry", "ledger", "receipt", "support"],
    relatedHref: "/contact",
    relatedLabel: "Contact Billing Support",
  },
];

/**
 * Filter articles by search term and optional category slug.
 */
export function searchSupportArticles(query: string, categorySlug?: string): SupportArticle[] {
  const normalizedQuery = query.trim().toLowerCase();

  return SUPPORT_ARTICLES.filter((article) => {
    // If a category is selected, enforce category match
    if (categorySlug && article.category !== categorySlug) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const titleMatch = article.title.toLowerCase().includes(normalizedQuery);
    const summaryMatch = article.summary.toLowerCase().includes(normalizedQuery);
    const contentMatch = article.content.toLowerCase().includes(normalizedQuery);
    const tagsMatch = article.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

    // Also match against category title
    const categoryObj = SUPPORT_CATEGORIES.find((c) => c.slug === article.category);
    const categoryMatch = categoryObj?.title.toLowerCase().includes(normalizedQuery);

    return titleMatch || summaryMatch || contentMatch || tagsMatch || categoryMatch;
  });
}
