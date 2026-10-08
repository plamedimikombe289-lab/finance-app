import { useState, useEffect, useCallback } from 'react'
import { revenusApi, modelesApi, rapportsApi, comptesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { SkeletonRow } from '../components/SkeletonLoader'
import { useToast } from '../components/Toast'
import { useConfirm } from '../hooks/useConfirm'
import EmptyState from '../components/EmptyState'
import { useEscape } from '../hooks/useEscape'

const TYPES = ['salaire', 'freelance', 'prime', 'autre']
const RECURRENCES = [
  { value: 'mensuel',      label: 'Mensuel' },
  { value: 'bi-mensuel',   label: 'Bimensuel (15 jours)' },
  { value: 'hebdomadaire', label: 'Hebdomadaire' },
]

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function todayPlus(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const MODELE_FORM_DEFAULT = { montant: '', commentaire: '', type: 'salaire', recurrence: 'mensuel', prochaine_date: '' }

export default function Revenus() {
  const { fmt } = useAuth()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [form, setForm] = useState({ montant: '', commentaire: '', type: 'salaire', source: '', date: '', compte_id: '' })
  const formDirty = !!(form.montant || form.commentaire)
  useUnsavedChanges(formDirty)
  const [comptes, setComptes] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [revenus, setRevenus] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  useEscape(() => setDetail(null), !!detail)

  const [modeles, setModeles] = useState([])
  const [showModeleForm, setShowModeleForm] = useState(false)
  const [modeleForm, setModeleForm] = useState(MODELE_FORM_DEFAULT)
  const [modeleSubmitting, setModeleSubmitting] = useState(false)
  const [modeleError, setModeleError] = useState(null)
  const [utiliserLoading, setUtiliserLoading] = useState(null)
  const [filterType, setFilterType]   = useState('')
  const [filterQ, setFilterQ]         = useState('')
  const [filterDebut, setFilterDebut] = useState('')
  const [filterFin, setFilterFin]     = useState('')
  const [filterMinMt, setFilterMinMt] = useState('')
  const [filterMaxMt, setFilterMaxMt] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const charger = useCallback(() => {
    setLoading(true)
    const params = { page, limite: 10 }
    if (filterType)  params.type        = filterType
    if (filterQ)     params.q           = filterQ
    if (filterDebut) params.date_debut  = filterDebut
    if (filterFin)   params.date_fin    = filterFin
    if (filterMinMt) params.montant_min = filterMinMt
    if (filterMaxMt) params.montant_max = filterMaxMt
    revenusApi.lister(params)
      .then(data => { setRevenus(data.revenus); setTotal(data.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, filterType, filterQ, filterDebut, filterFin, filterMinMt, filterMaxMt])

  const chargerModeles = useCallback(() => {
    modelesApi.lister()
      .then(data => setModeles(data.modeles || []))
      .catch(() => {})
  }, [])

  useEffect(() => { charger() }, [charger])
  useEffect(() => { chargerModeles() }, [chargerModeles])
  useEffect(() => {
    comptesApi.lister()
      .then(d => setComptes((d.comptes || []).filter(c => c.type !== 'credit')))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.commentaire.trim()) return setError('Le commentaire est obligatoire.')
    if (!form.montant || parseFloat(form.montant) <= 0) return setError('Montant invalide.')
    setSubmitting(true)
    setError(null)
    try {
      const rev = await revenusApi.creer({
        montant:     parseFloat(form.montant),
        commentaire: form.commentaire.trim(),
        type:        form.type,
        source:      form.source.trim() || undefined,
        date:        form.date || undefined,
        compte_id:   form.compte_id || undefined,
      })
      setForm({ montant: '', commentaire: '', type: 'salaire', source: '', date: '', compte_id: '' })
      setPage(1)
      charger()
      const d = await rapportsApi.revenu(rev.id)
      setDetail(d)
    } catch (e) {
      setError(e.message || "Erreur lors de l'ajout.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!await confirm('Supprimer ce revenu et annuler la répartition ?', { danger: true, confirmLabel: 'Supprimer' })) return
    try {
      await revenusApi.supprimer(id)
      charger()
    } catch (e) {
      toast.error(e.message || 'Erreur')
    }
  }

  const viewDetail = async (id) => {
    setDetailLoading(true)
    try {
      const d = await rapportsApi.revenu(id)
      setDetail(d)
    } catch {
      toast.error('Erreur lors du chargement du détail.')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleUtiliserModele = async (id) => {
    setUtiliserLoading(id)
    try {
      await modelesApi.utiliser(id)
      toast.success('Revenu récurrent ajouté et fonds distribués !')
      charger()
      chargerModeles()
    } catch (e) {
      toast.error(e.message || "Erreur lors de l'utilisation du modèle.")
    } finally {
      setUtiliserLoading(null)
    }
  }

  const handleSupprimerModele = async (id) => {
    if (!await confirm('Supprimer ce modèle récurrent ?', { danger: true, confirmLabel: 'Supprimer' })) return
    try {
      await modelesApi.supprimer(id)
      chargerModeles()
    } catch (e) {
      toast.error(e.message || 'Erreur')
    }
  }

  const handleCreerModele = async (e) => {
    e.preventDefault()
    if (!modeleForm.commentaire.trim()) return setModeleError('Le commentaire est obligatoire.')
    if (!modeleForm.prochaine_date) return setModeleError('La date du prochain versement est obligatoire.')
    if (!modeleForm.montant || parseFloat(modeleForm.montant) <= 0) return setModeleError('Montant invalide.')
    setModeleSubmitting(true)
    setModeleError(null)
    try {
      await modelesApi.creer({
        montant: parseFloat(modeleForm.montant),
        commentaire: modeleForm.commentaire.trim(),
        type: modeleForm.type,
        recurrence: modeleForm.recurrence,
        prochaine_date: modeleForm.prochaine_date,
      })
      setModeleForm(MODELE_FORM_DEFAULT)
      setShowModeleForm(false)
      chargerModeles()
    } catch (e) {
      setModeleError(e.message || 'Erreur lors de la création du modèle.')
    } finally {
      setModeleSubmitting(false)
    }
  }

  const exportCSV = async () => {
    try {
      const all = await revenusApi.lister({ page: 1, limite: 9999 })
      const rows = [
        ['Date', 'Commentaire', 'Type', 'Montant'],
        ...(all.revenus || []).map(r => [
          new Date(r.date).toLocaleDateString('fr-FR'),
          r.commentaire,
          r.type,
          r.montant,
        ])
      ]
      const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `revenus_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Erreur lors de l'export.")
    }
  }

  const totalPages = Math.ceil(total / 10)

  const recurrenceLabel = (val) => RECURRENCES.find(r => r.value === val)?.label || val

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revenus</h1>

      {/* Modèles récurrents */}
      <div className="card-primary overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Revenus récurrents</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Modèles prêts à l'emploi, mis à jour automatiquement</p>
          </div>
          <button
            onClick={() => { setShowModeleForm(v => !v); setModeleError(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
          >
            <span className="text-base">{showModeleForm ? '✕' : '+'}</span>
            {showModeleForm ? 'Annuler' : 'Nouveau modèle'}
          </button>
        </div>

        {showModeleForm && (
          <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-800">
            {modeleError && (
              <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-xs">
                {modeleError}
              </div>
            )}
            <form onSubmit={handleCreerModele} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant *</label>
                <input type="number" step="0.01" min="0.01" required value={modeleForm.montant}
                  onChange={e => setModeleForm(f => ({ ...f, montant: e.target.value }))}
                  className="input-field"
                  placeholder="1500.00" />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Commentaire *</label>
                <input type="text" required value={modeleForm.commentaire}
                  onChange={e => setModeleForm(f => ({ ...f, commentaire: e.target.value }))}
                  className="input-field"
                  placeholder="Salaire mensuel..." />
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Type</label>
                <select value={modeleForm.type} onChange={e => setModeleForm(f => ({ ...f, type: e.target.value }))}
                  className="input-field">
                  {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Récurrence</label>
                <select value={modeleForm.recurrence} onChange={e => setModeleForm(f => ({ ...f, recurrence: e.target.value }))}
                  className="input-field">
                  {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Prochain versement *</label>
                <input type="date" required value={modeleForm.prochaine_date}
                  onChange={e => setModeleForm(f => ({ ...f, prochaine_date: e.target.value }))}
                  className="input-field" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                <button type="submit" disabled={modeleSubmitting}
                  className="btn-primary">
                  {modeleSubmitting ? 'Création...' : '✓ Créer le modèle'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {modeles.length === 0 ? (
            <p className="px-6 py-5 text-sm text-gray-500 dark:text-gray-400 text-center">
              Aucun modèle récurrent. Créez-en un pour accélérer la saisie de vos revenus réguliers.
            </p>
          ) : modeles.map(m => {
            const isOverdue = m.prochaine_date && new Date(m.prochaine_date) < new Date()
            return (
              <div key={m.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.commentaire}</p>
                    <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full">
                      {recurrenceLabel(m.recurrence)}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                      {m.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Prochain versement :{' '}
                    <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                      {m.prochaine_date ? new Date(m.prochaine_date).toLocaleDateString('fr-FR') : '—'}
                      {isOverdue && ' ⚠️ en retard'}
                    </span>
                  </p>
                </div>
                <span className="text-green-600 dark:text-green-400 font-semibold text-sm whitespace-nowrap">
                  +{fmt(m.montant)}
                </span>
                <button
                  onClick={() => handleUtiliserModele(m.id)}
                  disabled={utiliserLoading === m.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                  title="Enregistrer ce revenu maintenant"
                >
                  {utiliserLoading === m.id ? '...' : '▶ Utiliser'}
                </button>
                <button
                  onClick={() => handleSupprimerModele(m.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0"
                  title="Supprimer ce modèle"
                >
                  <TrashIcon />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Formulaire ajout */}
        <div className="card-primary p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Ajouter un revenu</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant *</label>
              <input
                type="number" step="0.01" min="0.01" required
                value={form.montant}
                onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                className="input-field"
                placeholder="1500.00"
              />
            </div>

            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                Commentaire * <span className="text-red-500 text-xs">(obligatoire)</span>
              </label>
              <textarea
                required rows={2}
                value={form.commentaire}
                onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Salaire du mois de janvier..."
              />
            </div>

            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                Employeur / Source
                <span className="ml-1 text-xs text-gray-400 font-normal">(optionnel — pour la déclaration d'impôt)</span>
              </label>
              <input
                type="text"
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="input-field"
                placeholder="Ex : Entreprise XYZ, Client A..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="input-field"
                >
                  {TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="input-field"
                />
              </div>
            </div>

            {comptes.length > 0 && (
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                  Compte bancaire
                  <span className="ml-1 text-xs text-gray-400 font-normal">(optionnel — créditer le solde)</span>
                </label>
                <select
                  value={form.compte_id}
                  onChange={e => setForm(f => ({ ...f, compte_id: e.target.value }))}
                  className="input-field"
                >
                  <option value="">— Aucun compte —</option>
                  {comptes.map(c => (
                    <option key={c.id} value={c.id}>{c.nom} ({c.type})</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit" disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? 'Ajout en cours...' : '💰 Ajouter et distribuer'}
            </button>
          </form>
        </div>

        {/* Historique */}
        <div className="card-primary p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Historique <span className="text-sm font-normal text-gray-500">({total})</span>
            </h2>
            {revenus.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exporter CSV
              </button>
            )}
          </div>

          {/* ── Filtres avancés ──────────────────────────────── */}
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFilters(f => !f)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span>🔍 Filtres {(filterType || filterQ || filterDebut || filterFin || filterMinMt || filterMaxMt) ? <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs">actifs</span> : ''}</span>
              <span>{showFilters ? '▲' : '▼'}</span>
            </button>
            {showFilters && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-gray-800/50">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Recherche texte</label>
                  <input type="text" value={filterQ} onChange={e => { setFilterQ(e.target.value); setPage(1) }} placeholder="Commentaire..." className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
                  <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }} className="input-field">
                    <option value="">Tous</option>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date de début</label>
                  <input type="date" value={filterDebut} onChange={e => { setFilterDebut(e.target.value); setPage(1) }} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date de fin</label>
                  <input type="date" value={filterFin} onChange={e => { setFilterFin(e.target.value); setPage(1) }} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Montant min ($)</label>
                  <input type="number" min="0" value={filterMinMt} onChange={e => { setFilterMinMt(e.target.value); setPage(1) }} placeholder="0" className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Montant max ($)</label>
                  <input type="number" min="0" value={filterMaxMt} onChange={e => { setFilterMaxMt(e.target.value); setPage(1) }} placeholder="∞" className="input-field" />
                </div>
                {(filterType || filterQ || filterDebut || filterFin || filterMinMt || filterMaxMt) && (
                  <div className="sm:col-span-2">
                    <button type="button" onClick={() => { setFilterType(''); setFilterQ(''); setFilterDebut(''); setFilterFin(''); setFilterMinMt(''); setFilterMaxMt(''); setPage(1) }} className="text-xs text-red-500 hover:text-red-700 underline">Effacer tous les filtres</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : revenus.length === 0 ? (
            <EmptyState icon="wallet" title="Aucun revenu enregistré." description="Ajoutez votre premier revenu pour distribuer vos fonds dans les catégories." />
          ) : (
            <div className="space-y-2">
              {revenus.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 card-secondary hover:brightness-95 dark:hover:brightness-110 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.commentaire}</p>
                    <p className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString('fr-FR')} · {r.type}</p>
                  </div>
                  <span className="text-green-600 dark:text-green-400 font-semibold text-sm whitespace-nowrap">
                    +{fmt(r.montant)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => viewDetail(r.id)}
                      disabled={detailLoading}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title="Voir répartition"
                    >
                      <EyeIcon />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Supprimer"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
              >‹</button>
              <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
              >›</button>
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setDetail(null)}
        >
          <div
            role="dialog" aria-modal="true" aria-labelledby="modal-detail-title" className="glass-modal p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 id="modal-detail-title" className="text-lg font-semibold text-gray-900 dark:text-white">Détail du revenu</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{detail.revenu?.commentaire}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">×</button>
            </div>

            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {fmt(detail.revenu?.montant)}
              </p>
              <p className="text-sm text-green-600 dark:text-green-500 mt-0.5">
                {new Date(detail.revenu?.date).toLocaleDateString('fr-FR')} · {detail.revenu?.type}
              </p>
            </div>

            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Répartition automatique :</h4>
            <div className="space-y-2">
              {detail.repartitions?.map((r, i) => (
                <div key={i} className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{r.icone}</span>
                    <span className="text-sm font-medium" style={{ color: r.couleur }}>{r.categorie}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {fmt(r.montant)}
                  </span>
                </div>
              ))}
            </div>

            {detail.non_reparti > 0 && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                ⚠️ Non réparti : {fmt(detail.non_reparti)}
              </div>
            )}
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  )
}





