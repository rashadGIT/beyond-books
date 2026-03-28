import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge } from '@/lib/auth-edge';

const PUBLIC_PATHS = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/confirm',
  '/api/auth/resend-code',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/google/',
  '/api/auth/email/',
  '/api/auth/debug',
  '/api/quickbooks/callback',
  '/api/scheduler/init',  // AWS EventBridge trigger
  '/api/health',
  '/_next/',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('access_token')?.value;
  const isApiRoute = pathname.startsWith('/api/');

  if (!token) {
    if (isApiRoute) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const user = await verifyTokenEdge(token);
  if (!user) {
    if (isApiRoute) return NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 });
    const response = NextResponse.redirect(new URL('/sign-in', request.url));
    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');
    response.cookies.delete('id_token');
    return response;
  }

  // Forward userId in headers for API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.sub);
  requestHeaders.set('x-user-email', user.email);
  if (user.name) requestHeaders.set('x-user-name', user.name);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
