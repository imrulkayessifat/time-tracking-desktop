import React from 'react'
import Head from 'next/head'
import Login from '../components/Login'

export default function HomePage() {

  return (
    <React.Fragment>
      <Head>
        <title>Staff Time Tracker</title>
      </Head>
      <Login />
    </React.Fragment>
  )
}


