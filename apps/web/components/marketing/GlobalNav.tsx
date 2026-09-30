"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import Image from "next/image";
import { isAuthenticated, getCurrentUser } from "@/utils/auth";
import { CompactChatPanel } from "../chat/CompactChatPanel";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";

export function GlobalNav() {
 const [isScrolled, setIsScrolled] = useState(false);
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
 const [isChatOpen, setIsChatOpen] = useState(false);
 const [initialConversationId, setInitialConversationId] = useState<string | null>(null);
 const [authStatus, setAuthStatus] = useState<{ isAuth: boolean, role?: string }>({ isAuth: false });
 const pathname = usePathname();
 const isMessagesActive = pathname === "/messages" || pathname.startsWith("/messages/");
 const unreadChatCount = useUnreadChatCount();

 useEffect(() => {
 setAuthStatus({
 isAuth: isAuthenticated(),
 role: getCurrentUser()?.role,
 });
 }, []);

 useEffect(() => {
 const handleOpenChat = (e: any) => {
 setInitialConversationId(e.detail?.conversationId || null);
 setIsChatOpen(true);
 };
 window.addEventListener('openCompactChat', handleOpenChat);
 return () => window.removeEventListener('openCompactChat', handleOpenChat);
 }, []);

 const getDashboardRoute = (role?: string) => {
 switch (role) {
 case 'STUDENT': return '/student';
 case 'ADMIN':
 case 'SUPER_ADMIN': return '/admin';
 case 'ORG_STAFF': return '/portal';
 default: return '/login';
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

 // Lock body scroll when mobile menu is open
 useEffect(() => {
 if (isMobileMenuOpen) {
 document.body.style.overflow = 'hidden';
 } else {
 document.body.style.overflow = 'unset';
 }
 }, [isMobileMenuOpen]);

 const navLinks = [
 { label: "Retail", href: "/retail" },
 { label: "Universities", href: "/universities" },
 { label: "Providers", href: "/providers" },
 { label: "Agencies", href: "/agencies" },
 { label: "Support", href: "/support" },
 ];

 return (
 <>
 <motion.nav
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
 <Image src="/assets/logo_navbar.png" alt="Jesmond" width={140} height={36} className="h-9 w-auto" priority />
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
 <Link href="/student/saved" className="text-accent hover:text-accent transition-colors">
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
 </svg>
 </Link>
 <div className="w-px h-5 bg-secondary" />
 {authStatus.isAuth ? (
 <>
 <div className="relative">
 <button
 onClick={() => setIsChatOpen(!isChatOpen)}
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
 <Link
 href={getDashboardRoute(authStatus.role)}
 className="text-sm font-semibold text-white bg-accent hover:bg-accent transition-colors px-5 py-2.5 rounded-full shadow-sm active:scale-95 duration-200"
 >
 Dashboard
 </Link>
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
 aria-label="Toggle Navigation Menu"
 className="xl:hidden relative z-50 p-2 text-primary"
 onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
 <Link
 href={getDashboardRoute(authStatus.role)}
 onClick={() => setIsMobileMenuOpen(false)}
 className="w-full text-center py-4 rounded-xl bg-accent text-lg font-semibold text-white shadow-lg"
 >
 Dashboard
 </Link>
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
