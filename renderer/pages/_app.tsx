import React from 'react'
import type { AppProps } from 'next/app'
import { SessionProvider } from "next-auth/react"

import { useAuthSync } from '../components/hooks/use-auth-sync'
import { QueryProvider } from '../providers/query-provider'
import { Toaster } from '../components/ui/sonner'
import '../styles/globals.css'

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <QueryProvider>
      <SessionProvider session={session}>
        <AuthSyncWrapper>
          <Component {...pageProps} />
          <Toaster richColors />
        </AuthSyncWrapper>
      </SessionProvider>
    </QueryProvider>
  )
}

function AuthSyncWrapper({ children }: { children: React.ReactNode }) {
  useAuthSync();
  return <>{children}</>;
}


export default MyApp
