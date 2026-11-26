'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  completeSsoExchange,
  checkBusinessAccess,
  resolveBusinessAuthDestination,
  applyActiveOrganizationToUser,
  BusinessOrganizationSummary,
} from '@/utils/sso';
import {
  getDashboardRouteForUser,
  getAccessToken,
  establishSharedSession,
  User,
} from '@/utils/auth';
import { Loader2, ShieldCheck, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function SsoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<'exchanging' | 'verifying' | 'select_org' | 'error'>('exchanging');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [orgChoices, setOrgChoices] = useState<BusinessOrganizationSummary[]>([]);

  const handleSelectOrg = (org: BusinessOrganizationSummary) => {
    if (!pendingUser) return;
    const updatedUser = applyActiveOrganizationToUser(pendingUser, org);
    router.replace(getDashboardRouteForUser(updatedUser));
  };

  useEffect(() => {
    let isMounted = true;

    const executeExchange = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');

      if (errorParam) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(errorDesc || errorParam || 'Authentication was cancelled or denied.');
        }
        return;
      }

      if (!code || !state) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Missing authorization code or state parameter in callback URL.');
        }
        return;
      }

      try {
        if (isMounted) setStatus('exchanging');
        const exchangeResult = await completeSsoExchange(code, state);
        const exchangedToken = getAccessToken();
        if (exchangedToken) {
          const ssoRes = await establishSharedSession(
            exchangedToken,
            exchangeResult.user?.organizationId,
          );
          if (!ssoRes.ok) {
            throw new Error(ssoRes.message || 'Unable to establish shared portal session. Please try again.');
          }
        }

        if (isMounted) setStatus('verifying');
        // Validate business organization permissions on the backend
        const accessCheck = await checkBusinessAccess();
        const resolution = resolveBusinessAuthDestination(exchangeResult.user, accessCheck);

        if (resolution.action === 'redirect') {
          router.replace(resolution.destination);
        } else if (resolution.action === 'select_organization') {
          if (isMounted) {
            setPendingUser(exchangeResult.user);
            setOrgChoices(resolution.organizations);
            setStatus('select_org');
          }
        } else if (resolution.action === 'onboarding') {
          // Authenticated customer/student entering business portal without an organization
          router.replace('/business/onboarding');
        } else {
          throw new Error(resolution.message);
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'Single Sign-On exchange failed.');
        }
      }
    };

    executeExchange();

    return () => {
      isMounted = false;
    };
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 p-8 sm:p-10 rounded-2xl shadow-2xl max-w-md w-full text-center">
        {status === 'exchanging' && (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-brand-purple mx-auto" />
            <h2 className="text-xl font-bold font-outfit text-white">Exchanging Secure Credentials</h2>
            <p className="text-xs text-slate-400">
              Verifying cryptographic PKCE challenge and single-use authorization code...
            </p>
          </div>
        )}

        {status === 'verifying' && (
          <div className="space-y-4">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto animate-pulse" />
            <h2 className="text-xl font-bold font-outfit text-white">Verifying Organization Access</h2>
            <p className="text-xs text-slate-400">
              Synchronizing partner credentials and loading business dashboard...
            </p>
          </div>
        )}

        {status === 'select_org' && (
          <div className="space-y-4 text-left">
            <h2 className="text-xl font-bold font-outfit text-white text-center">Select Organization</h2>
            <p className="text-xs text-slate-400 text-center">
              Choose which authorized business organization to open:
            </p>
            <div className="space-y-2">
              {orgChoices.map((org) => (
                <button
                  key={org.organizationId}
                  type="button"
                  onClick={() => handleSelectOrg(org)}
                  className="w-full text-left p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500 transition flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{org.organizationName}</div>
                    <div className="text-[11px] text-slate-400">
                      {org.businessCategory || org.orgType} • {org.role}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-red-950/40 border border-red-800/50 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-outfit text-white">Authentication Failed</h2>
              <p className="text-xs text-red-300 mt-2 p-3 rounded-xl bg-red-950/30 border border-red-900/40">
                {errorMessage}
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-3">
              <Link
                href="/business/login"
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-brand-purple hover:bg-purple-700 transition flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Business Sign In</span>
              </Link>
              <a
                href="https://jesmond.com.au"
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Return to Student Portal
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-brand-purple" />
        </div>
      }
    >
      <SsoCallbackContent />
    </Suspense>
  );
}
