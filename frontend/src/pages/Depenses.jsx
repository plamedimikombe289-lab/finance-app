import { useState, useEffect, useCallback, useRef } from 'react'
import { depensesApi, categoriesApi, modelesDepensesApi, comptesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { CATEGORIES_FISCALES } from '../utils/fiscal'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { getCached, setCached } from '../utils/apiCache'
import { SkeletonRow } from '../components/SkeletonLoader'
import { useToast } from '../components/Toast'
import { useConfirm } from '../hooks/useConfirm'
import EmptyState from '../components/EmptyState'


const ACCEPTED = '.jpg,.jpeg,.png,.webp,.gif,.pdf'
const MAX_MB   = 10

function fichierUrl(id) {
  const token = localStorage.getItem('finance_token')
  const base  = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
  return `${base}/depenses/${id}/fichier?token=${encodeURIComponent(token)}`
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function PaperclipIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  )
}

function FilePreview({ file, onRemove }) {
  const isImage = file.type.startsWith('image/')
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!isImage) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])

  return (
    <div className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
      {isImage && preview ? (
        <img src={preview} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-red-600 dark:text-red-400">PDF</span>
        </div>
      )}
      <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">{file.name}</span>
      <span className="text-xs text-gray-400 flex-shrink-0">{(file.size / 1024 / 1024).toFixed(1)} Mo</span>
      <button type="button" onClick={onRemove} className="text-gray-400 hover:text-red-500 flex-shrink-0">×</button>
    </div>
  )
}

