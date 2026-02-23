'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L, { LatLngBounds } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { LocationRecord } from '@/lib/types';

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconAnchor: [12, 41]
});

type BoundsShape = { north: number; south: number; east: number; west: number };

type Props = {
  locations: LocationRecord[];
  selected: LocationRecord | null;
  onSelect: (id: number) => void;
  onViewportChanged: (bounds: BoundsShape) => void;
  center: { lat: number; lng: number } | null;
};

function ViewportListener({ onViewportChanged }: { onViewportChanged: (bounds: BoundsShape) => void }) {
  const map = useMapEvents({
    moveend() {
      const b = map.getBounds();
      onViewportChanged({
        north: Number(b.getNorth().toFixed(6)),
        south: Number(b.getSouth().toFixed(6)),
        east: Number(b.getEast().toFixed(6)),
        west: Number(b.getWest().toFixed(6))
      });
    }
  });

  useEffect(() => {
    const b = map.getBounds();
    onViewportChanged({
      north: Number(b.getNorth().toFixed(6)),
      south: Number(b.getSouth().toFixed(6)),
      east: Number(b.getEast().toFixed(6)),
      west: Number(b.getWest().toFixed(6))
    });
  }, [map, onViewportChanged]);

  return null;
}

function SelectedLocationSync({ selected, center }: { selected: LocationRecord | null; center: { lat: number; lng: number } | null }) {
  const map = useMapEvents({});

  useEffect(() => {
    if (selected) {
      map.flyTo([selected.latitude, selected.longitude], 15, { duration: 0.7 });
      return;
    }

    if (center) {
      map.flyTo([center.lat, center.lng], 13, { duration: 0.7 });
    }
  }, [map, selected, center]);

  return null;
}

function FitBoundsOnData({ locations }: { locations: LocationRecord[] }) {
  const map = useMapEvents({});

  const bounds = useMemo(() => {
    if (!locations.length) return null;
    const b = new LatLngBounds([
      [locations[0].latitude, locations[0].longitude]
    ]);

    for (let i = 1; i < locations.length; i += 1) {
      b.extend([locations[i].latitude, locations[i].longitude]);
    }

    return b;
  }, [locations]);

  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds.pad(0.2));
  }, [bounds, map]);

  return null;
}

export default function MapCanvas({ locations, selected, onSelect, onViewportChanged, center }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const [mapKey] = useState(() => `map-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  return (
    <MapContainer
      key={mapKey}
      ref={mapRef}
      center={[40.7128, -74.006]}
      zoom={11}
      className="h-full w-full rounded-xl"
      zoomControl
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <ViewportListener onViewportChanged={onViewportChanged} />
      <SelectedLocationSync selected={selected} center={center} />
      <FitBoundsOnData locations={locations} />

      <MarkerClusterGroup chunkedLoading>
        {locations.map((location) => (
          <Marker
            key={location.id}
            icon={icon}
            position={[location.latitude, location.longitude]}
            eventHandlers={{ click: () => onSelect(location.id) }}
          >
            <Popup>
              <div className="space-y-1">
                <h3 className="font-semibold">{location.store_name}</h3>
                <p className="text-xs text-slate-300">{location.address}</p>
                <p className="text-xs text-slate-300">Hours: {location.opening_hours}</p>
                {location.contact ? <p className="text-xs text-slate-300">Contact: {location.contact}</p> : null}
                <a className="text-xs font-semibold text-mint" href={location.google_maps_link || `https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">
                  Get Directions
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
