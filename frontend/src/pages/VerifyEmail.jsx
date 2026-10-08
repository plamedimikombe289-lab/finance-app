import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Lien invalide. Aucun token de vérification trouvé.')
      return
    }
    authApi.verifyEmail(token)
      .then(res => {
        setStatus('success')
        setMessage(res.message || 'Courriel confirmé. Vous pouvez vous connecter.')
      })
      .catch(err => {
        setStatus('error')
        setMessage(err.message || 'Lien invalide ou expiré.')
      })
  }, [token])

  const handleResend = async (e) => {
    e.preventDefault()
    setResendLoading(true)
    setResendMsg(null)
    try {
      const res = await authApi.resendVerification(resendEmail)
      setResendMsg({ ok: true, text: res.message })
    } catch (err) {
      setResendMsg({ ok: false, text: err.message || 'Erreur.' })
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ position: 'relative', zIndex: 2 }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">FinanceApp</h1>
        </div>

        <div className="rounded-2xl p-8 border text-center space-y-5" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}>

          {status === 'loading' && (
            <>
              <div className="text-4xl animate-pulse">⏳</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Vérification en cours...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-5xl">✅</div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Courriel confirmé !</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
              <Link
                to="/login"
                className="btn-primary w-full block text-center"
              >
                Se connecter
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-5xl">❌</div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Lien invalide ou expiré</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>

              <form onSubmit={handleResend} className="space-y-3 text-left">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                  Recevoir un nouveau lien
                </p>
                <input
                  type="email" required
                  placeholder="votre@courriel.com"
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  className="input-field"
                />
                {resendMsg && (
                  <p className={`text-sm ${resendMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {resendMsg.text}
                  </p>
                )}
                <button
                  type="submit" disabled={resendLoading}
                  className="btn-primary w-full"
                >
                  {resendLoading ? 'Envoi...' : '↻ Renvoyer le lien'}
                </button>
              </form>

              <Link to="/login" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Retour à la connexion
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
