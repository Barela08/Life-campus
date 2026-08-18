import React, { createContext, useContext, useEffect, useState } from 'react'
import api from '../lib/api'

interface BrandingCtx {
  systemName: string
  systemLogo: string
  maintenanceMode: boolean
  refreshBranding: () => Promise<void>
}

const Ctx = createContext<BrandingCtx>({
  systemName: 'LifeOS Smart Campus',
  systemLogo: '',
  maintenanceMode: false,
  refreshBranding: async () => {},
})

function formatLogoUrl(url: string) {
  if (!url) return ''
  if (url.startsWith('data:') || url.startsWith('http')) return url
  return `https://life-campus.onrender.com${url.startsWith('/') ? '' : '/'}${url}`
}

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemName, setSystemName] = useState('LifeOS Smart Campus')
  const [systemLogo, setSystemLogo] = useState('')
  const [maintenanceMode, setMaintenanceMode] = useState(false)

  const refreshBranding = async () => {
    try {
      const res = await api.get('/auth/branding')
      if (res.data.system_name) {
        setSystemName(res.data.system_name)
        document.title = res.data.system_name
      }
      if (res.data.system_logo !== undefined) {
        setSystemLogo(formatLogoUrl(res.data.system_logo || ''))
      }
      if (res.data.maintenance_mode !== undefined) {
        const isMaint = String(res.data.maintenance_mode).toLowerCase() === 'true' || String(res.data.maintenance_mode) === '1'
        setMaintenanceMode(isMaint)
      }
    } catch {
      // Use defaults if offline
    }
  }

  useEffect(() => {
    void refreshBranding()
    // Other open portals pick up an admin's maintenance-mode change without
    // requiring a manual refresh.
    const timer = window.setInterval(() => void refreshBranding(), 5000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <Ctx.Provider value={{ systemName, systemLogo, maintenanceMode, refreshBranding }}>
      {children}
    </Ctx.Provider>
  )
}

export const useBranding = () => useContext(Ctx)
