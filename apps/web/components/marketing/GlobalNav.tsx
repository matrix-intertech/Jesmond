"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, ChevronDown, LayoutDashboard, Settings, Building2, LogOut } from "lucide-react";
import Image from "next/image";
import {
  isAuthenticated,
  getCurrentUser,
  clearAuth,
  getPortalDashboardUrlForUser,
  isBusinessHost,
  restoreUserSession,
  subscribeToSharedSessionRevalidation,
  User,
} from "@/utils/auth";
import {
  checkBusinessAccess,
  getBusinessPortalUrl,
  logoutBusinessSession,
  resolveBusinessAuthDestination,
} from "@/utils/sso";
import { CompactChatPanel } from "../chat/CompactChatPanel";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { JesmondBusinessLogo } from "../branding/JesmondBusinessLogo";

export function GlobalNav() {
 const router = useRouter();
 const [isScrolled, setIsScrolled] = useState(false);
 const [isBizHost, setIsBizHost] = useState(false);
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
 const [isChatOpen, setIsChatOpen] = useState(false);
 const [initialConversationId, setInitialConversationId] = useState<string | null>(null);
 const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
 const profileMenuRef = useRef<HTMLDivElement>(null);
 const profileMenuPortalRef = useRef<HTMLDivElement>(null);
 const profileTriggerRef = useRef<HTMLButtonElement>(null);
 const [menuPosition, setMenuPosition] = useState<{ top: number; right: number }>({
   top: 72,
   right: 16,
 });
 const [authStatus, setAuthStatus] = useState<{
   isAuth: boolean;
   user: User | null;
   role?: string;
   dashboardRoute?: string;
 }>({ isAuth: false, user: null });
 const pathname = usePathname();
 const isMessagesActive = pathname === "/messages" || pathname.startsWith("/messages/");
 const unreadChatCount = useUnreadChatCount();

 useEffect(() => {
    setIsBizHost(isBusinessHost());
    let active = true;
    const user = getCurrentUser();
    const businessUrl = getBusinessPortalUrl();
    const hasLocalAuth = isAuthenticated();
    setAuthStatus({
      isAuth: hasLocalAuth,
      user: hasLocalAuth ? user : null,
      role: user?.role,
      dashboardRoute: getPortalDashboardUrlForUser(user, businessUrl),
    });

    void restoreUserSession().then((res) => {
      if (!active) return;
      if (res.status === 'ok' && res.user) {
        setAuthStatus({
          isAuth: true,
          user: res.user,
          role: res.user.role,
          dashboardRoute: getPortalDashboardUrlForUser(res.user, businessUrl),
        });
      } else if (res.status === 'unauthorized') {
        setAuthStatus({ isAuth: false, user: null });
      }
    });

    const unsubscribe = subscribeToSharedSessionRevalidation({
      onAuthenticated: (refreshedUser) => {
        if (!active) return;
        setAuthStatus({
          isAuth: true,
          user: refreshedUser,
          role: refreshedUser.role,
          dashboardRoute: getPortalDashboardUrlForUser(refreshedUser, businessUrl),
        });
      },
      onUnauthorized: () => {
        if (!active) return;
        setAuthStatus({ isAuth: false, user: null });
        setIsProfileMenuOpen(false);
      },
    });

    return () => {
      active = false;
      unsubscribe();
    };
 }, []);

 useEffect(() => {
 const handleOpenChat = (e: any) => {
 setInitialConversationId(e.detail?.conversationId || null);
 setIsChatOpen(true);
 };
 window.addEventListener('openCompactChat', handleOpenChat);
 return () => window.removeEventListener('openCompactChat', handleOpenChat);
 }, []);

 const getDashboardRoute = () => {
    if (authStatus.dashboardRoute) return authStatus.dashboardRoute;
    return getPortalDashboardUrlForUser(authStatus.user || getCurrentUser(), getBusinessPortalUrl());
  };

  const activeUser = authStatus.user || getCurrentUser();

  const getUserDisplayName = (u: User | null): string => {
    if (!u) return 'Account';
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return full || u.email || 'Account';
  };

  const getUserInitials = (u: User | null): string => {
    if (!u) return 'U';
    const f = (u.firstName || '').trim();
    const l = (u.lastName || '').trim();
    if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
    if (f) return f.slice(0, 2).toUpperCase();
    if (u.email) return u.email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const getSettingsRoute = (u: User | null): string => {
    if (u?.role === 'ADMIN' || u?.role === 'SUPER_ADMIN') {
      return '/admin/settings/profile';
    }
    if (isBusinessHost()) {
      return '/portal/settings/profile';
    }
    return '/settings/profile';
  };

  const canAccessBusinessSettings = (u: User | null): boolean => {
    if (!u || u.role !== 'ORG_STAFF') return false;
    if (u.orgRole === 'ADMIN') return true;
    const perms = u.permissions;
    if (!perms || perms.length === 0) return false;
    return (
      perms.includes('*') ||
      perms.includes('settings:manage') ||
      perms.includes('business:manage')
    );
  };

  const getBusinessSettingsRoute = (): string => {
    if (isBusinessHost()) {
      return '/portal/settings/business';
    }
    const businessBase = getBusinessPortalUrl().replace(/\/+$/, '');
    return `${businessBase}/portal/settings/business`;
  };

  const handleProfileLogout = async (closeMobileMenu = false) => {
    setIsProfileMenuOpen(false);
    if (closeMobileMenu) {
      setIsMobileMenuOpen(false);
    }
    const current = activeUser;
    if (!current || current.role !== 'STUDENT' || isBusinessHost()) {
      await logoutBusinessSession('/login');
      return;
    }
    clearAuth();
    setAuthStatus({ isAuth: false, user: null });
    router.push('/login');
  };

  const updateMenuPosition = useCallback(() => {
    const trigger = profileTriggerRef.current;
    if (!trigger || typeof window === 'undefined') return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 240;
    const maxRight = Math.max(12, window.innerWidth - menuWidth - 12);
    const computedRight = Math.max(12, Math.min(window.innerWidth - rect.right, maxRight));
    const computedTop = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 16));
    setMenuPosition({ top: computedTop, right: computedRight });
  }, []);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    updateMenuPosition();

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = profileMenuRef.current?.contains(target);
      const inPortalMenu = profileMenuPortalRef.current?.contains(target);
      if (!inTrigger && !inPortalMenu) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleMenuKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileMenuOpen(false);
        profileTriggerRef.current?.focus();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        const items = Array.from(
          profileMenuPortalRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [],
        );
        if (!items.length) return;
        e.preventDefault();
        const currentIndex = items.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'Home') {
          items[0].focus();
        } else if (e.key === 'End') {
          items[items.length - 1].focus();
        } else if (e.key === 'ArrowDown') {
          items[(currentIndex + 1) % items.length].focus();
        } else {
          items[(currentIndex - 1 + items.length) % items.length].focus();
        }
      }
    };

    const handleReposition = () => updateMenuPosition();

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleMenuKeyDown);
    window.addEventListener('resize', handleReposition, { passive: true });
    window.addEventListener('scroll', handleReposition, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleMenuKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition);
    };
  }, [isProfileMenuOpen, updateMenuPosition]);

  const handleDashboardClick = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    closeMobileMenu = false,
  ) => {
    if (closeMobileMenu) {
      setIsMobileMenuOpen(false);
    }

    const user = getCurrentUser();
    if (!isAuthenticated() || !user) {
      e.preventDefault();
      router.push('/login');
      return;
    }

    if (user.role !== 'ORG_STAFF') {
      return;
    }

    e.preventDefault();
    const businessBase = getBusinessPortalUrl().replace(/\/+$/, '');
    const accessStatus = await checkBusinessAccess();

    if (!accessStatus.error) {
      const resolution = resolveBusinessAuthDestination(user as User, accessStatus);
      if (resolution.action === 'redirect') {
        const dest = isBusinessHost()
          ? resolution.destination
          : `${businessBase}${resolution.destination}`;
        window.location.href = dest;
        return;
      }
      if (resolution.action === 'select_organization') {
        window.location.href = isBusinessHost() ? '/business/login' : `${businessBase}/login`;
        return;
      }
      if (resolution.action === 'onboarding') {
        window.location.href = isBusinessHost()
          ? '/business/onboarding'
          : `${businessBase}/onboarding`;
        return;
      }
    }

    const fallbackUrl = getPortalDashboardUrlForUser(user, businessBase);
    if (fallbackUrl.startsWith('http://') || fallbackUrl.startsWith('https://')) {
      window.location.href = fallbackUrl;
    } else {
      router.push(fallbackUrl);
    }
  };

 useEffect(() => {
 const handleScroll = () => {
 setIsScrolled(window.scrollY > 20);
 };

 // Initial check
 handleScroll();

 window.addEventListener("scroll", handleScroll, { passive: true });
 return () => window.removeEventListener("scroll", handleScroll);
 }, []);

 // Lock body scroll and handle Escape key & focus management when mobile menu or chat is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => {
        const firstFocusable = mobileDialogRef.current?.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsMobileMenuOpen(false);
          mobileMenuTriggerRef.current?.focus();
        } else if (e.key === 'Tab' && mobileDialogRef.current) {
          const focusables: HTMLElement[] = Array.from(
            mobileDialogRef.current.querySelectorAll(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          );
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = 'unset';
    }

    const handleChatKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChatOpen) {
        setIsChatOpen(false);
      }
    };
    window.addEventListener('keydown', handleChatKeyDown);
    return () => window.removeEventListener('keydown', handleChatKeyDown);
  }, [isMobileMenuOpen, isChatOpen]);

 const navLinks = [
 { label: "Businesses", href: "/businesses" },
 { label: "Universities", href: "/universities" },
 { label: "Agencies", href: "/agencies" },
 { label: "Support", href: "/support" },
 ];

 return (
 <>
 <motion.nav
 aria-label="Main Navigation"
 initial={{ y: -100 }}
 animate={{ y: 0 }}
 transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
 className={`fixed top-0 left-0 z-[100] w-full max-w-full overflow-x-hidden transition-all duration-300 ${
 isScrolled
 ? "bg-surface/95 backdrop-blur-md border-b border-border-strong/60 py-4 shadow-sm"
 : "bg-surface py-6"
 }`}
 >
 <div className="max-w-[1440px] mx-auto px-4 sm:px-12 lg:px-16 flex items-center justify-between">

 {/* Logo */}
 <Link href="/" className="flex items-center gap-2 group relative z-50">
 {isBizHost || pathname === "/pricing" ? (
   <JesmondBusinessLogo size="sm" />
 ) : (
   <Image src="/assets/logo_navbar.png" alt="Jesmond" width={140} height={36} className="h-9 w-auto" priority />
 )}
 </Link>

 {/* Desktop Navigation Links */}
 <div className="hidden xl:flex items-center gap-8">
 {navLinks.map((link) => (
 <Link
 key={link.label}
 href={link.href}
 className="text-[13px] font-bold text-primary hover:text-accent transition-colors relative group"
 >
 {link.label}
 </Link>
 ))}
 </div>

 {/* Actions (Saved, Login, Sign Up) */}
 <div className="hidden lg:flex items-center gap-6">
 <Link href="/student/saved" aria-label="Saved Properties" className="text-accent hover:text-accent transition-colors">
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
 </svg>
 </Link>
 <div className="w-px h-5 bg-secondary" />
 {authStatus.isAuth ? (
 <>
 <div className="relative">
 <button
 onClick={() => setIsChatOpen(!isChatOpen)}
 aria-label="Open chat messages"
 aria-expanded={isChatOpen}
 aria-haspopup="dialog"
 className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors px-2 ${
 isMessagesActive || isChatOpen ? "text-accent" : "text-primary hover:text-accent"
 }`}
 aria-current={isMessagesActive ? "page" : undefined}
 >
 <div className="relative flex items-center justify-center">
 <MessageCircle className="h-4 w-4" aria-hidden="true" />
 {unreadChatCount > 0 && (
 <span className="absolute -top-1 -right-1 flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
 <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
 </span>
 )}
 </div>
 Messages
 </button>
 {isChatOpen && <CompactChatPanel onClose={() => { setIsChatOpen(false); setInitialConversationId(null); }} initialConversationId={initialConversationId} />}
 </div>
 <Link
 href="/my-orders"
 className="text-sm font-semibold text-primary hover:text-accent transition-colors px-2"
 >
 My Orders
 </Link>
 <div className="relative" ref={profileMenuRef}>
 <button
 ref={profileTriggerRef}
 type="button"
 onClick={() => setIsProfileMenuOpen((prev) => !prev)}
 aria-haspopup="menu"
 aria-expanded={isProfileMenuOpen}
 aria-controls="nav-profile-menu"
 data-testid="nav-profile-trigger"
 className="inline-flex items-center gap-2.5 text-sm font-semibold text-primary bg-surface-muted/80 hover:bg-surface-muted border border-border-strong/70 transition-colors pl-1.5 pr-3.5 py-1.5 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
 >
 <span
 aria-hidden="true"
 className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-bold shrink-0"
 >
 {getUserInitials(activeUser)}
 </span>
 <span className="max-w-[140px] truncate">{getUserDisplayName(activeUser)}</span>
 <ChevronDown
 className={`w-4 h-4 text-text-secondary transition-transform duration-150 ${isProfileMenuOpen ? 'rotate-180' : ''}`}
 aria-hidden="true"
 />
 </button>
 {isProfileMenuOpen && typeof document !== 'undefined' && createPortal(
 <div
 ref={profileMenuPortalRef}
 id="nav-profile-menu"
 role="menu"
 aria-label="User Profile Menu"
 style={{ position: 'fixed', top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }}
 className="w-60 rounded-2xl bg-surface border border-border-strong/80 shadow-xl py-2 z-[200]"
 >
 <div className="px-4 py-2.5 border-b border-border-subtle">
 <p className="text-sm font-bold text-primary truncate">{getUserDisplayName(activeUser)}</p>
 {activeUser?.email && (
 <p className="text-xs text-text-secondary truncate">{activeUser.email}</p>
 )}
 </div>
 <div className="py-1">
 <Link
 href={getDashboardRoute()}
 role="menuitem"
 onClick={(e) => {
 setIsProfileMenuOpen(false);
 void handleDashboardClick(e, false);
 }}
 className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-surface-muted hover:text-accent transition-colors focus:outline-none focus:bg-surface-muted"
 >
 <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />
 <span>Dashboard</span>
 </Link>
 <Link
 href={getSettingsRoute(activeUser)}
 role="menuitem"
 onClick={() => setIsProfileMenuOpen(false)}
 className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-surface-muted hover:text-accent transition-colors focus:outline-none focus:bg-surface-muted"
 >
 <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
 <span>Settings</span>
 </Link>
 {canAccessBusinessSettings(activeUser) && (
 <Link
 href={getBusinessSettingsRoute()}
 role="menuitem"
 onClick={() => setIsProfileMenuOpen(false)}
 className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-surface-muted hover:text-accent transition-colors focus:outline-none focus:bg-surface-muted"
 >
 <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />
 <span>Business Settings</span>
 </Link>
 )}
 </div>
 <div className="border-t border-border-subtle pt-1">
 <button
 type="button"
 role="menuitem"
 onClick={() => void handleProfileLogout(false)}
 className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left focus:outline-none focus:bg-rose-50"
 >
 <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
 <span>Logout</span>
 </button>
 </div>
 </div>,
 document.body,
 )}
 </div>
 </>
 ) : (
 <>
 <Link
 href="/login"
 className="text-sm font-semibold text-primary hover:text-accent transition-colors px-2"
 >
 Log in
 </Link>
 <Link
 href="/register"
 className="text-sm font-semibold text-white bg-accent hover:bg-accent transition-colors px-5 py-2.5 rounded-full shadow-sm active:scale-95 duration-200"
 >
 Sign up
 </Link>
 </>
 )}
 </div>

 {/* Mobile Menu Trigger */}
 <button
          ref={mobileMenuTriggerRef}
          aria-label={isMobileMenuOpen ? "Close Navigation Menu" : "Open Navigation Menu"}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-navigation-menu"
          className="xl:hidden relative z-50 min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          onClick={() => {
            if (isMobileMenuOpen) {
              setIsMobileMenuOpen(false);
              mobileMenuTriggerRef.current?.focus();
            } else {
              setIsMobileMenuOpen(true);
            }
          }}
 >
 <motion.div animate={isMobileMenuOpen ? "open" : "closed"} className="flex flex-col gap-1.5 w-6">
 <motion.span
 variants={{ closed: { rotate: 0, y: 0 }, open: { rotate: 45, y: 8 } }}
 className="w-full h-0.5 bg-current block rounded-full"
 />
 <motion.span
 variants={{ closed: { opacity: 1 }, open: { opacity: 0 } }}
 className="w-full h-0.5 bg-current block rounded-full"
 />
 <motion.span
 variants={{ closed: { rotate: 0, y: 0 }, open: { rotate: -45, y: -8 } }}
 className="w-full h-0.5 bg-current block rounded-full"
 />
 </motion.div>
 </button>

 </div>
 </motion.nav>

 {/* Mobile Menu Overlay */}
 <AnimatePresence>
 {isMobileMenuOpen && (
 <motion.div
          ref={mobileDialogRef}
          id="mobile-navigation-menu"
 role="dialog"
 aria-modal="true"
 aria-label="Mobile Navigation"
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
 className="fixed inset-0 z-40 bg-surface pt-24 px-6 xl:hidden overflow-y-auto"
 >
 <div className="flex flex-col gap-6">
 {navLinks.map((link, i) => (
 <motion.div
 key={link.label}
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: i * 0.1 }}
 >
 <Link
 href={link.href}
 onClick={() => setIsMobileMenuOpen(false)}
 className="text-2xl font-bold tracking-tight text-primary block border-b border-border-subtle pb-4"
 >
 {link.label}
 </Link>
 </motion.div>
 ))}

 <div className="mt-8 flex flex-col gap-4 pb-12">
 <Link
 href="/student/saved"
 onClick={() => setIsMobileMenuOpen(false)}
 className="w-full text-center py-4 rounded-[8px] border-2 border-brand-orange text-lg font-semibold text-accent flex justify-center items-center gap-2"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
 Saved Properties
 </Link>
 {authStatus.isAuth ? (
 <>
 <button
 onClick={() => { setIsChatOpen(true); setIsMobileMenuOpen(false); }}
 className={`w-full py-4 rounded-xl border text-lg font-semibold flex justify-center items-center gap-2 ${
 isMessagesActive
 ? "border-brand-orange bg-surface-orange text-accent"
 : "border-border-strong text-primary"
 }`}
 aria-current={isMessagesActive ? "page" : undefined}
 >
 <div className="relative flex items-center justify-center">
 <MessageCircle className="h-5 w-5" aria-hidden="true" />
 {unreadChatCount > 0 && (
 <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
 </span>
 )}
 </div>
 Messages
 </button>
 <Link
 href="/my-orders"
 onClick={() => setIsMobileMenuOpen(false)}
 className="w-full text-center py-4 rounded-xl border border-border-strong text-lg font-semibold text-primary"
 >
 My Orders
 </Link>
 <div className="rounded-2xl border border-border-strong/70 bg-surface-muted/40 p-4 flex flex-col gap-2" data-testid="mobile-profile-menu">
 <div className="flex items-center gap-3 pb-3 border-b border-border-subtle">
 <span
 aria-hidden="true"
 className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent text-white text-sm font-bold shrink-0"
 >
 {getUserInitials(activeUser)}
 </span>
 <div className="min-w-0">
 <p className="text-base font-bold text-primary truncate">{getUserDisplayName(activeUser)}</p>
 {activeUser?.email && (
 <p className="text-xs text-text-secondary truncate">{activeUser.email}</p>
 )}
 </div>
 </div>
 <Link
 href={getDashboardRoute()}
 onClick={(e) => handleDashboardClick(e, true)}
 className="w-full text-center py-3.5 rounded-xl bg-accent text-base font-semibold text-white shadow-sm flex items-center justify-center gap-2"
 >
 <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
 <span>Dashboard</span>
 </Link>
 <Link
 href={getSettingsRoute(activeUser)}
 onClick={() => setIsMobileMenuOpen(false)}
 className="w-full py-3 px-4 rounded-xl border border-border-strong text-base font-semibold text-primary flex items-center gap-2.5"
 >
 <Settings className="w-4 h-4" aria-hidden="true" />
 <span>Settings</span>
 </Link>
 {canAccessBusinessSettings(activeUser) && (
 <Link
 href={getBusinessSettingsRoute()}
 onClick={() => setIsMobileMenuOpen(false)}
 className="w-full py-3 px-4 rounded-xl border border-border-strong text-base font-semibold text-primary flex items-center gap-2.5"
 >
 <Building2 className="w-4 h-4" aria-hidden="true" />
 <span>Business Settings</span>
 </Link>
 )}
 <button
 type="button"
 onClick={() => void handleProfileLogout(true)}
 className="w-full py-3 px-4 rounded-xl border border-rose-200 text-base font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 text-left"
 >
 <LogOut className="w-4 h-4" aria-hidden="true" />
 <span>Logout</span>
 </button>
 </div>
 </>
 ) : (
 <>
 <Link
 href="/login"
 onClick={() => setIsMobileMenuOpen(false)}
 className="w-full text-center py-4 rounded-xl border border-border-strong text-lg font-semibold text-primary"
 >
 Log in
 </Link>
 <Link
 href="/register"
 onClick={() => setIsMobileMenuOpen(false)}
 className="w-full text-center py-4 rounded-xl bg-accent text-lg font-semibold text-white shadow-lg"
 >
 Sign up
 </Link>
 </>
 )}
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </>
 );
}
