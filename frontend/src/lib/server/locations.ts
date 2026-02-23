import { geocodeAddress, reverseGeocode } from './geocode';

export type LocationPayload = {
  store_name: string;
  category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  opening_hours: string;
  contact: string | null;
  google_maps_link: string | null;
  status: 'active' | 'inactive';
};

export function normalizeLocationPayload(payload: Record<string, unknown>): LocationPayload {
  return {
    store_name: String(payload.store_name || '').trim(),
    category: String(payload.category || '').trim(),
    address: String(payload.address || '').trim(),
    latitude:
      payload.latitude === undefined || payload.latitude === null || payload.latitude === ''
        ? null
        : Number(payload.latitude),
    longitude:
      payload.longitude === undefined || payload.longitude === null || payload.longitude === ''
        ? null
        : Number(payload.longitude),
    opening_hours: String(payload.opening_hours || '').trim(),
    contact: String(payload.contact || '').trim() || null,
    google_maps_link: String(payload.google_maps_link || '').trim() || null,
    status: payload.status === 'inactive' ? 'inactive' : 'active'
  };
}

export function validateRequired(location: LocationPayload) {
  const requiredFields = ['store_name', 'category', 'opening_hours'] as const;
  for (const field of requiredFields) {
    if (!location[field]) {
      return `${field} is required`;
    }
  }

  if (location.latitude !== null && Number.isNaN(location.latitude)) return 'latitude must be numeric';
  if (location.longitude !== null && Number.isNaN(location.longitude)) return 'longitude must be numeric';

  return null;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function enrichLocationFromGeo(location: LocationPayload) {
  const hasAddress = Boolean(location.address);
  const hasCoords = location.latitude !== null && location.longitude !== null;

  if (!hasAddress && !hasCoords) {
    throw new Error('Either address or latitude/longitude is required');
  }

  if (hasAddress && !hasCoords) {
    const result = await geocodeAddress(location.address);
    location.latitude = result.latitude;
    location.longitude = result.longitude;
    location.address = result.formattedAddress;
  }

  if (!hasAddress && hasCoords) {
    const result = await reverseGeocode(location.latitude!, location.longitude!);
    location.address = result.formattedAddress;
  }

  if (!location.google_maps_link) {
    location.google_maps_link = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  }

  return location;
}
