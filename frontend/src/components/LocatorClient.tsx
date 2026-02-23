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

  const queryString = useMemo(() => {
    if (!viewport) return null;
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

    params.set('north', String(viewport.north));
    params.set('south', String(viewport.south));
    params.set('east', String(viewport.east));
    params.set('west', String(viewport.west));

    return params.toString();
  }, [filters, viewport, center]);

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

      <section className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-7">
        <input className="rounded-lg border border-line bg-panel p-2" placeholder="Store name" value={draftFilters.q} onChange={(e) => setDraftFilters((p) => ({ ...p, q: e.target.value }))} />
        <input className="rounded-lg border border-line bg-panel p-2" placeholder="City" value={draftFilters.city} onChange={(e) => setDraftFilters((p) => ({ ...p, city: e.target.value }))} />
        <input className="rounded-lg border border-line bg-panel p-2" placeholder="Postal" value={draftFilters.postal} onChange={(e) => setDraftFilters((p) => ({ ...p, postal: e.target.value }))} />
        <select className="rounded-lg border border-line bg-panel p-2" value={draftFilters.category} onChange={(e) => setDraftFilters((p) => ({ ...p, category: e.target.value }))}>
          <option value="all">All Categories</option>
          <option value="Store">Store</option>
          <option value="Restaurant">Restaurant</option>
          <option value="Pharmacy">Pharmacy</option>
          <option value="Pop-Up">Pop-Up</option>
          <option value="Apparel">Apparel</option>
        </select>
        <select className="rounded-lg border border-line bg-panel p-2" value={draftFilters.radius} onChange={(e) => setDraftFilters((p) => ({ ...p, radius: e.target.value }))}>
          <option value="">Any Radius</option>
          <option value="2">2 km</option>
          <option value="5">5 km</option>
          <option value="10">10 km</option>
        </select>
        <button
          className="rounded-lg border border-line bg-panel p-2"
          onClick={() => {
            navigator.geolocation?.getCurrentPosition((pos) => {
              setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            });
          }}
        >
          Use My Location
        </button>
        <button
          className="rounded-lg bg-gradient-to-r from-mint to-emerald-400 p-2 font-semibold text-ink"
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
      </section>

      <main className="grid min-h-[72vh] grid-cols-1 gap-4 md:grid-cols-[390px_1fr]">
        <aside className={`${listHidden ? 'hidden md:block' : 'block'} rounded-xl border border-line bg-panel/85 p-3`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Locations</h2>
            <span className="text-xs text-slate-300">{locations.length} results</span>
          </div>
          <ul className="grid max-h-[66vh] gap-2 overflow-y-auto pr-1">
            {locations.map((location) => (
              <li
                key={location.id}
                className={`cursor-pointer rounded-xl border p-3 ${selectedId === location.id ? 'border-mint shadow-glow' : 'border-line bg-panelAlt/30'}`}
                onClick={() => setSelectedId(location.id)}
              >
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-xs">{location.category}</span>
                <h3 className="mt-2 font-semibold">{location.store_name}</h3>
                <p className="text-sm text-slate-300">{location.address}</p>
                <p className="text-sm text-slate-400">{location.opening_hours}</p>
              </li>
            ))}
          </ul>
        </aside>

        <section className={`${!listHidden ? 'block' : 'block'} min-h-[72vh] rounded-xl border border-line`}>
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
