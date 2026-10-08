import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { authApi } from '../api'

export default function ResetPassword() {
  const [searchParams]    = useSearchParams()
  const navigate          = useNavigate()
  const token             = searchParams.get('token')

  const [form, setForm]       = useState({ new_password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState(null)
  const [showPwd, setShowPwd] = useState(false)

  useEffect(() => {
    if (!token) setError('Lien invalide. Veuillez refaire une demande de réinitialisation.')
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (form.new_password.length < 6)
      return setError('Le mot de passe doit contenir au moins 6 caractères.')
    if (form.new_password !== form.confirm)
      return setError('Les mots de passe ne correspondent pas.')

    setLoading(true)
    try {
      await authApi.resetPassword({ token, new_password: form.new_password })
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 4000)
    } catch (err) {
      setError(err.message || 'Lien invalide ou expiré.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ position: 'relative', zIndex: 2 }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Nouveau mot de passe</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choisissez un nouveau mot de passe sécurisé
          </p>
        </div>

        <div className="rounded-2xl p-8 border" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}>
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto text-3xl">
                ✅
              </div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Mot de passe modifié !</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Un email de confirmation vous a été envoyé. Vous allez être redirigé vers la page de connexion dans quelques secondes…
              </p>
              <Link
                to="/login"
                className="btn-primary w-full mt-2 block text-center"
              >
                Se connecter maintenant
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                  {!token && (
                    <div className="mt-2">
                      <Link to="/forgot-password" className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
                        Faire une nouvelle demande →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {token && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        required
                        autoFocus
                        minLength={6}
                        value={form.new_password}
                        onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                        className="input-field pr-10"
                        placeholder="Minimum 6 caractères"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
                      >
                        {showPwd ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                      Confirmer le mot de passe
                    </label>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      value={form.confirm}
                      onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                      className={`input-field ${
                        form.confirm && form.confirm !== form.new_password
                          ? 'border-red-400 dark:border-red-500'
                          : ''
                      }`}
                      placeholder="Répétez le mot de passe"
                    />
                    {form.confirm && form.confirm !== form.new_password && (
                      <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !form.new_password || !form.confirm}
                    className="btn-primary w-full mt-2"
                  >
                    {loading ? 'Modification...' : 'Modifier le mot de passe'}
                  </button>
                </form>
              )}

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
