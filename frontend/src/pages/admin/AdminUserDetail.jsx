import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { adminApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../hooks/useConfirm'
import { SkeletonListPage } from '../../components/SkeletonLoader'
import { useEscape } from '../../hooks/useEscape'

const prioriteLabels = {
  1: { label: 'Haute',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  2: { label: 'Moyenne', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  3: { label: 'Basse',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}


export default function AdminUserDetail() {
  const { fmt, startImpersonation } = useAuth()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const { userId } = useParams()
  const navigate   = useNavigate()
  const [impersonating, setImpersonating] = useState(false)
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState('revenus')

  const [editRevenu, setEditRevenu]     = useState(null)
  const [revenuForm, setRevenuForm]     = useState({})
  const [revenuLoading, setRevenuLoading] = useState(false)
  const [revenuError, setRevenuError]   = useState(null)

  const [editDette, setEditDette]     = useState(null)
  const [detteForm, setDetteForm]     = useState({})
  const [detteLoading, setDetteLoading] = useState(false)
  const [detteError, setDetteError]   = useState(null)

  useEscape(() => setEditRevenu(null), !!editRevenu)
  useEscape(() => setEditDette(null),   !!editDette && !editRevenu)

  const charger = useCallback(() => {
    setLoading(true)
    adminApi.getUserData(userId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => { charger() }, [charger])

  const handleDeleteRevenu = async (revenuId) => {
    if (!await confirm('Supprimer ce revenu et annuler la répartition ?', { danger: true, confirmLabel: 'Supprimer' })) return
    try { await adminApi.deleteUserRevenu(userId, revenuId); charger() }
    catch (e) { toast.error(e.message) }
  }

  const openEditRevenu = (r) => {
    setEditRevenu(r)
    setRevenuForm({ montant: String(r.montant), commentaire: r.commentaire, type: r.type })
    setRevenuError(null)
  }

  const handlePatchRevenu = async (e) => {
    e.preventDefault()
    setRevenuError(null)
    setRevenuLoading(true)
    try {
      await adminApi.patchUserRevenu(userId, editRevenu.id, revenuForm)
      setEditRevenu(null)
      charger()
    } catch (e) {
      setRevenuError(e.message || 'Erreur')
    } finally {
      setRevenuLoading(false)
    }
  }

  const openEditDette = (d) => {
    setEditDette(d)
    setDetteForm({
      nom: d.nom, type: d.type,
      montant_total: String(d.montant_total),
      montant_restant: String(d.montant_restant),
      paiement_minimum: String(d.paiement_minimum),
      priorite: String(d.priorite),
    })
    setDetteError(null)
  }

  const handlePatchDette = async (e) => {
    e.preventDefault()
    setDetteError(null)
    setDetteLoading(true)
    try {
      await adminApi.patchUserDette(userId, editDette.id, {
        nom:              detteForm.nom,
        type:             detteForm.type,
        montant_total:    parseFloat(detteForm.montant_total),
        montant_restant:  parseFloat(detteForm.montant_restant),
        paiement_minimum: parseFloat(detteForm.paiement_minimum),
        priorite:         parseInt(detteForm.priorite),
      })
      setEditDette(null)
      charger()
    } catch (e) {
      setDetteError(e.message || 'Erreur')
    } finally {
      setDetteLoading(false)
    }
  }

  const handleImpersonate = async () => {
    setImpersonating(true)
    try {
      const res = await adminApi.impersonate(userId)
      startImpersonation(res.user, res.token)
      navigate('/dashboard', { replace: true })
    } catch (e) {
      toast.error(e.message || "Erreur lors de l'accès au compte.")
      setImpersonating(false)
    }
  }

  if (loading) return <SkeletonListPage rows={8} />
  if (!data)   return <div className="text-center py-20 text-red-500">Utilisateur introuvable.</div>

  const { user, categories, revenus, dettes, depenses, resume } = data
  const tabs = ['revenus', 'dettes', 'dépenses', 'catégories']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/admin/users" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          ← Utilisateurs
        </Link>
        {user.role !== 'admin' && user.actif === 1 && (
          <button
            onClick={handleImpersonate}
            disabled={impersonating}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            {impersonating ? '⏳ Chargement...' : '👁️ Voir le compte'}
          </button>
        )}
      </div>

      <div className="card-primary p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{user.nom}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            <div className="flex gap-2 mt-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                user.role === 'admin'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {user.role === 'admin' ? '👑 Admin' : '👤 User'}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full ${user.actif ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                {user.actif ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <p className="text-lg font-bold text-green-700 dark:text-green-400">{fmt(resume.total_soldes)}</p>
              <p className="text-xs text-gray-500">Soldes</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <p className="text-lg font-bold text-red-700 dark:text-red-400">{fmt(resume.total_dettes)}</p>
              <p className="text-xs text-gray-500">Dettes</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{resume.nb_revenus}</p>
              <p className="text-xs text-gray-500">Revenus</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{resume.nb_dettes_actives}</p>
              <p className="text-xs text-gray-500">Dettes actives</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'revenus' && (
        <div className="space-y-2">
          {revenus.length === 0
            ? <p className="text-gray-500 text-sm text-center py-8">Aucun revenu.</p>
            : revenus.map(r => (
              <div key={r.id} className="bg-white dark:bg-gray-800 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.commentaire}</p>
                  <p className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString('fr-FR')} · {r.type}</p>
                </div>
                <span className="text-green-600 dark:text-green-400 font-semibold text-sm whitespace-nowrap">
                  +{fmt(r.montant)}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => openEditRevenu(r)}
                    className="px-2 py-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 transition-colors">
                    ✏️ Corriger
                  </button>
                  <button onClick={() => handleDeleteRevenu(r.id)}
                    className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors">
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {tab === 'dettes' && (
        <div className="space-y-3">
          {dettes.length === 0
            ? <p className="text-gray-500 text-sm text-center py-8">Aucune dette.</p>
            : dettes.map(d => {
              const p = prioriteLabels[d.priorite] || prioriteLabels[2]
              return (
                <div key={d.id} className="card-primary p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{d.nom}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.cls}`}>{p.label}</span>
                        {!d.actif && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">Soldée</span>}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {fmt(d.montant_restant)} / {fmt(d.montant_total)}
                        {' · '}{d.progression_pct}% remboursé
                      </p>
                    </div>
                    <button onClick={() => openEditDette(d)}
                      className="px-3 py-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap">
                      ✏️ Corriger
                    </button>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, d.progression_pct)}%` }} />
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {tab === 'dépenses' && (
        <div className="space-y-2">
          {depenses.length === 0
            ? <p className="text-gray-500 text-sm text-center py-8">Aucune dépense.</p>
            : depenses.map(d => (
              <div key={d.id} className="bg-white dark:bg-gray-800 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.commentaire}</p>
                  <p className="text-xs text-gray-500">{d.categorie_nom || 'Sans catégorie'} · {new Date(d.date).toLocaleDateString('fr-FR')}</p>
                </div>
                <span className="text-red-600 dark:text-red-400 font-semibold text-sm whitespace-nowrap">
                  -{fmt(d.montant)}
                </span>
              </div>
            ))
          }
        </div>
      )}

      {tab === 'catégories' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map(c => (
            <div key={c.id} className="card-primary p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{c.icone}</span>
                <span className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{c.nom}</span>
              </div>
              <p className="text-lg font-bold" style={{ color: c.couleur }}>{fmt(c.solde)}</p>
              <p className="text-xs text-gray-500">{c.type === 'pourcentage' ? `${c.valeur}%` : `${fmt(c.valeur)} fixe`}</p>
            </div>
          ))}
        </div>
      )}

      {editRevenu && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setEditRevenu(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="modal-revenu-title" className="glass-modal p-6 max-w-md w-full animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 id="modal-revenu-title" className="font-semibold text-gray-900 dark:text-white">Corriger le revenu</h3>
              <button onClick={() => setEditRevenu(null)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-4 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              ⚠️ La modification du montant annulera et recalculera la répartition automatiquement.
            </p>
            {revenuError && <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{revenuError}</div>}
            <form onSubmit={handlePatchRevenu} className="space-y-3">
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant (€)</label>
                <input type="number" step="0.01" min="0.01" value={revenuForm.montant}
                  onChange={e => setRevenuForm(f => ({ ...f, montant: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Commentaire</label>
                <input type="text" value={revenuForm.commentaire}
                  onChange={e => setRevenuForm(f => ({ ...f, commentaire: e.target.value }))} className="input-field" />
              </div>
              <button type="submit" disabled={revenuLoading}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {revenuLoading ? 'Correction en cours...' : 'Appliquer la correction'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editDette && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setEditDette(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="modal-dette-title" className="glass-modal p-6 max-w-md w-full animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 id="modal-dette-title" className="font-semibold text-gray-900 dark:text-white">Corriger la dette</h3>
              <button onClick={() => setEditDette(null)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            {detteError && <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{detteError}</div>}
            <form onSubmit={handlePatchDette} className="space-y-3">
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Nom</label>
                <input type="text" value={detteForm.nom} onChange={e => setDetteForm(f => ({ ...f, nom: e.target.value }))} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant total (€)</label>
                  <input type="number" step="0.01" value={detteForm.montant_total}
                    onChange={e => setDetteForm(f => ({ ...f, montant_total: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant restant (€)</label>
                  <input type="number" step="0.01" value={detteForm.montant_restant}
                    onChange={e => setDetteForm(f => ({ ...f, montant_restant: e.target.value }))} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Paiement min. (€)</label>
                  <input type="number" step="0.01" value={detteForm.paiement_minimum}
                    onChange={e => setDetteForm(f => ({ ...f, paiement_minimum: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Priorité</label>
                  <select value={detteForm.priorite} onChange={e => setDetteForm(f => ({ ...f, priorite: e.target.value }))} className="input-field">
                    <option value="1">1 — Haute</option>
                    <option value="2">2 — Moyenne</option>
                    <option value="3">3 — Basse</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={detteLoading}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {detteLoading ? 'Correction...' : 'Appliquer la correction'}
              </button>
            </form>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  )
}





