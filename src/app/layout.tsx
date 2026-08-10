import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';
import '@/styles/globals.css';

import { EmbeddingBridge } from '@/components/embedding/EmbeddingBridge';
import { EmbeddingContextProvider } from '@/context/EmbeddingContext';
import SessionProvider from '@/context/SessionProvider';
import { ThemeContextProvider } from '@/context/ThemeContext';
import { getThemes } from '@/utils/themes/themes-api';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ai-dial-generic-rag-frontend',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themes = await getThemes();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden font-sans">
        <EmbeddingContextProvider
          dialAdminUrl={process.env.DIAL_ADMIN_URL}
          applicationName={process.env.DIAL_APPLICATION_NAME}
        >
          <Suspense fallback={null}>
            <ThemeContextProvider themes={themes}>
              <EmbeddingBridge />
              <SessionProvider>{children}</SessionProvider>
            </ThemeContextProvider>
          </Suspense>
        </EmbeddingContextProvider>
      </body>
    </html>
  );
}
