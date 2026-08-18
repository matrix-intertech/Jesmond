"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/utils/auth";
import { LogOut } from "lucide-react";

export default function SecuritySettings() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/security`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMfaEnabled(data.mfaEnabled || false);
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupInitiate = async () => {
    try {
      setError("");
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/security/2fa-setup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setQrCodeUrl(data.qrDataUrl);
        setSetupMode(true);
      } else {
        setError(data.message || "Failed to initiate setup");
      }
    } catch (e: any) {
      setError(e.message || "Failed to initiate setup");
    }
  };

  const handleVerifySetup = async () => {
    try {
      setError("");
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/security/2fa-verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode })
      });
      const data = await res.json();
      if (res.ok) {
        setMfaEnabled(true);
        setSetupMode(false);
        setVerificationCode("");
        alert("2FA has been successfully enabled.");
      } else {
        setError(data.message || "Invalid verification code");
      }
    } catch (e: any) {
      setError(e.message || "Invalid verification code");
    }
  };

  const handleDisable = async () => {
    const code = prompt("Enter your 2FA code to disable:");
    if (!code) return;
    try {
      setError("");
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/security/2fa-disable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (res.ok) {
        setMfaEnabled(false);
        alert("2FA has been disabled.");
      } else {
        const data = await res.json();
        alert(data.message || "Invalid code");
      }
    } catch (e: any) {
      alert(e.message || "Invalid code");
    }
  };

  const revokeSession = async (id: string) => {
    if (!confirm("Are you sure you want to log out this session?")) return;
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/settings/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSessions(sessions.filter((s) => s.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading security settings...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Two-Factor Authentication</h3>
          <p className="mt-1 text-sm text-gray-500">Add an extra layer of security to your account.</p>
        </div>
        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded text-sm">{error}</div>}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div>
              <h3 className="font-medium">Authenticator App</h3>
              <p className="text-sm text-gray-500">
                {mfaEnabled ? "2FA is currently enabled." : "Secure your account with TOTP 2FA."}
              </p>
            </div>
            {mfaEnabled ? (
              <button onClick={handleDisable} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50">
                Disable
              </button>
            ) : (
              <button onClick={handleSetupInitiate} className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800">
                Set Up
              </button>
            )}
          </div>

          {setupMode && !mfaEnabled && (
            <div className="p-4 mt-4 border rounded-lg bg-white space-y-4">
              <h3 className="font-medium">Complete 2FA Setup</h3>
              <p className="text-sm text-gray-500">Scan this QR code with your authenticator app, then enter the 6-digit code below.</p>
              {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 border rounded" />}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  className="px-3 py-2 border rounded w-32"
                  maxLength={6}
                />
                <button onClick={handleVerifySetup} className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800">
                  Verify & Enable
                </button>
                <button onClick={() => setSetupMode(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Active Sessions</h3>
          <p className="mt-1 text-sm text-gray-500">Devices that are currently logged in to your account.</p>
        </div>
        <ul className="divide-y divide-gray-200">
          {sessions.map((session: any) => (
            <li key={session.id} className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{session.deviceInfo || 'Unknown Device'}</p>
                <p className="text-xs text-gray-500 mt-1">IP: {session.ipAddress || 'Unknown'} • Started: {new Date(session.createdAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => revokeSession(session.id)} className="text-rose-600 hover:text-rose-800 p-2 rounded-full hover:bg-rose-50" title="Log out session">
                <LogOut className="w-5 h-5" />
              </button>
            </li>
          ))}
          {!sessions.length && <li className="p-6 text-sm text-gray-500 text-center">No active sessions found.</li>}
        </ul>
      </div>
    </div>
  );
}
