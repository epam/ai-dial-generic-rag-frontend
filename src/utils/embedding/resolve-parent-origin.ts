import { createLogger } from '@/utils/logger';

const logger = createLogger('embedding:parent-origin');

/**
 * Resolves the embedding parent's origin, preferring `ancestorOrigins`, then
 * `document.referrer`, then the `NEXT_PUBLIC_DIAL_ADMIN_URL` env var as a dev/fallback.
 * @returns The parent origin, or `undefined` if none could be resolved.
 */
export function resolveParentOrigin(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const ancestorOrigin = window.location.ancestorOrigins?.[0];
  if (ancestorOrigin) {
    logger.debug('resolved parent origin from ancestorOrigins', {
      ancestorOrigin,
    });
    return ancestorOrigin;
  }

  if (document.referrer) {
    try {
      const referrerOrigin = new URL(document.referrer).origin;
      logger.debug('resolved parent origin from document.referrer', {
        referrer: document.referrer,
        referrerOrigin,
      });
      return referrerOrigin;
    } catch (error) {
      logger.warn('document.referrer is not a valid URL, ignoring it', {
        referrer: document.referrer,
        error,
      });
    }
  }

  const fallback = process.env.NEXT_PUBLIC_DIAL_ADMIN_URL || undefined;
  if (fallback) {
    logger.debug(
      'resolved parent origin from NEXT_PUBLIC_DIAL_ADMIN_URL fallback',
      {
        fallback,
      },
    );
  } else {
    logger.warn(
      'could not resolve a parent origin (no ancestorOrigins, no referrer, no fallback env var)',
    );
  }

  return fallback;
}
