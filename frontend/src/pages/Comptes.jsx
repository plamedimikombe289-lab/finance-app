import { useState, useEffect } from 'react'
import { C } from '../utils/colors'
import { comptesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { useConfirm } from '../hooks/useConfirm'
import EmptyState from '../components/EmptyState'
import { SkeletonListPage } from '../components/SkeletonLoader'
import Modal from '../components/Modal'

const TYPES = [
  { value: 'cheque',  label: 'Chèque',   icon: '🏦' },
  { value: 'epargne', label: 'Épargne',  icon: '💰' },
  { value: 'credit',  label: 'Crédit',   icon: '💳' },
  { value: 'autre',   label: 'Autre',    icon: '📂' },
]

const TYPE_ICONS = Object.fromEntries(TYPES.map(t => [t.value, t.icon]))

const INIT = { nom: '', type: 'cheque', solde_initial: '', couleur: C.brand }
const VIR_INIT = { from_compte_id: '', to_compte_id: '', montant: '', commentaire: '' }

export default function Comptes() {
  const { fmt } = useAuth()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [comptes, setComptes] = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState(INIT)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)

  const [showVirement, setShowVirement] = useState(false)
  const [virForm, setVirForm]           = useState(VIR_INIT)
  const [virLoading, setVirLoading]     = useState(false)
  const [virError, setVirError]         = useState(null)
  const [virements, setVirements]       = useState([])
  const [showHistory, setShowHistory]   = useState(false)

  const [adjModal, setAdjModal]     = useState(null)
  const [adjSolde, setAdjSolde]     = useState('')
  const [adjLoading, setAdjLoading] = useState(false)
  const [adjError, setAdjError]     = useState(null)


  const load = () => {
    setLoading(true)
    comptesApi.lister()
      .then(data => { setComptes(data.comptes); setTotal(data.total) })
      .catch(e => setError(e.message || 'Erreur de chargement.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(); loadVirements() }, [])

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await comptesApi.modifier(editing, { nom: form.nom, type: form.type, couleur: form.couleur })
        toast.success('Compte modifié.')
      } else {
        await comptesApi.creer(form)
        toast.success('Compte créé.')
      }
      setForm(INIT); setEditing(null); setShowForm(false); load()
    } catch (e) {
      toast.error(e.message || 'Erreur.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = c => {
    setForm({ nom: c.nom, type: c.type, solde_initial: c.solde, couleur: c.couleur })
    setEditing(c.id)
    setShowForm(true)
  }

  const handleDelete = async id => {
    if (!await confirm('Archiver ce compte ?', { confirmLabel: 'Archiver' })) return
    try {
      await comptesApi.supprimer(id)
      toast.success('Compte archivé.')
      load()
    } catch (e) {
      toast.error(e.message || 'Erreur.')
    }
  }

  const handleCancel = () => {
    setForm(INIT); setEditing(null); setShowForm(false)
  }

  const handleAjuster = async e => {
    e.preventDefault()
    setAdjError(null)
    setAdjLoading(true)
    try {
      const res = await comptesApi.ajuster(adjModal.id, { nouveau_solde: parseFloat(adjSolde) })
      toast.success(`Solde ajusté (${res.difference >= 0 ? '+' : ''}${res.difference}$).`)
      setAdjModal(null)
      load()
    } catch (e) {
      setAdjError(e.message || 'Erreur.')
    } finally {
      setAdjLoading(false)
    }
  }

  const loadVirements = () => {
    comptesApi.virements()
      .then(d => setVirements(d.virements || []))
      .catch(() => {})
  }

  const handleVirement = async e => {
    e.preventDefault()
    setVirError(null)
    setVirLoading(true)
    try {
      await comptesApi.virement({
        from_compte_id: parseInt(virForm.from_compte_id),
        to_compte_id:   parseInt(virForm.to_compte_id),
        montant:        parseFloat(virForm.montant),
        commentaire:    virForm.commentaire || undefined,
      })
      toast.success('Virement effectué.')
      setVirForm(VIR_INIT)
      setShowVirement(false)
      load()
      loadVirements()
    } catch (e) {
      setVirError(e.message || 'Erreur lors du virement.')
    } finally {
      setVirLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Comptes bancaires</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowVirement(s => !s); setVirError(null); setVirForm(VIR_INIT) }}
            className="px-4 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            {showVirement ? '✕ Annuler' : '⇄ Virement'}
          </button>
          <button
            onClick={() => { setShowForm(s => !s); setEditing(null); setForm(INIT) }}
            className="btn-primary"
          >
            {showForm && !editing ? '✕ Annuler' : '+ Nouveau compte'}
          </button>
        </div>
      </div>

      {showVirement && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-indigo-200 dark:border-indigo-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">⇄ Virement entre comptes</h2>
          {virError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {virError}
            </div>
          )}
          <form onSubmit={handleVirement} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Compte source *</label>
              <select
                required
                value={virForm.from_compte_id}
                onChange={e => setVirForm(f => ({ ...f, from_compte_id: e.target.value }))}
                className="input-field"
              >
                <option value="">— Choisir —</option>
                {comptes.map(c => (
                  <option key={c.id} value={c.id} disabled={c.id === parseInt(virForm.to_compte_id)}>
                    {TYPE_ICONS[c.type]} {c.nom} · {fmt(c.solde)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Compte destination *</label>
              <select
                required
                value={virForm.to_compte_id}
                onChange={e => setVirForm(f => ({ ...f, to_compte_id: e.target.value }))}
                className="input-field"
              >
                <option value="">— Choisir —</option>
                {comptes.map(c => (
                  <option key={c.id} value={c.id} disabled={c.id === parseInt(virForm.from_compte_id)}>
                    {TYPE_ICONS[c.type]} {c.nom} · {fmt(c.solde)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Montant *</label>
              <input
                type="number" step="0.01" min="0.01" required
                value={virForm.montant}
                onChange={e => setVirForm(f => ({ ...f, montant: e.target.value }))}
                placeholder="0.00"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Note</label>
              <input
                type="text"
                value={virForm.commentaire}
                onChange={e => setVirForm(f => ({ ...f, commentaire: e.target.value }))}
                placeholder="Ex : remboursement carte"
                className="input-field"
              />
            </div>
            {virForm.from_compte_id && virForm.to_compte_id && virForm.montant && (
              <div className="sm:col-span-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-sm text-indigo-700 dark:text-indigo-300">
                {fmt(virForm.montant)} seront transférés de{' '}
                <strong>{comptes.find(c => c.id === parseInt(virForm.from_compte_id))?.nom}</strong>{' '}
                vers <strong>{comptes.find(c => c.id === parseInt(virForm.to_compte_id))?.nom}</strong>.
              </div>
            )}
            <div className="sm:col-span-2 flex gap-3 pt-1">
              <button type="submit" disabled={virLoading}
                className="btn-primary">
                {virLoading ? 'Transfert en cours…' : 'Confirmer le virement'}
              </button>
              <button type="button" onClick={() => { setShowVirement(false); setVirError(null) }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div className="card-primary p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            {editing ? 'Modifier le compte' : 'Nouveau compte'}
          </h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nom du compte *</label>
              <input
                required
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="Ex : Compte principal"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="input-field"
              >
                {TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
            {!editing && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Solde initial</label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.solde_initial}
                  onChange={e => setForm(f => ({ ...f, solde_initial: e.target.value }))}
                  placeholder="0.00"
                  className="input-field"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Couleur</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.couleur}
                  onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))}
                  className="h-9 w-14 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">{form.couleur}</span>
              </div>
            </div>
            <div className="sm:col-span-2 flex gap-3 pt-2">
              <button
                type="submit" disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Enregistrement…' : editing ? 'Modifier' : 'Créer'}
              </button>
              <button
                type="button" onClick={handleCancel}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <SkeletonListPage />
      ) : error ? (
        <div className="text-center py-16 text-red-500">{error}</div>
      ) : comptes.length === 0 ? (
        <EmptyState icon="card" title="Aucun compte configuré." description="Créez un compte pour lier vos revenus et dépenses à un solde réel." />
      ) : (
        <>
          <div className="card-primary p-4 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Solde total de tous les comptes</span>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{fmt(total)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {comptes.map(c => {
              const isCredit  = c.type === 'credit'
              const hasLimite = isCredit && c.limite != null && parseFloat(c.limite) > 0
              const pct       = hasLimite ? Math.min(100, Math.round(parseFloat(c.solde) / parseFloat(c.limite) * 100)) : 0
              const rembourse = hasLimite && parseFloat(c.solde) >= parseFloat(c.limite)
              return (
                <div
                  key={c.id}
                  className="card-primary p-5 flex flex-col gap-3"
                  style={{ borderLeftColor: c.couleur, borderLeftWidth: 4 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl">{TYPE_ICONS[c.type] || '📂'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{c.nom}</p>
                          {rembourse && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                              🎉 Remboursée
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 capitalize">{c.type}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setAdjModal(c); setAdjSolde(parseFloat(c.solde).toFixed(2)); setAdjError(null) }} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm" title="Ajuster le solde">⚖️</button>
                      <button onClick={() => handleEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-sm" title="Modifier">✏️</button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm" title="Archiver">🗑️</button>
                    </div>
                  </div>

                  {isCredit && hasLimite ? (
                    <>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>Disponible</span>
                          <span>{pct}% · limite {fmt(c.limite)}</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: rembourse ? C.success : pct >= 80 ? C.success : pct >= 40 ? C.warning : C.danger
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-2xl font-bold" style={{ color: rembourse ? C.success : c.couleur }}>{fmt(c.solde)}</p>
                          <p className="text-xs text-gray-400">disponible sur {fmt(c.limite)}</p>
                        </div>
                        <p className="text-xs text-red-500 dark:text-red-400 font-medium">
                          Utilisé : {fmt(parseFloat(c.limite) - parseFloat(c.solde))}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl font-bold" style={{ color: c.couleur }}>
                      {fmt(c.solde)}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Créé le {new Date(c.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}
      <Modal open={!!adjModal} onClose={() => setAdjModal(null)} maxWidth="max-w-sm" label="Ajuster le solde">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">⚖️ Ajuster le solde</h3>
            <button onClick={() => setAdjModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
          {adjModal && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Compte : <strong className="text-gray-700 dark:text-gray-300">{adjModal.nom}</strong>
              </p>
              {adjError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {adjError}
                </div>
              )}
              <form onSubmit={handleAjuster} className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Solde actuel dans l'app</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{fmt(adjModal.solde)}</span>
                </div>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Nouveau solde réel *</label>
                  <input
                    type="number" step="0.01" required
                    value={adjSolde}
                    onChange={e => setAdjSolde(e.target.value)}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                {adjSolde !== '' && !isNaN(adjSolde) && (
                  <div className={`p-3 rounded-lg text-sm font-medium ${parseFloat(adjSolde) >= parseFloat(adjModal.solde) ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                    Ajustement : {parseFloat(adjSolde) >= parseFloat(adjModal.solde) ? '+' : ''}{(parseFloat(adjSolde) - parseFloat(adjModal.solde)).toFixed(2)}$
                  </div>
                )}
                <button type="submit" disabled={adjLoading}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                  {adjLoading ? 'Mise à jour...' : "Confirmer l'ajustement"}
                </button>
              </form>
            </>
          )}
        </div>
      </Modal>

      {virements.length > 0 && (
        <div className="card-primary overflow-hidden">
          <button
            onClick={() => setShowHistory(s => !s)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span>⇄ Historique des virements ({virements.length})</span>
            <span className="text-gray-400">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {virements.map(v => (
                <div key={v.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{v.from_nom}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{v.to_nom}</span>
                    {v.commentaire && <span className="text-gray-400 truncate">· {v.commentaire}</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{fmt(v.montant)}</span>
                    <span className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {ConfirmDialog}
    </div>
  )
}





