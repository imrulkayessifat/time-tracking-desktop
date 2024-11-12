import React from 'react'
import type { AppProps } from 'next/app'
import { Nunito } from 'next/font/google';

import { cn } from '../lib/utils';
import { useAuthSync } from '../components/hooks/use-auth-sync'
import { QueryProvider } from '../providers/query-provider'
import { Toaster } from '../components/ui/sonner'
import '../styles/globals.css'


const nunito = Nunito({
  subsets: ['latin'], // Add 'latin' or other subsets if needed
  weight: ['400', '700'], // Optional: specify weights you need
});


function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <QueryProvider>
        <AuthSyncWrapper>
          <main className={cn(nunito.className,"w-full h-full")}>
            <Component {...pageProps} />
          </main>
          <Toaster richColors />
        </AuthSyncWrapper>
    </QueryProvider>
  )
}

function AuthSyncWrapper({ children }: { children: React.ReactNode }) {
  useAuthSync();
  return <>{children}</>;
}


export default MyApp
