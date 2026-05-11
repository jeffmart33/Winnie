import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAdmin } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await request.json();
    const status = body.status === 'inactive' ? 'inactive' : 'active';

    const db = await getDb();
    const existing = await db.get('SELECT id FROM locations WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!existing) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

    await db.run('UPDATE locations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    const updated = await db.get('SELECT * FROM locations WHERE id = ?', [id]);

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update status' }, { status: 400 });
  }
}
