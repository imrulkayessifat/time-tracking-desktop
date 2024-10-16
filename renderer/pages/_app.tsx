import React from 'react'
import type { AppProps } from 'next/app'
import { SessionProvider } from "next-auth/react"

import { QueryProvider } from '../providers/query-provider'
import '../styles/globals.css'

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {

  return (
    <QueryProvider>
      <SessionProvider session={session}>
        <Component {...pageProps} />
      </SessionProvider>
    </QueryProvider>
  )
}

export default MyApp