export default function Depenses() {
  const { fmt } = useAuth()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const fileInputRef = useRef(null)
  const [fileInputKey, setFileInputKey] = useState(0)

  const MODELE_INIT = { montant: '', commentaire: '', categorie_id: '', recurrence: 'mensuel', prochaine_date: new Date().toISOString().slice(0, 10), is_deductible: false, deductible_pct: '100', categorie_fiscale: '' }
  const [modeles, setModeles]           = useState([])
  const [showModeleForm, setShowModele] = useState(false)
  const [modeleForm, setModeleForm]     = useState(MODELE_INIT)
  const [modeleSaving, setModeleSaving] = useState(false)
  const [modeleMsg, setModeleMsg]       = useState(null)

  const [form, setForm]           = useState({ montant: '', commentaire: '', categorie_id: '', date: '', is_deductible: false, deductible_pct: '100', categorie_fiscale: '', compte_id: '', type_retrait: '' })
  const formDirty = !!(form.montant || form.commentaire)
  useUnsavedChanges(formDirty)
  const [suggestion, setSuggestion] = useState(null)
  const suggTimerRef = useRef(null)
  const [fichierFile, setFichier] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [categories, setCategories] = useState([])
  const [comptes, setComptes]     = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]   = useState(null)

  const [depenses, setDepenses]         = useState([])
  const [total, setTotal]               = useState(0)
  const [totalMontant, setTotalMontant] = useState(0)
  const [page, setPage]                 = useState(1)
  const [loading, setLoading]           = useState(true)
  const [filterCat, setFilterCat]       = useState('')
  const [filterQ, setFilterQ]           = useState('')
  const [filterDebut, setFilterDebut]   = useState('')
  const [filterFin, setFilterFin]       = useState('')
  const [filterMinMt, setFilterMinMt]   = useState('')
  const [filterMaxMt, setFilterMaxMt]   = useState('')
  const [showFilters, setShowFilters]   = useState(false)

  useEffect(() => {
    const cached = getCached('categories')
    if (cached) setCategories(cached)
    else categoriesApi.lister().then(d => { setCategories(d.categories); setCached('categories', d.categories) }).catch(() => {})

    const cachedComptes = getCached('comptes')
    if (cachedComptes) setComptes(cachedComptes)
    else comptesApi.lister().then(d => { setComptes(d.comptes || []); setCached('comptes', d.comptes || []) }).catch(() => {})

    modelesDepensesApi.lister().then(d => setModeles(d.modeles || [])).catch(() => {})
  }, [])

  useEffect(() => {
    clearTimeout(suggTimerRef.current)
    const q = form.commentaire.trim()
    if (q.length < 3 || form.categorie_id) { setSuggestion(null); return }
    suggTimerRef.current = setTimeout(() => {
      depensesApi.suggestion(q).then(d => setSuggestion(d.suggestion)).catch(() => {})
    }, 400)
    return () => clearTimeout(suggTimerRef.current)
  }, [form.commentaire, form.categorie_id])

  const charger = useCallback(() => {
    setLoading(true)
    const params = { page, limite: 15 }
    if (filterCat)   params.categorie_id = filterCat
    if (filterQ)     params.q            = filterQ
    if (filterDebut) params.date_debut   = filterDebut
    if (filterFin)   params.date_fin     = filterFin
    if (filterMinMt) params.montant_min  = filterMinMt
    if (filterMaxMt) params.montant_max  = filterMaxMt
    depensesApi.lister(params)
      .then(d => { setDepenses(d.depenses); setTotal(d.total); setTotalMontant(d.total_montant) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, filterCat, filterQ, filterDebut, filterFin, filterMinMt, filterMaxMt])

  useEffect(() => { charger() }, [charger])

  const handleFileChange = (e) => {
    setFileError(null)
    const file = e.target.files?.[0]
    if (!file) { setFichier(null); return }
    if (file.size > MAX_MB * 1024 * 1024) {
      setFileError(`Fichier trop volumineux (max ${MAX_MB} Mo).`)
      setFichier(null)
      setFileInputKey(k => k + 1)
      return
    }
    setFichier(file)
  }

  const removeFile = () => {
    setFichier(null)
    setFileError(null)
    setFileInputKey(k => k + 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.commentaire?.trim()) return setError('Le commentaire est obligatoire.')
    if (fileError) return setError(fileError)
    setSubmitting(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('montant',    form.montant)
      fd.append('commentaire', form.commentaire.trim())
      if (form.categorie_id)   fd.append('categorie_id', form.categorie_id)
      if (form.type_retrait)   fd.append('type_retrait', form.type_retrait)
      if (form.date)           fd.append('date', form.date)
      if (fichierFile)         fd.append('fichier', fichierFile)
      if (form.compte_id)      fd.append('compte_id', form.compte_id)
      fd.append('is_deductible', form.is_deductible ? '1' : '0')
      if (form.is_deductible) {
        fd.append('deductible_pct', form.deductible_pct || '100')
        if (form.categorie_fiscale) fd.append('categorie_fiscale', form.categorie_fiscale)
      }

      await depensesApi.creer(fd)
      toast.success('Dépense enregistrée avec succès.')
      setForm({ montant: '', commentaire: '', categorie_id: '', date: '', is_deductible: false, deductible_pct: '100', categorie_fiscale: '', compte_id: '', type_retrait: '' })
      setSuggestion(null)
      setFichier(null)
      setFileInputKey(k => k + 1)
      setPage(1)
      charger()
      categoriesApi.lister().then(d => setCategories(d.categories)).catch(() => {})
    } catch (e) {
      setError(e.message || "Erreur lors de l'ajout.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!await confirm('Supprimer cette dépense et restaurer le solde ?', { danger: true, confirmLabel: 'Supprimer' })) return
    try {
      await depensesApi.supprimer(id)
      charger()
      categoriesApi.lister().then(d => setCategories(d.categories)).catch(() => {})
    } catch (e) { toast.error(e.message) }
  }

  const exportCSV = async () => {
    try {
      const params = { page: 1, limite: 9999 }
      if (filterCat) params.categorie_id = filterCat
      const all = await depensesApi.lister(params)
      const rows = [
        ['Date', 'Commentaire', 'Catégorie', 'Montant', 'Pièce jointe'],
        ...(all.depenses || []).map(d => [
          new Date(d.date).toLocaleDateString('fr-FR'),
          d.commentaire,
          d.categorie_nom || 'Sans catégorie',
          d.montant,
          d.fichier_nom || '',
        ])
      ]
      const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `depenses_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Erreur lors de l'export.")
    }
  }

  const handleSaveModele = async (e) => {
    e.preventDefault()
    setModeleSaving(true)
    setModeleMsg(null)
    try {
      const res = await modelesDepensesApi.creer({
        montant: modeleForm.montant,
        commentaire: modeleForm.commentaire,
        categorie_id: modeleForm.categorie_id || null,
        recurrence: modeleForm.recurrence,
        prochaine_date: modeleForm.prochaine_date,
        is_deductible: modeleForm.is_deductible,
        deductible_pct: modeleForm.deductible_pct,
        categorie_fiscale: modeleForm.categorie_fiscale || null,
      })
      setModeles(m => [...m, res.modele])
      setModeleForm(MODELE_INIT)
      setShowModele(false)
    } catch (err) {
      setModeleMsg(err.message || 'Erreur')
    } finally {
      setModeleSaving(false)
    }
  }

  const handleUtiliserModele = async (id) => {
    try {
      const res = await modelesDepensesApi.utiliser(id)
      setModeles(m => m.map(mod => mod.id === id ? { ...mod, prochaine_date: res.nouvelle_date } : mod))
      charger()
      categoriesApi.lister().then(d => setCategories(d.categories)).catch(() => {})
      toast.success('Dépense enregistrée.')
    } catch (err) {
      toast.error(err.message || 'Erreur')
    }
  }

  const handleDeleteModele = async (id) => {
    if (!await confirm('Supprimer ce modèle de dépense ?', { danger: true, confirmLabel: 'Supprimer' })) return
    try {
      await modelesDepensesApi.supprimer(id)
      setModeles(m => m.filter(mod => mod.id !== id))
    } catch (err) { toast.error(err.message) }
  }

  const selectedCat = categories.find(c => c.id === parseInt(form.categorie_id))
  const estEnveloppeFix = selectedCat?.type === 'fixe' && selectedCat?.plafond_mensuel != null

  const handleTypeRetrait = (type) => {
    if (type === 'paiement_facture' && selectedCat && !form.commentaire.trim()) {
      const moisAnnee = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      setForm(f => ({ ...f, type_retrait: type, commentaire: `Paiement ${selectedCat.nom} — ${moisAnnee}` }))
    } else {
      setForm(f => ({ ...f, type_retrait: type }))
    }
  }

  const totalPages = Math.ceil(total / 15)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dépenses</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Formulaire */}
        <div className="card-primary p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Ajouter une dépense</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant *</label>
              <input type="number" step="0.01" min="0.01" required value={form.montant}
                onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                className="input-field" placeholder="50.00" />
            </div>

            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                Commentaire * <span className="text-red-500 text-xs">(obligatoire)</span>
              </label>
              <input type="text" required value={form.commentaire}
                onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))}
                className="input-field" placeholder="Courses alimentaires..." />
              {suggestion && !form.categorie_id && (
                <button
                  type="button"
                  onClick={() => { setForm(f => ({ ...f, categorie_id: String(suggestion.categorie_id) })); setSuggestion(null) }}
                  className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                >
                  <span>✨</span>
                  <span>Catégorie suggérée :</span>
                  <span>{suggestion.icone} {suggestion.nom}</span>
                  <span className="text-indigo-400 ml-0.5">— cliquer pour appliquer</span>
                </button>
              )}
            </div>

            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Catégorie (optionnel)</label>
              <select value={form.categorie_id} onChange={e => setForm(f => ({ ...f, categorie_id: e.target.value, type_retrait: '' }))} className="input-field">
                <option value="">Sans catégorie</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.icone} {c.nom} — {fmt(c.solde || 0)} dispo
                  </option>
                ))}
              </select>
              {selectedCat && (
                <p className="text-xs mt-1 font-medium" style={{ color: selectedCat.couleur }}>
                  Solde disponible : {fmt(selectedCat.solde || 0)}
                </p>
              )}
            </div>

            {estEnveloppeFix && (
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Type de retrait</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => handleTypeRetrait('paiement_facture')}
                    className={`flex-1 py-2 px-3 text-sm rounded-lg border font-medium transition-colors ${
                      form.type_retrait === 'paiement_facture'
                        ? 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-green-400 dark:hover:border-green-600 hover:text-green-700 dark:hover:text-green-300'
                    }`}>
                    Paiement de la facture
                  </button>
                  <button type="button"
                    onClick={() => handleTypeRetrait('retrait')}
                    className={`flex-1 py-2 px-3 text-sm rounded-lg border font-medium transition-colors ${
                      form.type_retrait === 'retrait'
                        ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-400 dark:border-orange-600 text-orange-700 dark:text-orange-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-400 dark:hover:border-orange-600 hover:text-orange-700 dark:hover:text-orange-300'
                    }`}>
                    Retrait de l'enveloppe
                  </button>
                </div>
                {form.type_retrait === 'paiement_facture' && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    L'enveloppe affichera "Payé" une fois cette dépense enregistrée.
                  </p>
                )}
                {form.type_retrait === 'retrait' && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    L'enveloppe indiquera que la facture n'est pas encore payée.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Date</label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="input-field" />
            </div>

            {/* Déductibilité fiscale — facultatif */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_deductible}
                  onChange={e => setForm(f => ({ ...f, is_deductible: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dépense déductible fiscalement
                </span>
                <span className="text-xs text-gray-400">(optionnel)</span>
              </label>

              {form.is_deductible && (
                <div className="grid grid-cols-2 gap-3 pl-6 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">% déductible</label>
                    <input
                      type="number" min="1" max="100" step="1"
                      value={form.deductible_pct}
                      onChange={e => setForm(f => ({ ...f, deductible_pct: e.target.value }))}
                      className="input-field"
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Catégorie fiscale</label>
                    <select
                      value={form.categorie_fiscale}
                      onChange={e => setForm(f => ({ ...f, categorie_fiscale: e.target.value }))}
                      className="input-field"
                    >
                      <option value="">— Choisir —</option>
                      {CATEGORIES_FISCALES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Pièce jointe — facultatif */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pièce jointe
                  <span className="ml-2 text-xs font-normal text-gray-400">(optionnel · JPG, PNG, PDF · max {MAX_MB} Mo)</span>
                </label>
              </div>

              {!fichierFile ? (
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition-colors group">
                  <PaperclipIcon />
                  <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Attacher une facture ou photo...
                  </span>
                  <input
                    key={fileInputKey}
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <FilePreview file={fichierFile} onRemove={removeFile} />
              )}

              {fileError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fileError}</p>
              )}
            </div>

            {comptes.length > 0 && (
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                  Compte bancaire
                  <span className="ml-1 text-xs text-gray-400 font-normal">(optionnel — débiter le solde)</span>
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

            <button type="submit" disabled={submitting}
              className="btn-primary w-full">
              {submitting ? 'Enregistrement...' : '🛒 Enregistrer la dépense'}
            </button>
          </form>
        </div>

        {/* Liste */}
        <div className="card-primary p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Dépenses <span className="text-sm font-normal text-gray-500">({total})</span>
            </h2>
            {depenses.length > 0 && (
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

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Total : <span className="font-semibold text-red-600 dark:text-red-400">{fmt(totalMontant || 0)}</span>
          </p>

          {/* ── Filtres avancés ────────────────────────────────────────── */}
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFilters(f => !f)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span>🔍 Filtres {(filterCat || filterQ || filterDebut || filterFin || filterMinMt || filterMaxMt) ? <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs">actifs</span> : ''}</span>
              <span>{showFilters ? '▲' : '▼'}</span>
            </button>
            {showFilters && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-gray-800/50">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Recherche texte</label>
                  <input type="text" value={filterQ} onChange={e => { setFilterQ(e.target.value); setPage(1) }}
                    placeholder="Commentaire..." className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Catégorie</label>
                  <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1) }} className="input-field">
                    <option value="">Toutes</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}
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
                {(filterCat || filterQ || filterDebut || filterFin || filterMinMt || filterMaxMt) && (
                  <div className="sm:col-span-2">
                    <button type="button"
                      onClick={() => { setFilterCat(''); setFilterQ(''); setFilterDebut(''); setFilterFin(''); setFilterMinMt(''); setFilterMaxMt(''); setPage(1) }}
                      className="text-xs text-red-500 hover:text-red-700 underline"
                    >Effacer tous les filtres</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : depenses.length === 0 ? (
            <EmptyState icon="inbox" title="Aucune dépense trouvée." description="Enregistrez votre première dépense ou ajustez les filtres actifs." />
          ) : (
            <div className="space-y-2">
              {depenses.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 card-secondary hover:brightness-95 dark:hover:brightness-110 transition-colors">
                  <span className="text-lg flex-shrink-0">{d.icone || '💸'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.commentaire}</p>
                      {d.is_deductible === 1 && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex-shrink-0" title="Dépense déductible">
                          🏛️ {d.deductible_pct < 100 ? `${d.deductible_pct}%` : 'Déductible'}
                        </span>
                      )}
                      {d.fichier_stocke && (
                        <a
                          href={fichierUrl(d.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Voir la pièce jointe : ${d.fichier_nom}`}
                          className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <PaperclipIcon />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {d.categorie_nom
                        ? <span style={{ color: d.couleur }}>{d.categorie_nom}</span>
                        : 'Sans catégorie'
                      }
                      {' · '}{new Date(d.date).toLocaleDateString('fr-FR')}
                      {d.fichier_nom && (
                        <span className="ml-1 text-gray-400">· 📎 {d.fichier_nom}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-red-600 dark:text-red-400 font-semibold text-sm whitespace-nowrap">
                    -{fmt(d.montant)}
                  </span>
                  <button onClick={() => handleDelete(d.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0">
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700">‹</button>
              <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700">›</button>
            </div>
          )}
        </div>
      </div>

      {/* Dépenses récurrentes */}
      <div className="card-primary p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Dépenses récurrentes</h2>
            <p className="text-xs text-gray-400 mt-0.5">Modèles pour vos dépenses régulières (loyer, abonnements…)</p>
          </div>
          <button onClick={() => setShowModele(f => !f)}
            className="btn-primary text-sm">
            {showModeleForm ? '✕ Fermer' : '+ Nouveau modèle'}
          </button>
        </div>

        {modeleMsg && (
          <div className="mb-3 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
            {modeleMsg}
          </div>
        )}

        {showModeleForm && (
          <form onSubmit={handleSaveModele} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Montant *</label>
              <input type="number" step="0.01" min="0.01" required value={modeleForm.montant}
                onChange={e => setModeleForm(f => ({ ...f, montant: e.target.value }))}
                className="input-field" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description *</label>
              <input type="text" required value={modeleForm.commentaire}
                onChange={e => setModeleForm(f => ({ ...f, commentaire: e.target.value }))}
                className="input-field" placeholder="Ex: Loyer, Netflix…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Catégorie</label>
              <select value={modeleForm.categorie_id} onChange={e => setModeleForm(f => ({ ...f, categorie_id: e.target.value }))} className="input-field">
                <option value="">Sans catégorie</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Récurrence</label>
              <select value={modeleForm.recurrence} onChange={e => setModeleForm(f => ({ ...f, recurrence: e.target.value }))} className="input-field">
                <option value="mensuel">Mensuel</option>
                <option value="bi-mensuel">Bi-mensuel (15 jours)</option>
                <option value="hebdomadaire">Hebdomadaire</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Prochaine date</label>
              <input type="date" required value={modeleForm.prochaine_date}
                onChange={e => setModeleForm(f => ({ ...f, prochaine_date: e.target.value }))}
                className="input-field" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={modeleForm.is_deductible}
                  onChange={e => setModeleForm(f => ({ ...f, is_deductible: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Déductible fiscalement</span>
              </label>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowModele(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={modeleSaving}
                className="btn-primary">
                {modeleSaving ? 'Enregistrement…' : 'Créer le modèle'}
              </button>
            </div>
          </form>
        )}

        {modeles.length === 0 ? (
          <EmptyState icon="inbox" title="Aucun modèle récurrent." description="Créez un modèle pour automatiser l'enregistrement de vos dépenses régulières (loyer, abonnements…)." />
        ) : (
          <div className="space-y-2">
            {modeles.map(m => {
              const echeance = new Date(m.prochaine_date)
              const auj = new Date(); auj.setHours(0,0,0,0)
              const jours = Math.ceil((echeance - auj) / 86400000)
              const urgence = jours <= 0 ? 'text-red-600 dark:text-red-400' : jours <= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 card-secondary hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <span className="text-lg flex-shrink-0">{m.icone || '🔄'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{m.commentaire}</p>
                      <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full flex-shrink-0">{m.recurrence}</span>
                      {m.is_deductible === 1 && <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex-shrink-0">🏛️ Déductible</span>}
                    </div>
                    <p className={`text-xs ${urgence}`}>
                      {m.categorie_nom && <span className="text-gray-400">{m.categorie_nom} · </span>}
                      {jours <= 0 ? `En retard de ${Math.abs(jours)}j` : jours === 0 ? "Aujourd'hui" : `Dans ${jours}j`}
                      {' · '}{new Date(m.prochaine_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className="font-semibold text-red-600 dark:text-red-400 text-sm whitespace-nowrap">{fmt(m.montant)}</span>
                  <button onClick={() => handleUtiliserModele(m.id)}
                    className="btn-primary text-xs whitespace-nowrap flex-shrink-0">
                    Enregistrer
                  </button>
                  <button onClick={() => handleDeleteModele(m.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0">
                    <TrashIcon />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {ConfirmDialog}
    </div>
  )
}



