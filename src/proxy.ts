import { NextResponse } from 'next/server';

/**
 * Sets the CSP `frame-ancestors` header, allowing this app to be framed by `ALLOWED_FRAME_ANCESTORS`.
 * @returns The response with the CSP header applied.
 */
export function proxy() {
  const response = NextResponse.next();
  const allowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS || "'none'";
  response.headers.set(
    'Content-Security-Policy',
    `frame-ancestors ${allowedFrameAncestors}`,
  );
  return response;
}

/** Runs the proxy on every route except static assets and metadata files. */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
