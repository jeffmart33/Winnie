import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { haversineKm } from '@/lib/server/locations';

export const runtime = 'nodejs';

type LocationRow = {
  id: number;
  store_name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  opening_hours: string;
  contact: string | null;
  google_maps_link: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const postal = (searchParams.get('postal') || '').trim().toLowerCase();
    const city = (searchParams.get('city') || '').trim().toLowerCase();
    const category = (searchParams.get('category') || '').trim();

    const radiusRaw = searchParams.get('radius');
    const centerLatRaw = searchParams.get('lat');
    const centerLngRaw = searchParams.get('lng');

    const northRaw = searchParams.get('north');
    const southRaw = searchParams.get('south');
    const eastRaw = searchParams.get('east');
    const westRaw = searchParams.get('west');

    const radiusKm = radiusRaw ? Number(radiusRaw) : null;
    const centerLat = centerLatRaw ? Number(centerLatRaw) : null;
    const centerLng = centerLngRaw ? Number(centerLngRaw) : null;
    const north = northRaw ? Number(northRaw) : null;
    const south = southRaw ? Number(southRaw) : null;
    const east = eastRaw ? Number(eastRaw) : null;
    const west = westRaw ? Number(westRaw) : null;

    let sql = 'SELECT * FROM locations WHERE deleted_at IS NULL AND status = ?';
    const params: Array<string | number> = ['active'];

    if (q) {
      sql += ' AND (LOWER(store_name) LIKE ? OR LOWER(address) LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    if (postal) {
      sql += ' AND LOWER(address) LIKE ?';
      params.push(`%${postal}%`);
    }

    if (city) {
      sql += ' AND LOWER(address) LIKE ?';
      params.push(`%${city}%`);
    }

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (
      north !== null &&
      south !== null &&
      east !== null &&
      west !== null &&
      !Number.isNaN(north) &&
      !Number.isNaN(south) &&
      !Number.isNaN(east) &&
      !Number.isNaN(west)
    ) {
      sql += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
      params.push(Math.min(south, north), Math.max(south, north), Math.min(west, east), Math.max(west, east));
    }

    sql += ' ORDER BY store_name ASC';

    let locations = await db.all<LocationRow>(sql, params);

    if (
      radiusKm !== null &&
      !Number.isNaN(radiusKm) &&
      centerLat !== null &&
      centerLng !== null &&
      !Number.isNaN(centerLat) &&
      !Number.isNaN(centerLng)
    ) {
      locations = locations
        .map((loc) => ({
          ...loc,
          distance_km: haversineKm(centerLat, centerLng, loc.latitude, loc.longitude)
        }))
        .filter((loc) => loc.distance_km <= radiusKm)
        .sort((a, b) => a.distance_km - b.distance_km);
    }

    return NextResponse.json({ data: locations });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}
