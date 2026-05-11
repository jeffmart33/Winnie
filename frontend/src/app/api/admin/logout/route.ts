import { NextRequest, NextResponse } from 'next/server';
import { clearAdminCookie, requireAdmin } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  clearAdminCookie(response);
  return response;
}
