"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Users, Settings, Home, Building } from 'lucide-react';

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Overview', href: '/portal/agency', icon: Building, exact: true },
    { name: 'Team Members', href: '/portal/agency/members', icon: Users, exact: false },
    { name: 'Settings', href: '/portal/agency/settings', icon: Settings, exact: false },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Agency Management</h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage your team members, property access, and agency settings.
        </p>
      </div>

      <div className="mb-8">
        <div className="sm:hidden">
          <label htmlFor="tabs" className="sr-only">
            Select a tab
          </label>
          <select
            id="tabs"
            name="tabs"
            className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-primary-500 focus:outline-none focus:ring-primary-500 sm:text-sm"
            defaultValue={tabs.find((tab) => (tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)))?.name}
            onChange={(e) => {
              window.location.href = tabs.find((t) => t.name === e.target.value)?.href || '/portal/agency';
            }}
          >
            {tabs.map((tab) => (
              <option key={tab.name}>{tab.name}</option>
            ))}
          </select>
        </div>
        <div className="hidden sm:block">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => {
                const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.name}
                    href={tab.href}
                    className={`
                      group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium
                      ${
                        isActive
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }
                    `}
                  >
                    <tab.icon
                      className={`
                        -ml-0.5 mr-2 h-5 w-5
                        ${isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'}
                      `}
                      aria-hidden="true"
                    />
                    {tab.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        {children}
      </div>
    </div>
  );
}
