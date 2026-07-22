import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { defaultLocale } from '@/constants/locales';

/**
 * Proxy (Next 16's renamed `middleware`). Redirects `/` to the default locale,
 * and sets the CSP `frame-ancestors` header so DIAL Admin can frame this app
 * (via `ALLOWED_FRAME_ANCESTORS`; defaults to `'none'`).
 */
export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  const allowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS || "'none'";
  response.headers.set(
    'Content-Security-Policy',
    `frame-ancestors ${allowedFrameAncestors}`,
  );
  return response;
}

/** Runs on every route except API, Next internals, and metadata files. */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
