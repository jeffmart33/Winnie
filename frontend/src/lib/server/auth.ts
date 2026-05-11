import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

const COOKIE_NAME = 'admin_token';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

function jwtSecret() {
  return new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'replace-this-admin-jwt-secret');
}

type AdminPayload = {
  adminId: number;
  username: string;
};

export async function issueAdminToken(payload: AdminPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(jwtSecret());
}

export async function verifyAdminToken(token: string) {
  const result = await jwtVerify(token, jwtSecret());
  return result.payload as unknown as AdminPayload;
}

export function setAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8
  });
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
}

export async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await verifyAdminToken(token);
  } catch {
    return null;
  }
}
