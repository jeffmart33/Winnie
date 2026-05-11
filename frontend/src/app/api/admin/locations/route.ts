import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAdmin } from '@/lib/server/auth';
import { enrichLocationFromGeo, normalizeLocationPayload, validateRequired } from '@/lib/server/locations';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const showDeleted = searchParams.get('showDeleted') === 'true';

    let sql = 'SELECT * FROM locations';
    if (!showDeleted) sql += ' WHERE deleted_at IS NULL';
    sql += ' ORDER BY updated_at DESC';

    const locations = await db.all(sql);
    return NextResponse.json({ data: locations });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch admin locations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    let location = normalizeLocationPayload(body);
    const validationError = validateRequired(location);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    location = await enrichLocationFromGeo(location);

    const db = await getDb();
    const result = await db.run(
      `INSERT INTO locations
      (store_name, category, address, latitude, longitude, opening_hours, contact, google_maps_link, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        location.store_name,
        location.category,
        location.address,
        location.latitude,
        location.longitude,
        location.opening_hours,
        location.contact,
        location.google_maps_link,
        location.status
      ]
    );

    const created = await db.get('SELECT * FROM locations WHERE id = ?', [result.lastID]);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create location';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
