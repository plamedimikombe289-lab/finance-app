import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const [form, setForm]   = useState({ nom: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(null) // { email } quand vérification requise
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg]         = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm)
      return setError('Les mots de passe ne correspondent pas.')
    if (form.password.length < 6)
      return setError('Mot de passe minimum 6 caractères.')
    setLoading(true)
    try {
      const res = await authApi.register({
        nom: form.nom,
        email: form.email,
        password: form.password,
      })
      if (res.needs_verification) {
        setPending({ email: res.email })
      } else {
        login(res.user, res.token)
        navigate('/dashboard', { replace: true })
      }
    } catch (e) {
      setError(e.message || "Erreur lors de l'inscription.")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendMsg(null)
    try {
      const res = await authApi.resendVerification(pending.email)
      setResendMsg({ ok: true, text: res.message })
    } catch (e) {
      setResendMsg({ ok: false, text: e.message || 'Erreur.' })
    } finally {
      setResendLoading(false)
    }
  }

  if (pending) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ position: 'relative', zIndex: 2 }}>
        <div className="w-full max-w-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 text-center space-y-4">
            <div className="text-5xl">📧</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Vérifiez votre courriel</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Un lien de confirmation a été envoyé à<br />
              <strong className="text-gray-900 dark:text-white">{pending.email}</strong>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Cliquez sur le lien dans le courriel pour activer votre compte. Le lien expire dans 24 heures.
            </p>
            {resendMsg && (
              <p className={`text-sm ${resendMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {resendMsg.text}
              </p>
            )}
            <button
              onClick={handleResend}
              disabled={resendLoading}
              className="btn-secondary w-full"
            >
              {resendLoading ? 'Envoi...' : '↻ Renvoyer le courriel'}
            </button>
            <Link to="/login" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ position: 'relative', zIndex: 2 }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Créer un compte</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Votre espace financier personnel</p>
        </div>

        <div className="rounded-2xl p-8 border" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Nom complet</label>
              <input
                type="text" required autoFocus
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                className="input-field"
                placeholder="Jean Dupont"
              />
            </div>
            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Email</label>
              <input
                type="email" required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="input-field"
                placeholder="jean@example.com"
              />
            </div>
            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Mot de passe</label>
              <input
                type="password" required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="input-field"
                placeholder="Minimum 6 caractères"
              />
            </div>
            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Confirmer</label>
              <input
                type="password" required
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                className="input-field"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
