import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge } from '@/lib/auth-edge';

const PUBLIC_PATHS = [
  '/sign-in',
  '/sign-up',
  '/api/auth/',
  '/api/quickbooks/callback',
  '/api/scheduler/init',  // AWS EventBridge trigger
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

  if (!token) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const user = await verifyTokenEdge(token);
  if (!user) {
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
