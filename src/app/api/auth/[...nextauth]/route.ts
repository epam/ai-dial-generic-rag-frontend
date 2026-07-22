import NextAuth from 'next-auth';

import { nextauthOptions } from '@/lib/auth/auth-callbacks';

const handler = NextAuth(nextauthOptions);

export { handler as GET, handler as POST };
