import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]   = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState(null)
  const [resendLoading, setResendLoading]     = useState(false)
  const [resendMsg, setResendMsg]             = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setUnverifiedEmail(null)
    setResendMsg(null)
    setLoading(true)
    try {
      const { user, token } = await authApi.login(form)
      login(user, token)
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
    } catch (e) {
      if (e.email_non_verifie) {
        setUnverifiedEmail(e.email || form.email)
      }
      setError(e.message || 'Identifiants incorrects.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendMsg(null)
    try {
      const res = await authApi.resendVerification(unverifiedEmail)
      setResendMsg({ ok: true, text: res.message })
    } catch (e) {
      setResendMsg({ ok: false, text: e.message || 'Erreur.' })
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ position: 'relative', zIndex: 2 }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white text-2xl mb-4 shadow-lg shadow-indigo-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">FinanceApp</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Connectez-vous à votre compte</p>
        </div>

        <div className="rounded-2xl p-8 border" style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'rgba(255,255,255,0.6)',
          boxShadow: '0 8px 32px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.08)',
        }}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm space-y-2">
              <p>{error}</p>
              {unverifiedEmail && (
                <div className="pt-1 space-y-2">
                  {resendMsg ? (
                    <p className={`text-sm ${resendMsg.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {resendMsg.text}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendLoading}
                      className="text-sm underline text-indigo-600 dark:text-indigo-400 hover:no-underline disabled:opacity-50"
                    >
                      {resendLoading ? 'Envoi...' : '↻ Renvoyer le courriel de confirmation'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Email</label>
              <input
                type="email" required autoFocus
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="input-field"
                placeholder="votre@email.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-label text-gray-500 dark:text-gray-400">Mot de passe</label>
                <Link to="/forgot-password" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors">
                  Oublié ?
                </Link>
              </div>
              <input
                type="password" required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="input-field"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Connexion…' : 'Se connecter →'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold transition-colors">
              Créer un compte
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400/70 dark:text-gray-600 mt-4 font-mono">
          admin@finance.local · Admin123!
        </p>
      </div>
    </div>
  )
}
