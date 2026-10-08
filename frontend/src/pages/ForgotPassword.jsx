import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api'

export default function ForgotPassword() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ position: 'relative', zIndex: 2 }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Mot de passe oublié</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Entrez votre email pour recevoir un lien de réinitialisation
          </p>
        </div>

        <div className="rounded-2xl p-8 border" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto text-3xl">
                ✅
              </div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Email envoyé !</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Si un compte est associé à <strong>{email}</strong>, vous recevrez un email avec un lien valide <strong>1 heure</strong>.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Vérifiez aussi vos spams.
              </p>
              <Link
                to="/login"
                className="btn-primary w-full mt-2 block text-center"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                    Adresse email
                  </label>
                  <input
                    type="email" required autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="votre@email.com"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  ← Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
