"use client";

import { useState, useEffect } from "react";
import { getAccessToken } from '@/utils/auth';

export function SaveButton({ propertyId }: { propertyId: string }) {
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial state
    const checkSavedState = async () => {
      try {
        const token = getAccessToken();
        if (!token) {
          setLoading(false);
          return;
        }
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/saved`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const savedList = await res.json();
          if (savedList.some((p: any) => p.id === propertyId)) {
            setIsSaved(true);
          }
        }
      } catch (e) {}
      setLoading(false);
    };
    checkSavedState();
  }, [propertyId]);

  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = getAccessToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    const method = isSaved ? 'DELETE' : 'POST';
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/${propertyId}/save`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setIsSaved(!isSaved);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={toggleSave} 
      disabled={loading}
      className={`p-3 rounded-full shadow-sm hover:scale-110 transition ${isSaved ? 'bg-rose-50 text-rose-500' : 'bg-white text-slate-400'}`}
      title={isSaved ? "Unsave Property" : "Save Property"}
    >
      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
        {isSaved ? (
           <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        ) : (
           <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="none" stroke="currentColor" strokeWidth="2"/>
        )}
      </svg>
    </button>
  );
}
