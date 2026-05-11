import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ authenticated: false });

  return NextResponse.json({ authenticated: true, username: admin.username });
}
