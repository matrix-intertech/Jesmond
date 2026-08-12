'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import Link from 'next/link';

export default function ProviderPortalPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    setUser(JSON.parse(userData));

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('access_token');
          router.push('/login');
          throw new Error('Unauthorized');
        }
        return res.json();
      })
      .then(data => {
        setProperties(data);
        setLoading(false);
      })
      .catch(console.error);
  }, [router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-medium text-slate-900 font-outfit">
              Provider Dashboard
            </h1>
            <p className="text-slate-500">Welcome back, {user?.firstName} {user?.lastName}</p>
          </div>
          <div className="flex gap-4">
            <Link 
              href="/portal/create" 
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
            >
              + Create Accommodation
            </Link>
            <button 
              onClick={() => { localStorage.clear(); router.push('/login'); }}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Your Accommodations ({properties.length})</h2>
          </div>
          {properties.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No accommodations found. Create your first property.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {properties.map((prop) => (
                <li key={prop.id} className="p-6 flex justify-between items-center hover:bg-gray-50 transition">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{prop.name}</h3>
                    <p className="text-sm text-gray-500">{prop.address}, {prop.suburb.name}</p>
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${prop.status === 'DRAFT' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                      {prop.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}
