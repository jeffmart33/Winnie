import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { issueAdminToken, setAdminCookie } from '@/lib/server/auth';

export const runtime = 'nodejs';

type AdminRow = {
  id: number;
  username: string;
  password_hash: string;
};

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
    }

    const db = await getDb();
    const admin = await db.get<AdminRow>('SELECT * FROM admins WHERE username = ?', [username]);

    if (!admin) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const valid = await bcrypt.compare(password, String(admin.password_hash));
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const token = await issueAdminToken({ adminId: admin.id, username: admin.username });
    const response = NextResponse.json({ ok: true, username: admin.username });
    setAdminCookie(response, token);
    return response;
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
