'use client';

import { redirect, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Suspense, useCallback, useEffect } from 'react';

import { defaultLocale } from '@/constants/locales';
import { AUTH_WINDOW_CLOSE_KEY } from '@/lib/auth/constants';
import { SessionStatus } from '@/lib/auth/types';

const SignInFlow = () => {
  const session = useSession();
  const searchParams = useSearchParams();

  const closePage = () => {
    window.opener?.postMessage({ type: AUTH_WINDOW_CLOSE_KEY }, '*');
    window.close();
  };

  const updateSession = useCallback(async () => {
    const updatedSession = await session.update();
    if (updatedSession && !updatedSession.error) {
      closePage();
    }
  }, [session]);

  useEffect(() => {
    if (!window.opener) {
      return redirect(`/${defaultLocale}`);
    }

    if (
      session.status !== SessionStatus.Loading &&
      (session.data?.error || !session.data)
    ) {
      const authProvider = searchParams.get('authProvider');
      // Without a provider, signIn() would recurse via pages.signIn ('/signin').
      if (!authProvider) {
        closePage();
        return;
      }
      signIn(authProvider, {
        callbackUrl: `${window.location.href}&redirect=true`,
      });
      return;
    }

    if (session.status === SessionStatus.Authenticated) {
      if (searchParams.get('redirect')) {
        closePage();
      } else {
        updateSession();
      }
    }
  }, [session, searchParams, updateSession]);

  return null;
};

const SignInPage = () => (
  <Suspense fallback={null}>
    <SignInFlow />
  </Suspense>
);

export default SignInPage;
