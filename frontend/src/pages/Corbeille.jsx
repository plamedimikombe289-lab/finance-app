import { useState, useEffect, useCallback } from 'react'
import { corbeilleApi, revenusApi, depensesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { useConfirm } from '../hooks/useConfirm'
import EmptyState from '../components/EmptyState'
import { SkeletonListPage } from '../components/SkeletonLoader'

function jours(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / 86400000)
}

function expireBar(dateStr) {
  const j = jours(dateStr)
  const pct = Math.min(100, Math.round((j / 30) * 100))
  const color = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-400' : 'bg-indigo-400'
  return { pct, color, reste: Math.max(0, 30 - j) }
}

export default function Corbeille() {
  const { fmt } = useAuth()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(null)
  const [purged, setPurged]   = useState(null)

  const charger = useCallback(() => {
    setLoading(true)
    corbeilleApi.lister()
      .then(d => { setItems(d.items); if (d.purges > 0) setPurged(d.purges) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { charger() }, [charger])

  const handleRestaurer = async (item) => {
    setBusy(item.id + item.type)
    try {
      if (item.type === 'revenu') await revenusApi.restaurer(item.id)
      else                        await depensesApi.restaurer(item.id)
      toast.success(`${item.type === 'revenu' ? 'Revenu' : 'Dépense'} restauré(e).`)
      charger()
    } catch (e) { toast.error(e.message || 'Erreur') }
    finally { setBusy(null) }
  }

  const handleSupprimer = async (item) => {
    const label = item.type === 'revenu' ? 'revenu' : 'dépense'
    if (!await confirm(`Supprimer définitivement ce(tte) ${label} ? Cette action est irréversible.`, { danger: true, confirmLabel: 'Supprimer définitivement' })) return
    setBusy(item.id + item.type)
    try {
      if (item.type === 'revenu') await revenusApi.supprimerDefinitif(item.id)
      else                        await depensesApi.supprimerDefinitif(item.id)
      toast.success(`${item.type === 'revenu' ? 'Revenu' : 'Dépense'} supprimé(e) définitivement.`)
      charger()
    } catch (e) { toast.error(e.message || 'Erreur') }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Corbeille</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Les éléments supprimés sont conservés 30 jours avant suppression définitive automatique.
          Restaurez-les pour les remettre dans la liste principale.
        </p>
      </div>

      {purged !== null && purged > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
          🧹 {purged} élément(s) de plus de 30 jours ont été supprimés définitivement.
        </div>
      )}

      {loading ? (
        <SkeletonListPage rows={4} />
      ) : items.length === 0 ? (
        <EmptyState icon="trash" title="La corbeille est vide." description="Les revenus et dépenses supprimés apparaissent ici et sont conservés 30 jours." />
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const { pct, color, reste } = expireBar(item.deleted_at)
            const isRevenu = item.type === 'revenu'
            const isBusy   = busy === item.id + item.type
            return (
              <div key={`${item.type}-${item.id}`}
                className="card-primary p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {isRevenu ? '💰' : (item.icone || '🛒')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.commentaire}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        isRevenu
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {isRevenu ? 'Revenu' : 'Dépense'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {isRevenu
                        ? <span>{item.sous_type}{item.source ? ` · ${item.source}` : ''}</span>
                        : <span style={{ color: item.couleur }}>{item.categorie_nom || 'Sans catégorie'}</span>
                      }
                      {' · '}{new Date(item.date).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Supprimé le {new Date(item.deleted_at).toLocaleDateString('fr-FR')} · expire dans {reste}j
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`font-semibold text-sm ${isRevenu ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isRevenu ? '+' : '-'}{fmt(item.montant)}
                    </p>
                  </div>
                </div>

                {/* Expiry progress bar */}
                <div className="space-y-1">
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">{pct}% du délai de 30 jours écoulé</p>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => handleRestaurer(item)}
                    disabled={isBusy}
                    className="btn-primary text-xs"
                  >
                    {isBusy ? '…' : '↩ Restaurer'}
                  </button>
                  <button
                    onClick={() => handleSupprimer(item)}
                    disabled={isBusy}
                    className="px-3 py-1.5 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    🗑️ Supprimer définitivement
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-xs text-center text-gray-400">
          {items.length} élément(s) dans la corbeille · suppression automatique après 30 jours
        </p>
      )}
      {ConfirmDialog}
    </div>
  )
}

