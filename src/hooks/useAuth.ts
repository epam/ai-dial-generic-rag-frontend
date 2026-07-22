'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef } from 'react';

import { AUTH_WINDOW_CLOSE_KEY } from '@/lib/auth/constants';

export const useAuth = () => {
  const { data: session, status: sessionStatus } = useSession();
  const authWindowRef = useRef<Window | null>(null);

  const login = useCallback(() => {
    if (authWindowRef.current && !authWindowRef.current.closed) {
      authWindowRef.current.focus();
      return;
    }

    const provider =
      new URLSearchParams(window.location.search).get('authProvider') ??
      process.env.NEXT_PUBLIC_AUTH_PROVIDER;
    const url = provider
      ? `/signin?authProvider=${encodeURIComponent(provider)}`
      : '/signin';

    authWindowRef.current = window.open(url, '_blank', 'width=600,height=600');
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === AUTH_WINDOW_CLOSE_KEY) {
        window.location.reload();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return { session, sessionStatus, login };
};
