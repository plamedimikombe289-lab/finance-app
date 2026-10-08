import { createContext, useContext, useState, useCallback } from 'react'
import { authApi } from '../api'
import { formatMontant, formatMontantParts } from '../utils/format'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('finance_user')) } catch { return null }
  })

  const [isImpersonating, setIsImpersonating] = useState(
    () => !!localStorage.getItem('admin_token_backup')
  )

  const login = useCallback((userData, token) => {
    localStorage.setItem('finance_token', token)
    localStorage.setItem('finance_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('finance_token')
    localStorage.removeItem('finance_user')
    localStorage.removeItem('admin_token_backup')
    localStorage.removeItem('admin_user_backup')
    setUser(null)
    setIsImpersonating(false)
  }, [])

  const startImpersonation = useCallback((userData, token) => {
    // Sauvegarde les identifiants admin
    localStorage.setItem('admin_token_backup', localStorage.getItem('finance_token') || '')
    localStorage.setItem('admin_user_backup',  localStorage.getItem('finance_user')  || '')
    // Active le compte cible
    localStorage.setItem('finance_token', token)
    localStorage.setItem('finance_user',  JSON.stringify(userData))
    setUser(userData)
    setIsImpersonating(true)
  }, [])

  const exitImpersonation = useCallback(() => {
    const adminToken = localStorage.getItem('admin_token_backup') || ''
    const adminUser  = localStorage.getItem('admin_user_backup')  || 'null'
    localStorage.setItem('finance_token', adminToken)
    localStorage.setItem('finance_user',  adminUser)
    localStorage.removeItem('admin_token_backup')
    localStorage.removeItem('admin_user_backup')
    try { setUser(JSON.parse(adminUser)) } catch { setUser(null) }
    setIsImpersonating(false)
  }, [])

  const updateDevise = useCallback(async (devise) => {
    await authApi.updateDevise({ devise })
    const updated = { ...user, devise }
    localStorage.setItem('finance_user', JSON.stringify(updated))
    setUser(updated)
  }, [user])

  const completeOnboarding = useCallback(async () => {
    await authApi.completerOnboarding()
    const updated = { ...user, onboarding_complete: 1 }
    localStorage.setItem('finance_user', JSON.stringify(updated))
    setUser(updated)
  }, [user])

  const fmt      = useCallback((amount) => formatMontant(amount, user?.devise || 'CAD'), [user?.devise])
  const fmtParts = useCallback((amount) => formatMontantParts(amount, user?.devise || 'CAD'), [user?.devise])

  const isAdmin = user?.role === 'admin'
  const isAuth  = !!user

  return (
    <AuthContext.Provider value={{
      user, login, logout, isAdmin, isAuth, fmt, fmtParts,
      updateDevise, completeOnboarding,
      isImpersonating, startImpersonation, exitImpersonation,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
