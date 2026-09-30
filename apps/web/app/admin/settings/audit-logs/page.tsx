"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/settings/audit-logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
        if (status === 'ok') {
          const data = await res.json();
          setLogs(data);
        } else {
          setError('Failed to load audit logs');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [router]);

  if (loading) return <div className="p-8 text-center text-text-secondary">Loading audit logs...</div>;

  return (
    <div className="bg-surface shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-border-strong">
        <h3 className="text-lg leading-6 font-medium text-primary">Audit Logs</h3>
        <p className="mt-1 text-sm text-text-secondary">System activity and setting modifications.</p>
      </div>

      {error && <div className="p-4 bg-rose-50 text-rose-700 m-4 rounded-md text-sm">{error}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-muted">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Time</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Actor</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Action</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Resource</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Changes</th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-primary font-medium">
                  {log.actorId} <span className="text-xs text-text-secondary ml-1">({log.actorType})</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">
                  {log.action}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                  {log.resourceType} : {log.resourceId}
                </td>
                <td className="px-6 py-4 text-sm text-text-secondary max-w-xs truncate">
                  {JSON.stringify(log.changes)}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-text-secondary">No logs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
