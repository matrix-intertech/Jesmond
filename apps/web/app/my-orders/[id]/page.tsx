"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlobalNav } from '@/components/marketing/GlobalNav';
import Link from 'next/link';

const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
};

export default function MyOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push(`/login?returnUrl=/my-orders/${id}`);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/v1/customer/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
        } else {
          if (res.status === 401 || res.status === 403) {
            router.push(`/login?returnUrl=/my-orders/${id}`);
          } else {
            setError('Failed to load order details.');
          }
        }
      } catch (err: any) {
        setError('Failed to load order details.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, router]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <GlobalNav />
      <main className="flex-1 max-w-[800px] w-full mx-auto px-6 py-24 sm:py-32">
        <Link href="/my-orders" className="text-brand-orange hover:text-orange-700 text-sm font-medium inline-flex items-center gap-1 mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Orders
        </Link>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="h-40 bg-slate-200 rounded-xl w-full"></div>
            <div className="h-40 bg-slate-200 rounded-xl w-full"></div>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 text-red-700 rounded-xl">
            <p>{error}</p>
          </div>
        ) : !order ? (
          <div className="p-6 bg-slate-100 text-slate-700 rounded-xl text-center">
            <p>Order not found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-brand-navy">Order {order.orderNumber}</h1>
                <p className="text-slate-500 mt-1">Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                order.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {order.status}
              </span>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
              <h2 className="text-lg font-semibold text-brand-navy mb-4">Order Items</h2>
              <ul className="divide-y divide-slate-100">
                {order.items?.map((item: any) => (
                  <li key={item.id} className="py-4 flex justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{item.product?.name || 'Unknown Product'}</p>
                      <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-slate-900">{formatCurrency(item.lineTotal, order.currency)}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-6 border-t border-slate-100 pt-6 space-y-3">
                <div className="flex justify-between text-slate-600">
                  <p>Subtotal</p>
                  <p>{formatCurrency(order.subtotal, order.currency)}</p>
                </div>
                <div className="flex justify-between text-slate-600">
                  <p>Tax</p>
                  <p>{formatCurrency(order.tax, order.currency)}</p>
                </div>
                {order.deliveryFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <p>Delivery Fee</p>
                    <p>{formatCurrency(order.deliveryFee, order.currency)}</p>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100">
                  <p>Total</p>
                  <p>{formatCurrency(order.total, order.currency)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
              <h2 className="text-lg font-semibold text-brand-navy mb-4">Order Details</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Store</dt>
                  <dd className="mt-1 text-sm text-slate-900">{order.branch?.name || 'Unknown'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Fulfillment</dt>
                  <dd className="mt-1 text-sm text-slate-900">{order.fulfillmentType || order.source || 'In-Store'}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
