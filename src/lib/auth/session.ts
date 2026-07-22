import { Session } from 'next-auth';

export const isClientSessionValid = (session: Session | null): boolean =>
  !!session &&
  session.error !== 'RefreshAccessTokenError' &&
  session.error !== 'NoClientForProvider';
