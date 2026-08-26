"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { isAuthenticated, getCurrentUser } from "@/utils/auth";

export function GlobalNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ isAuth: boolean, role?: string }>({ isAuth: false });

  useEffect(() => {
    setAuthStatus({
      isAuth: isAuthenticated(),
      role: getCurrentUser()?.role,
    });
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
    { label: "Universities", href: "/universities" },
    { label: "States", href: "/states" },
    { label: "Providers", href: "/providers" },
    { label: "Support", href: "/support" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md border-b border-slate-200/60 py-4 shadow-sm"
            : "bg-white py-6"
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group relative z-50">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold text-xl tracking-tighter">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-brand-navy uppercase">
              Jesmond<span className="text-orange-500 text-[10px] lowercase tracking-normal relative -top-2">.com.au</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden xl:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[13px] font-bold text-brand-navy hover:text-orange-600 transition-colors relative group"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Actions (Saved, Login, Sign Up) */}
          <div className="hidden lg:flex items-center gap-6">
            <Link href="/student/saved" className="text-orange-500 hover:text-orange-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </Link>
            <div className="w-px h-5 bg-slate-200" />
            {authStatus.isAuth ? (
              <Link
                href={getDashboardRoute(authStatus.role)}
                className="text-sm font-semibold text-white bg-brand-orange hover:bg-orange-600 transition-colors px-5 py-2.5 rounded-full shadow-sm active:scale-95 duration-200"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-brand-navy hover:text-orange-600 transition-colors px-2"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-semibold text-white bg-brand-orange hover:bg-orange-600 transition-colors px-5 py-2.5 rounded-full shadow-sm active:scale-95 duration-200"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <button
            className="xl:hidden relative z-50 p-2 text-brand-navy"
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
            className="fixed inset-0 z-40 bg-white pt-24 px-6 xl:hidden overflow-y-auto"
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
                    className="text-2xl font-bold tracking-tight text-brand-navy block border-b border-slate-100 pb-4"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              <div className="mt-8 flex flex-col gap-4 pb-12">
                <Link
                  href="/student/saved"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full text-center py-4 rounded-[8px] border-2 border-orange-100 text-lg font-semibold text-orange-600 flex justify-center items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  Saved Properties
                </Link>
                {authStatus.isAuth ? (
                  <Link
                    href={getDashboardRoute(authStatus.role)}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full text-center py-4 rounded-xl bg-brand-orange text-lg font-semibold text-white shadow-lg"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full text-center py-4 rounded-xl border border-slate-200 text-lg font-semibold text-brand-navy"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full text-center py-4 rounded-xl bg-brand-orange text-lg font-semibold text-white shadow-lg"
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
