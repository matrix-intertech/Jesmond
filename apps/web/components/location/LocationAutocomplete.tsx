'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, X, Loader2 } from 'lucide-react';

export interface LocationResult {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  country: string;
  state: string;
  city: string;
  suburb: string;
  postcode: string;
  type: string;
  source: string;
}

interface LocationAutocompleteProps {
  value?: LocationResult | null;
  onChange: (location: LocationResult | null) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Search suburb, address or postcode',
  className = '',
  autoFocus = false
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value?.label || '');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Custom hook implementation if not available
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync value prop changes if it changes externally
  useEffect(() => {
    if (value && value.label !== query) {
      setQuery(value.label);
    } else if (!value && query && !isOpen) {
      // Don't clear query if user is currently typing
    }
  }, [value]);

  // Fetch results
  useEffect(() => {
    const fetchResults = async () => {
      if (debouncedQuery.length < 3) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      // If the query perfectly matches the selected value, we don't need to search again
      if (value && debouncedQuery === value.label) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/locations/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`);
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        setResults(data);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('Location search error:', err);
        setError('Failed to load suggestions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  const handleSelect = (location: LocationResult) => {
    setQuery(location.label);
    setResults([]);
    setIsOpen(false);
    onChange(location);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    onChange(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <MapPin className="absolute left-3 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          placeholder={placeholder}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            if (value && e.target.value !== value.label) {
              onChange(null); // Clear actual selection if user modifies the text
            }
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="location-suggestions"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 w-5 h-5 text-blue-500 animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear location"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {isOpen && (query.length >= 3) && (
        <div
          id="location-suggestions"
          className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden"
        >
          {results.length > 0 ? (
            <ul className="max-h-60 overflow-auto py-1">
              {results.map((result, index) => (
                <li
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className={`px-4 py-3 flex items-start cursor-pointer transition-colors ${
                    index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <MapPin className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${index === selectedIndex ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900 line-clamp-1">{result.label}</span>
                    <span className="text-xs text-gray-500 capitalize">{result.type.replace('_', ' ')} • {result.postcode || result.state || result.country}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : !isLoading ? (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              No locations found matching "{query}"
            </div>
          ) : null}
          {error && !isLoading && (
            <div className="px-4 py-3 text-sm text-red-500 bg-red-50">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
