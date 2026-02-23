import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAdmin } from '@/lib/server/auth';
import { enrichLocationFromGeo, normalizeLocationPayload, validateRequired } from '@/lib/server/locations';

export const runtime = 'nodejs';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await request.json();
    let location = normalizeLocationPayload(body);
    const validationError = validateRequired(location);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    location = await enrichLocationFromGeo(location);

    const db = await getDb();
    const existing = await db.get('SELECT id FROM locations WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!existing) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

    await db.run(
      `UPDATE locations SET
        store_name = ?,
        category = ?,
        address = ?,
        latitude = ?,
        longitude = ?,
        opening_hours = ?,
        contact = ?,
        google_maps_link = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        location.store_name,
        location.category,
        location.address,
        location.latitude,
        location.longitude,
        location.opening_hours,
        location.contact,
        location.google_maps_link,
        location.status,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM locations WHERE id = ?', [id]);
    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update location';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const db = await getDb();
    const existing = await db.get('SELECT id FROM locations WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!existing) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

    await db.run('UPDATE locations SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 });
  }
}
