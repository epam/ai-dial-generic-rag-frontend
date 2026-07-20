import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { defaultLocale } from '@/constants/locales';

// Next 16 renamed `middleware` to `proxy`. Redirects `/` to the default locale
// and sets the CSP frame-ancestors that lets DIAL Admin embed this app.
export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}`;
    return NextResponse.redirect(url);
  }

  const cspHeader = `frame-ancestors ${process.env.ALLOWED_FRAME_ANCESTORS ?? "'none'"};`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
