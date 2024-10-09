import React from 'react'
import Head from 'next/head'
import Main from '../components/Main'

export default function HomePage() {
  return (
    <React.Fragment>
      <Head>
        <title>Time Tracking</title>
      </Head>
      <Main />
    </React.Fragment>
  )
}
