import React, { createContext, useContext, useEffect, useState } from 'react'

interface ThemeCtx {
  dark: boolean
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} })

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dark, setDark] = useState(() => localStorage.getItem('lifeos_theme') === 'dark')

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('lifeos_theme', dark ? 'dark' : 'light')
  }, [dark])

  return <Ctx.Provider value={{ dark, toggle: () => setDark(!dark) }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
