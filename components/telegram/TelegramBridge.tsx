'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

type MiniApp = {
  initData: string
  ready:()=>void
  expand:()=>void
  isVersionAtLeast:(version:string)=>boolean
  setHeaderColor:(color:string)=>void
  setBackgroundColor:(color:string)=>void
}
declare global { interface Window { Telegram?: { WebApp: MiniApp } } }

// This flag only enables Telegram's presentation SDK. It never authenticates a user.
export function TelegramBridge() {
  const [enabled,setEnabled]=useState(false)
  useEffect(()=>{
    const launch=new URLSearchParams(window.location.hash.slice(1)).has('tgWebAppPlatform')
    try {
      if(launch) sessionStorage.setItem('dostavita-telegram-ui','1')
      setEnabled(launch || sessionStorage.getItem('dostavita-telegram-ui')==='1')
    } catch { setEnabled(launch) }
  },[])
  if(!enabled) return null
  return <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={()=>{
    const app=window.Telegram?.WebApp
    if(!app) return
    app.ready()
    app.expand()
    if(app.isVersionAtLeast('6.1')) {
      app.setHeaderColor('#ffffff')
      app.setBackgroundColor('#ffffff')
    }
  }}/>
}
