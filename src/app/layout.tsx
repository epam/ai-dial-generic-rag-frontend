import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';
import '@/styles/globals.css';

import { EmbeddingBridge } from '@/components/embedding/EmbeddingBridge';
import SessionProvider from '@/context/SessionProvider';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Suspense fallback={null}>
          <EmbeddingBridge />
        </Suspense>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
