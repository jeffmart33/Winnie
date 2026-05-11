'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { LocationRecord } from '@/lib/types';
import { api } from '@/lib/api';

const MapCanvas = dynamic(() => import('./MapCanvas'), { ssr: false });

type FilterState = {
  q: string;
  city: string;
  postal: string;
  category: string;
  radius: string;
};

const initialFilters: FilterState = {
  q: '',
  city: '',
  postal: '',
  category: 'all',
  radius: ''
};

export default function LocatorClient() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(initialFilters);
  const [listHidden, setListHidden] = useState(false);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewport, setViewport] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hasActiveFilters =
    Boolean(filters.q.trim()) ||
    Boolean(filters.city.trim()) ||
    Boolean(filters.postal.trim()) ||
    (filters.category && filters.category !== 'all') ||
    Boolean(filters.radius);

  const queryString = useMemo(() => {
    if (!viewport && !hasActiveFilters) return null;
    const params = new URLSearchParams();

    if (filters.q.trim()) params.set('q', filters.q.trim());
    if (filters.city.trim()) params.set('city', filters.city.trim());
    if (filters.postal.trim()) params.set('postal', filters.postal.trim());
    if (filters.category) params.set('category', filters.category);

    if (filters.radius) {
      params.set('radius', filters.radius);
      if (center) {
        params.set('lat', String(center.lat));
        params.set('lng', String(center.lng));
      }
    }

    if (viewport && !hasActiveFilters) {
      params.set('north', String(viewport.north));
      params.set('south', String(viewport.south));
      params.set('east', String(viewport.east));
      params.set('west', String(viewport.west));
    }

    return params.toString();
  }, [filters, viewport, center, hasActiveFilters]);

  useEffect(() => {
    if (!queryString) return;

    api<{ data: LocationRecord[] }>(`/api/locations?${queryString}`)
      .then((payload) => setLocations(payload.data || []))
      .catch(() => setLocations([]));
  }, [queryString]);

  const onViewportChanged = (bounds: { north: number; south: number; east: number; west: number }) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setViewport(bounds), 200);
  };

  const selected = locations.find((item) => item.id === selectedId) || null;
  const appliedSummary = useMemo(() => {
    const parts: string[] = [];

    if (filters.q.trim()) parts.push(`Name: ${filters.q.trim()}`);
    if (filters.city.trim()) parts.push(`City: ${filters.city.trim()}`);
    if (filters.postal.trim()) parts.push(`Postal: ${filters.postal.trim()}`);
    if (filters.category && filters.category !== 'all') parts.push(`Category: ${filters.category}`);
    if (filters.radius) parts.push(`Radius: ${filters.radius} km`);

    return parts.join(' · ');
  }, [filters]);

  const badgeClassForCategory = (category: string) => {
    switch (category.toLowerCase()) {
      case 'apparel':
        return 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200';
      case 'store':
        return 'border-blue-400/40 bg-blue-500/15 text-blue-200';
      case 'pharmacy':
        return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
      case 'restaurant':
        return 'border-amber-400/40 bg-amber-500/15 text-amber-200';
      case 'pop-up':
        return 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200';
      default:
        return 'border-slate-400/40 bg-slate-500/10 text-slate-200';
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] text-mint">Find A Healthy Spot</p>
          <h1 className="text-2xl font-semibold">Store Locator</h1>
        </div>
        <button
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm md:hidden"
          onClick={() => setListHidden((prev) => !prev)}
        >
          Toggle List/Map
        </button>
      </header>

      <main className="grid min-h-[72vh] grid-cols-1 gap-4 md:grid-cols-[380px_1fr]">
        <aside className={`${listHidden ? 'hidden md:block' : 'block'} space-y-3 rounded-2xl border border-line bg-panel/85 p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-panelAlt/60 text-mint">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 3c-3.3 0-6 2.7-6 6 0 4.2 5.2 10.2 5.4 10.4a1 1 0 0 0 1.2 0C12.8 19.2 18 13.2 18 9c0-3.3-2.7-6-6-6Zm0 8.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-lg font-semibold">Locations</h2>
                <p className="text-xs text-slate-400">{locations.length} of {locations.length} shown</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-panelAlt/40 px-3 py-2">
            <div className="flex items-center gap-2 text-slate-300">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l3.2 3.2-1.4 1.4-3.2-3.2A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
                />
              </svg>
              <input
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
                placeholder="Search by name, city, or postal code..."
                value={draftFilters.q}
                onChange={(e) => setDraftFilters((p) => ({ ...p, q: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select className="rounded-xl border border-line bg-panelAlt/40 p-2 text-sm" value={draftFilters.category} onChange={(e) => setDraftFilters((p) => ({ ...p, category: e.target.value }))}>
              <option value="all">All Categories</option>
              <option value="Store">Store</option>
              <option value="Restaurant">Restaurant</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Pop-Up">Pop-Up</option>
              <option value="Apparel">Apparel</option>
            </select>
            <select className="rounded-xl border border-line bg-panelAlt/40 p-2 text-sm" value={draftFilters.radius} onChange={(e) => setDraftFilters((p) => ({ ...p, radius: e.target.value }))}>
              <option value="">Any Distance</option>
              <option value="2">2 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="rounded-xl border border-line bg-panelAlt/40 p-2 text-sm"
              onClick={() => {
                navigator.geolocation?.getCurrentPosition((pos) => {
                  setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                });
              }}
            >
              Use My Location
            </button>
            <button
              className="rounded-xl bg-gradient-to-r from-mint to-emerald-400 p-2 text-sm font-semibold text-ink"
              onClick={async () => {
                try {
                  await api('/api/filter-applications', 'POST', {
                    ...draftFilters,
                    centerLat: center ? center.lat : null,
                    centerLng: center ? center.lng : null
                  });
                } catch {
                  // Keep UI responsive even if analytics write fails.
                }
                setFilters({ ...draftFilters });
              }}
            >
              Apply
            </button>
          </div>

          {appliedSummary ? (
            <p className="rounded-xl border border-line bg-panelAlt/40 px-3 py-2 text-xs text-slate-200">
              {appliedSummary}
            </p>
          ) : null}

          <ul className="grid max-h-[62vh] gap-3 overflow-y-auto pr-1">
            {locations.map((location) => (
              <li
                key={location.id}
                className={`cursor-pointer rounded-2xl border p-4 ${selectedId === location.id ? 'border-mint shadow-glow' : 'border-line bg-panelAlt/30'}`}
                onClick={() => setSelectedId(location.id)}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{location.store_name}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${badgeClassForCategory(location.category)}`}>
                    {location.category}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-300">
                  <p className="flex items-center gap-2">
                    <span className="text-slate-400">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 3c-3.3 0-6 2.7-6 6 0 4.2 5.2 10.2 5.4 10.4a1 1 0 0 0 1.2 0C12.8 19.2 18 13.2 18 9c0-3.3-2.7-6-6-6Zm0 8.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z"
                        />
                      </svg>
                    </span>
                    {location.address}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-slate-400">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 6a1 1 0 0 1 1 1v4.2l2.8 1.6a1 1 0 1 1-1 1.8L11 12.3V7a1 1 0 0 1 1-1Zm0-4a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"
                        />
                      </svg>
                    </span>
                    {location.opening_hours}
                  </p>
                  {location.contact ? (
                    <p className="flex items-center gap-2">
                      <span className="text-slate-400">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M20.6 14.6a1 1 0 0 1-.3.7l-2.4 2.4a2.5 2.5 0 0 1-2.6.6 16.7 16.7 0 0 1-6.1-4 16.7 16.7 0 0 1-4-6.1 2.5 2.5 0 0 1 .6-2.6l2.4-2.4a1 1 0 0 1 1.6.4l1.1 3.1a1 1 0 0 1-.2 1L8.9 9.6a12.2 12.2 0 0 0 5.5 5.5l1.9-1.9a1 1 0 0 1 1-.2l3.1 1.1a1 1 0 0 1 .6.9Z"
                          />
                        </svg>
                      </span>
                      {location.contact}
                    </p>
                  ) : null}
                </div>
                <a
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-mint"
                  href={location.google_maps_link || `https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M21 3 2 10l7 2 2 7 10-16ZM9.7 12.3 17 7l-5.3 7.3Z"
                    />
                  </svg>
                  Get Directions
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <section className={`${!listHidden ? 'block' : 'block'} min-h-[72vh] rounded-2xl border border-line`}>
          <MapCanvas
            locations={locations}
            selected={selected}
            onSelect={(id) => setSelectedId(id)}
            onViewportChanged={onViewportChanged}
            center={center}
          />
        </section>
      </main>
    </div>
  );
}
