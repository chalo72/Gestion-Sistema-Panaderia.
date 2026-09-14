import { useEffect, useState, useCallback } from "react"

export type Theme = "dark" | "light" | "system"

export interface UseThemeProps {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

/**
 * useTheme - Hook personalizado para gestión de temas (Dark/Light)
 * Diseño Antigravity Nexus Core Protocol
 */
export function useTheme(): UseThemeProps {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Intentar recuperar de localStorage
    const saved = localStorage.getItem("theme") as Theme
    if (saved) return saved
    
    // Fallback a sistema o light
    return "system"
  })

  const applyTheme = useCallback((targetTheme: Theme) => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    let effectiveTheme = targetTheme
    if (targetTheme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    }

    root.classList.add(effectiveTheme)
    
    // Forzar actualización de color de fondo para evitar "flicker" blanco
    document.body.style.backgroundColor = effectiveTheme === 'dark' ? '#0f172a' : '#f8fafc'
  }, [])

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem("theme", theme)
    
    // Escuchar cambios en el sistema si el tema es 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = () => applyTheme("system")
      
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, applyTheme])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark')
  }, [])

  return {
    theme,
    setTheme: setThemeState,
    toggleTheme
  }
}
