import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { CURRENCIES } from '../utils/format'
import { authApi } from '../api'
import { useExchangeRates } from '../hooks/useExchangeRates'


export default function Parametres() {
  const { user, updateDevise, changePassword: _ } = useAuth()
  const { rates, loading: ratesLoading, error: ratesError, lastUpdated, convert, refresh: refreshRates } = useExchangeRates()

  // ── Currency selector ──────────────────────────────────────────────────
  const [devise, setDevise]           = useState(user?.devise || 'CAD')
  const [deviseMsg, setDeviseMsg]     = useState(null)
  const [deviseLoading, setDeviseLoading] = useState(false)

  const handleDevise = async (e) => {
    e.preventDefault()
    setDeviseLoading(true)
    setDeviseMsg(null)
    try {
      await updateDevise(devise)
      setDeviseMsg({ ok: true, text: 'Devise mise à jour.' })
    } catch (err) {
      setDeviseMsg({ ok: false, text: err.message || 'Erreur.' })
    } finally {
      setDeviseLoading(false)
    }
  }

  // ── Email rappels ──────────────────────────────────────────────────────
  const [emailRappels, setEmailRappels] = useState(!!user?.email_rappels_actif)
  const [emailMsg, setEmailMsg]         = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [testLoading, setTestLoading]   = useState(false)

  const handleToggleEmail = async (checked) => {
    setEmailLoading(true)
    setEmailMsg(null)
    try {
      await authApi.toggleEmailRappels(checked)
      setEmailRappels(checked)
      setEmailMsg({ ok: true, text: checked ? 'Rappels par email activés.' : 'Rappels par email désactivés.' })
    } catch (err) {
      setEmailMsg({ ok: false, text: err.message || 'Erreur.' })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleTestEmail = async () => {
    setTestLoading(true)
    setEmailMsg(null)
    try {
      const res = await authApi.testerEmailRappels()
      setEmailMsg({ ok: true, text: res.message })
    } catch (err) {
      setEmailMsg({ ok: false, text: err.message || 'Erreur.' })
    } finally {
      setTestLoading(false)
    }
  }

  // ── Password change ────────────────────────────────────────────────────
  const [pwd, setPwd]       = useState({ current: '', next: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState(null)
  const [pwdLoading, setPwdLoading] = useState(false)

  const handlePwd = async (e) => {
    e.preventDefault()
    if (pwd.next !== pwd.confirm) return setPwdMsg({ ok: false, text: 'Les mots de passe ne correspondent pas.' })
    setPwdLoading(true)
    setPwdMsg(null)
    try {
      const res = await authApi.changePassword({ current_password: pwd.current, new_password: pwd.next })
      setPwdMsg({ ok: true, text: res.message || 'Mot de passe modifié. Un email de confirmation a été envoyé.' })
      setPwd({ current: '', next: '', confirm: '' })
    } catch (err) {
      setPwdMsg({ ok: false, text: err.message || 'Erreur.' })
    } finally {
      setPwdLoading(false)
    }
  }

  // ── Converter (uses cached exchange rates) ─────────────────────────────
  const [conv, setConv]         = useState({ montant: '', from: 'CAD', to: 'EUR' })
  const [convResult, setConvResult] = useState(null)
  const [convError, setConvError]   = useState(null)

  const handleConvert = (e) => {
    e.preventDefault()
    const m = parseFloat(conv.montant)
    if (!m || m <= 0) return setConvError('Montant invalide.')
    if (!rates) return setConvError('Taux non disponibles. Vérifiez votre connexion.')
    setConvError(null)
    const result = convert(m, conv.from, conv.to)
    const rate = convert(1, conv.from, conv.to)
    setConvResult({ rate, result, to: conv.to })
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Paramètres</h1>

      {/* ── Currency ── */}
      <section className="card-primary p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200">Devise d'affichage</h2>
        <form onSubmit={handleDevise} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Devise</label>
            <select value={devise} onChange={e => setDevise(e.target.value)} className="input-field">
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} – {c.name} ({c.symbol})</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={deviseLoading}
            className="btn-primary">
            {deviseLoading ? 'Sauvegarde...' : 'Appliquer'}
          </button>
        </form>
        {deviseMsg && (
          <p className={`text-sm ${deviseMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {deviseMsg.text}
          </p>
        )}
      </section>

      {/* ── Converter ── */}
      <section className="card-primary p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">Convertisseur de devises</h2>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                Taux du {lastUpdated.toLocaleDateString('fr-FR')} (cache 24h)
              </span>
            )}
            <button type="button" onClick={refreshRates} disabled={ratesLoading}
              className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-40">
              {ratesLoading ? '...' : '↻ Actualiser'}
            </button>
          </div>
        </div>
        {ratesError && <p className="text-xs text-orange-600 dark:text-orange-400">Taux hors ligne — utilisation du cache local si disponible.</p>}
        <form onSubmit={handleConvert} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Montant</label>
              <input type="number" step="0.01" min="0" required value={conv.montant}
                onChange={e => setConv(c => ({ ...c, montant: e.target.value }))}
                className="input-field" placeholder="100" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">De</label>
              <select value={conv.from} onChange={e => setConv(c => ({ ...c, from: e.target.value }))} className="input-field">
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Vers</label>
              <select value={conv.to} onChange={e => setConv(c => ({ ...c, to: e.target.value }))} className="input-field">
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={ratesLoading || !rates}
            className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
            {ratesLoading ? 'Chargement des taux...' : 'Convertir'}
          </button>
        </form>
        {convError && <p className="text-sm text-red-600 dark:text-red-400">{convError}</p>}
        {convResult && (
          <div className="p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg text-center">
            <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">
              {convResult.result.toFixed(2)} {convResult.to}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Taux : 1 {conv.from} = {convResult.rate.toFixed(4)} {conv.to}
            </p>
          </div>
        )}
      </section>

      {/* ── Email rappels ── */}
      <section className="card-primary p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">Rappels par email</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Recevez un email chaque matin lorsqu'une échéance de dette approche.
            Configurez <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">SMTP_HOST</code> dans le fichier <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env</code> pour activer l'envoi.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={emailRappels}
              disabled={emailLoading}
              onChange={e => handleToggleEmail(e.target.checked)}
            />
            <div className={`w-10 h-6 rounded-full transition-colors ${emailRappels ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${emailRappels ? 'translate-x-4' : ''}`} />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {emailRappels ? 'Rappels activés' : 'Rappels désactivés'}
          </span>
        </label>

        {emailRappels && (
          <button
            onClick={handleTestEmail}
            disabled={testLoading}
            className="px-4 py-2 text-sm border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {testLoading ? 'Envoi...' : '📧 Envoyer un email de test'}
          </button>
        )}

        {emailMsg && (
          <p className={`text-sm ${emailMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {emailMsg.text}
          </p>
        )}
      </section>

      {/* ── Password ── */}
      <section className="card-primary p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200">Changer le mot de passe</h2>
        {pwdMsg && (
          <p className={`text-sm ${pwdMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {pwdMsg.text}
          </p>
        )}
        <form onSubmit={handlePwd} className="space-y-3">
          {[
            ['current', 'Mot de passe actuel'],
            ['next',    'Nouveau mot de passe'],
            ['confirm', 'Confirmer'],
          ].map(([field, label]) => (
            <div key={field}>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</label>
              <input type="password" required value={pwd[field]}
                onChange={e => setPwd(p => ({ ...p, [field]: e.target.value }))}
                className="input-field" />
            </div>
          ))}
          <button type="submit" disabled={pwdLoading}
            className="w-full py-2 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
            {pwdLoading ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </section>
    </div>
  )
}


