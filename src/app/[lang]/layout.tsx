import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

import { SignInGate } from '@/components/SignInGate';
import { locales } from '@/constants/locales';
import { getIsEnableAuthToggle } from '@/lib/auth/get-auth-toggle';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  if (!locales.includes(lang)) {
    notFound();
  }

  return (
    <SignInGate authEnabled={getIsEnableAuthToggle()}>{children}</SignInGate>
  );
}
