import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

interface Profile {
  id: string
  email: string
  name: string | null
  role: string
}

interface AuthContextType {
  profile: Profile | null
  loading: boolean
  signIn: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/auth/status`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.profile) {
          setProfile(data.profile)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(() => {
    window.location.href = `${API_BASE}/auth/google/admin`
  }, [])

  const signOut = useCallback(() => {
    window.location.href = `${API_BASE}/auth/logout`
  }, [])

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
