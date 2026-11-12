"use client";

import React, { useState, useRef, useEffect } from 'react';
import { COUNTRIES, Country } from '@/constants/countries';

interface CountrySelectorProps {
  id?: string;
  name?: string;
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  helperText?: string;
}

export function CountrySelector({
  id = 'countryOfOrigin',
  name = 'countryOfOrigin',
  value = '',
  onChange,
  label,
  placeholder = 'Select country of origin...',
  required = false,
  disabled = false,
  className = '',
  error = false,
  helperText,
}: CountrySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Find selected country name if matching code or full name
  const selectedCountry = COUNTRIES.find(
    (c) =>
      c.name.toLowerCase() === value.toLowerCase() ||
      c.code.toLowerCase() === value.toLowerCase(),
  );

  const displayValue = selectedCountry ? selectedCountry.name : value;

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (countryCode: string) => {
    onChange(countryCode);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-text-primary mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Selector Trigger Button */}
      <button
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between text-left rounded-md border shadow-sm px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-accent ${
          error
            ? 'border-red-400 bg-red-50'
            : 'border-border-strong bg-surface hover:bg-surface-elevated'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`truncate ${
            displayValue ? 'text-text-primary font-medium' : 'text-text-muted'
          }`}
        >
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {displayValue && !required && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as any)}
              className="text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
              title="Clear selection"
            >
              ✕
            </span>
          )}
          <span className="text-text-muted text-xs">▼</span>
        </div>
      </button>

      {helperText && (
        <p
          className={`text-xs mt-1 ${
            error ? 'text-red-600' : 'text-text-secondary'
          }`}
        >
          {helperText}
        </p>
      )}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-white border border-border-strong shadow-lg max-h-60 overflow-hidden flex flex-col">
          {/* Search Box */}
          <div className="p-2 border-b border-border-subtle bg-surface sticky top-0">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country..."
              className="w-full text-xs sm:text-sm px-2.5 py-1.5 rounded border border-border-strong focus:outline-none focus:border-accent"
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-48 py-1">
            {!required && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full text-left px-3 py-1.5 text-xs text-text-muted italic hover:bg-surface-elevated transition-colors"
              >
                Prefer not to say / Unspecified
              </button>
            )}

            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => (
                <button
                  type="button"
                  key={country.code}
                  onClick={() => handleSelect(country.code)}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 text-xs sm:text-sm hover:bg-surface-elevated transition-colors ${
                    selectedCountry?.code === country.code
                      ? 'bg-accent/10 font-semibold text-accent'
                      : 'text-text-primary'
                  }`}
                >
                  <span>{country.name}</span>
                  <span className="text-text-muted text-xs font-mono">
                    {country.code}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-xs text-text-muted text-center">
                No matching country found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

