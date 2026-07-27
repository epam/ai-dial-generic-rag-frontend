'use client';

import {
  ButtonAppearance,
  ButtonVariant,
  DialButton,
  DialLoader,
} from '@epam/ai-dial-ui-kit';
import { ReactNode } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { isClientSessionValid } from '@/utils/auth/session';
import { SessionStatus } from '@/utils/auth/types';

interface SignInGateProps {
  authEnabled: boolean;
  children: ReactNode;
}

export const SignInGate = ({ authEnabled, children }: SignInGateProps) => {
  const { session, sessionStatus, login } = useAuth();

  if (!authEnabled) {
    return <>{children}</>;
  }

  if (sessionStatus === SessionStatus.Loading) {
    return (
      <div className="flex h-full w-full flex-1 items-center justify-center p-8">
        <DialLoader size={50} />
      </div>
    );
  }

  if (
    sessionStatus === SessionStatus.Authenticated &&
    isClientSessionValid(session)
  ) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full w-full flex-1 items-center justify-center p-8">
      <DialButton
        variant={ButtonVariant.Neutral}
        appearance={ButtonAppearance.Outlined}
        label="Login"
        onClick={login}
      />
    </div>
  );
};
