import React from 'react'
import Head from 'next/head'
import Login from '../components/Login'

export default function HomePage() {
  return (
    <React.Fragment>
      <Head>
        <title>Time Tracking</title>
      </Head>
      <Login />
    </React.Fragment>
  )
}
