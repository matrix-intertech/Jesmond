"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { SafeImage } from '../../../components/ui/SafeImage';
import Link from 'next/link';
import EmptyState from "@/components/ui/EmptyState";
import { getAccessToken, clearAuth } from '@/utils/auth';
import { useRouter } from 'next/navigation';
import { handleApiError } from '@/utils/api';
import { formatLocation } from '@/utils/location';

interface SavedProperty {
  id: string;
  name: string;
  status: string;
  organization: { name: string };
  suburb: {
    name: string;
    city?: { name: string } | null;
    state?: { name: string; code: string } | null;
  };
  media: { url: string }[];
  roomTypes: { pricePerWeek: number }[];
}

export default function StudentSavedPage() {
  const [properties, setProperties] = useState<SavedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const router = useRouter();
  const onAuthError = () => { clearAuth(); router.replace('/login'); };

  useEffect(() => {
    fetchSavedProperties();
  }, []);

  const fetchSavedProperties = async () => {
    try {
      const token = getAccessToken();
      if (!token) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/saved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setProperties(await res.json());
      } else if (status === 'forbidden') {
        setError('You are not authorized to view saved properties.');
        setLoading(false);
      } else {
        setError('Failed to load saved properties.');
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const unsaveProperty = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/${id}/save`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const status = await handleApiError(res, onAuthError);
    if (status === 'ok') {
      setProperties(properties.filter(p => p.id !== id));
    } else {
      // Optionally handle errors, keep existing list
    }
  };

  if (loading) return <div className="p-10 text-center">Loading saved properties...</div>;

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Saved Properties</h1>

        {properties.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border">
            <EmptyState 
              title="No saved properties yet" 
              description="Start exploring to find your perfect student home."
              action={{ label: "Explore Properties", href: "/search" }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map(prop => (
              <Link href={`/property/${prop.id}`} key={prop.id} className="group bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition">
                <div className="relative h-48 bg-slate-100">
                  <SafeImage 
                    src={prop.media[0]?.url} 
                    alt={prop.name} 
                    fill 
                    sizes="(max-width: 768px) 100vw, 400px" 
                    className="object-cover group-hover:scale-105 transition duration-500" 
                  />
                  <button onClick={(e) => unsaveProperty(prop.id, e)} className="absolute top-3 right-3 bg-white p-2 rounded-full shadow-sm text-rose-500 hover:scale-110 transition z-10">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  </button>
                </div>
                <div className="p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{prop.organization.name}</div>
                  <h3 className="font-bold text-lg leading-tight mb-1">{prop.name}</h3>
                  <p className="text-slate-500 text-sm mb-3">{formatLocation({ suburb: prop.suburb, state: prop.suburb.state, city: prop.suburb.city })}</p>
                  <div className="font-bold text-brand-orange">
                    {prop.roomTypes[0] ? `From $${(prop.roomTypes[0].pricePerWeek / 100).toFixed(2)} /wk` : 'Price TBC'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}
