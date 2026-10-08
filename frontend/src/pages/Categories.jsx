import { useState, useEffect } from 'react'
import { categoriesApi, revenusApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { useConfirm } from '../hooks/useConfirm'
import EmptyState from '../components/EmptyState'
import { SkeletonListPage } from '../components/SkeletonLoader'
import { useEscape } from '../hooks/useEscape'
import CategoryIcon, { CATEGORY_ICONS } from '../components/CategoryIcon'
import { AlertTriangle, Target, CheckCircle, XCircle, RefreshCw } from '../components/Icons'

const ICON_KEYS = Object.keys(CATEGORY_ICONS)
const COLORS = ['#6366f1','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7','#ec4899','#14b8a6','#f59e0b','#84cc16','#06b6d4']
const FORM_INIT = { nom: '', type: 'pourcentage', valeur: '', couleur: '#6366f1', icone: 'wallet', ordre: '', seuil_alerte: '', objectif: '', plafond_mensuel: '' }

export default function Categories() {
  const { fmt } = useAuth()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [categories, setCategories] = useState([])
  const [totalSoldes, setTotalSoldes] = useState(0)
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState(FORM_INIT)
  const [formError, setFormError]     = useState(null)
  const [formLoading, setFormLoading] = useState(false)

  const [redistLoading, setRedistLoading] = useState(false)
  const [redistMsg, setRedistMsg]         = useState(null)

  const [virModal, setVirModal]     = useState(null)
  const [virForm, setVirForm]       = useState({ to_id: '', montant: '', commentaire: '' })
  const [virError, setVirError]     = useState(null)
  const [virLoading, setVirLoading] = useState(false)

  const [adjModal, setAdjModal]     = useState(null)
  const [adjForm, setAdjForm]       = useState({ montant: '', operation: 'set' })
  const [adjError, setAdjError]     = useState(null)
  const [adjLoading, setAdjLoading] = useState(false)

  const charger = () => {
    setLoading(true)
    categoriesApi.lister()
      .then(d => { setCategories(d.categories); setTotalSoldes(d.total_soldes) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { charger() }, [])

  const openAdd  = () => { setEditing(null); setForm(FORM_INIT); setFormError(null); setShowForm(true) }
  const openEdit = (cat) => {
    setEditing(cat.id)
    setForm({
      nom: cat.nom, type: cat.type, valeur: String(cat.valeur),
      couleur: cat.couleur, icone: cat.icone, ordre: String(cat.ordre),
      seuil_alerte:    cat.seuil_alerte    != null ? String(cat.seuil_alerte)    : '',
      objectif:        cat.objectif        != null ? String(cat.objectif)        : '',
      plafond_mensuel: cat.plafond_mensuel != null ? String(cat.plafond_mensuel) : '',
    })
    setFormError(null); setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormError(null); setFormLoading(true)
    try {
      const data = {
        nom: form.nom.trim(), type: form.type,
        valeur: parseFloat(form.valeur), couleur: form.couleur, icone: form.icone,
        ordre:           form.ordre           !== '' ? parseInt(form.ordre)              : undefined,
        seuil_alerte:    form.seuil_alerte    !== '' ? parseFloat(form.seuil_alerte)    : null,
        objectif:        form.objectif        !== '' ? parseFloat(form.objectif)        : null,
        plafond_mensuel: form.plafond_mensuel !== '' && form.type === 'fixe' ? parseFloat(form.plafond_mensuel) : null,
      }
      if (editing) await categoriesApi.modifier(editing, data)
      else         await categoriesApi.creer(data)
      setShowForm(false); charger()
    } catch (e) { setFormError(e.message || 'Erreur') }
    finally { setFormLoading(false) }
  }

  const handleDelete = async (id) => {
    if (!await confirm('Désactiver cette catégorie ?', { confirmLabel: 'Désactiver' })) return
    try { await categoriesApi.supprimer(id); charger() } catch (e) { toast.error(e.message) }
  }

  const handleRedistribuer = async () => {
    if (!await confirm('Recalculer la répartition de TOUS vos revenus ? Les soldes seront recalculés depuis zéro.', { confirmLabel: 'Redistribuer', title: 'Redistribution complète' })) return
    setRedistLoading(true); setRedistMsg(null)
    try {
      const res = await revenusApi.redistribuer()
      setRedistMsg({ ok: true, text: res.message }); charger()
    } catch (e) { setRedistMsg({ ok: false, text: e.message || 'Erreur.' }) }
    finally { setRedistLoading(false) }
  }

  const handleVirement = async (e) => {
    e.preventDefault(); setVirError(null); setVirLoading(true)
    try {
      await categoriesApi.virer({ from_id: virModal.id, to_id: parseInt(virForm.to_id), montant: parseFloat(virForm.montant), commentaire: virForm.commentaire || undefined })
      setVirModal(null); charger()
    } catch (e) { setVirError(e.message || 'Erreur') }
    finally { setVirLoading(false) }
  }

  const handleAjustement = async (e) => {
    e.preventDefault(); setAdjError(null); setAdjLoading(true)
    try {
      await categoriesApi.ajusterSolde(adjModal.id, { montant: parseFloat(adjForm.montant), operation: adjForm.operation })
      setAdjModal(null); charger()
    } catch (e) { setAdjError(e.message || 'Erreur') }
    finally { setAdjLoading(false) }
  }

  useEscape(() => setShowForm(false), showForm)
  useEscape(() => setVirModal(null),  !!virModal && !showForm)
  useEscape(() => setAdjModal(null),  !!adjModal && !showForm && !virModal)

  const autresCats = virModal ? categories.filter(c => c.id !== virModal.id) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Catégories</h1>
          {totalSoldes > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Total disponible : <span className="text-green-600 dark:text-green-400 font-semibold">{fmt(totalSoldes)}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleRedistribuer} disabled={redistLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
            <RefreshCw size={14} strokeWidth={2} className={redistLoading ? 'animate-spin' : ''} />
            {redistLoading ? 'Recalcul...' : 'Redistribuer'}
          </button>
          <button onClick={openAdd} className="btn-primary">
            + Ajouter
          </button>
        </div>
      </div>

      {redistMsg && (
        <div className={`p-3 rounded-lg text-sm ${redistMsg.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
          {redistMsg.text}
        </div>
      )}

      {/* ── Modal formulaire catégorie ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="modal-cat-title" className="glass-modal p-6 max-w-md w-full max-h-[90vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 id="modal-cat-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            {formError && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{formError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Nom *</label>
                <input type="text" required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="input-field" placeholder="Épargne" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Type *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field">
                    <option value="pourcentage">Pourcentage</option>
                    <option value="fixe">Montant fixe</option>
                  </select>
                </div>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                    {form.type === 'pourcentage' ? 'Valeur (%) *' : 'Valeur *'}
                  </label>
                  <input type="number" step="0.01" min="0" required value={form.valeur}
                    onChange={e => setForm(f => ({ ...f, valeur: e.target.value }))} className="input-field" placeholder={form.type === 'pourcentage' ? '10' : '500'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                    <AlertTriangle size={13} className="text-amber-500" /> Alerte si solde &lt;
                  </label>
                  <input type="number" step="0.01" min="0" value={form.seuil_alerte}
                    onChange={e => setForm(f => ({ ...f, seuil_alerte: e.target.value }))} className="input-field" placeholder="50" />
                </div>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                    <Target size={13} className="text-indigo-500" /> Objectif d'épargne
                  </label>
                  <input type="number" step="0.01" min="0" value={form.objectif}
                    onChange={e => setForm(f => ({ ...f, objectif: e.target.value }))} className="input-field" placeholder="5000" />
                </div>
              </div>
              {form.type === 'fixe' && (
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                    <CheckCircle size={13} className="text-green-500" /> Plafond mensuel
                    <span className="ml-1 text-xs text-gray-400 font-normal">(optionnel)</span>
                  </label>
                  <input type="number" step="0.01" min="0" value={form.plafond_mensuel}
                    onChange={e => setForm(f => ({ ...f, plafond_mensuel: e.target.value }))}
                    className="input-field" placeholder={form.valeur || '800'} />
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                    Une fois ce montant atteint dans le mois, les nouveaux revenus sautent cette catégorie.
                  </p>
                </div>
              )}

              {/* ── Picker icône SVG ── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Icône</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {ICON_KEYS.map(key => {
                    const { Icon, label } = CATEGORY_ICONS[key]
                    const selected = form.icone === key
                    return (
                      <button
                        key={key}
                        type="button"
                        title={label}
                        onClick={() => setForm(f => ({ ...f, icone: key }))}
                        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                          selected
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        <Icon size={18} strokeWidth={1.75} />
                      </button>
                    )
                  })}
                </div>
                {/* Label de l'icône sélectionnée */}
                {CATEGORY_ICONS[form.icone] && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                    Sélectionné : <span className="font-medium text-gray-600 dark:text-gray-300">{CATEGORY_ICONS[form.icone].label}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, couleur: c }))}
                      className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${form.couleur === c ? 'ring-2 ring-offset-2 ring-gray-500 dark:ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Ordre d'affichage</label>
                <input type="number" min="0" value={form.ordre}
                  onChange={e => setForm(f => ({ ...f, ordre: e.target.value }))} className="input-field" placeholder="0" />
              </div>
              <button type="submit" disabled={formLoading} className="btn-primary w-full">
                {formLoading ? 'Enregistrement...' : (editing ? 'Sauvegarder' : 'Créer la catégorie')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Grille catégories ── */}
      {loading ? (
        <SkeletonListPage />
      ) : categories.length === 0 ? (
        <EmptyState icon="folder" title="Aucune catégorie active." description="Créez une catégorie pour organiser la répartition de vos revenus." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map(cat => {
            const solde = parseFloat(cat.solde || 0)
            const estPaye = !!cat.est_paye
            const alerte = cat.seuil_alerte != null && solde <= parseFloat(cat.seuil_alerte) && !estPaye
            const objPct = cat.objectif > 0 ? Math.min(100, Math.round(solde / cat.objectif * 100)) : null
            const budgetPct = cat.plafond_mensuel > 0 ? Math.max(0, Math.min(100, Math.round(solde / cat.plafond_mensuel * 100))) : null
            const enveloppePrel = cat.plafond_mensuel != null && solde <= 0 && !estPaye
            const borderCls = estPaye
              ? 'border-green-400 dark:border-green-600'
              : budgetPct !== null && budgetPct <= 20
                ? enveloppePrel ? 'border-orange-400 dark:border-orange-600' : 'border-red-400 dark:border-red-600'
                : alerte || (budgetPct !== null && budgetPct <= 50)
                  ? 'border-orange-300 dark:border-orange-700'
                  : 'border-gray-200 dark:border-gray-700'
            return (
              <div key={cat.id} className={`bg-white dark:bg-gray-800 rounded-xl p-4 group relative border ${borderCls}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: cat.couleur }}>
                      <CategoryIcon icone={cat.icone} size={26} />
                    </span>
                    {alerte && (
                      <span className="text-amber-500" title={`Alerte : solde sous ${fmt(cat.seuil_alerte)}`}>
                        <AlertTriangle size={14} strokeWidth={2} />
                      </span>
                    )}
                  </div>
                  <div className="hidden group-hover:flex gap-1">
                    <button
                      onClick={() => { setVirModal(cat); setVirForm({ to_id: '', montant: '', commentaire: '' }); setVirError(null) }}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors text-sm"
                      title="Virer vers..."
                    >↔</button>
                    <button
                      onClick={() => { setAdjModal(cat); setAdjForm({ montant: String(solde.toFixed(2)), operation: 'set' }); setAdjError(null) }}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Corriger le solde"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={() => openEdit(cat)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(cat.id)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1 truncate">{cat.nom}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {cat.type === 'pourcentage' ? `${cat.valeur}% du revenu` : `${cat.valeur} fixe`}
                </p>
                <p className="text-xl font-bold mt-2" style={{ color: cat.couleur }}>{fmt(solde)}</p>

                {objPct !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span className="flex items-center gap-1">
                        <Target size={11} className="text-indigo-400" /> Objectif
                      </span>
                      <span>{objPct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${objPct}%`, backgroundColor: cat.couleur }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(solde)} / {fmt(cat.objectif)}</p>
                  </div>
                )}

                {alerte && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1.5 font-medium flex items-center gap-1">
                    <AlertTriangle size={11} /> Solde bas — seuil : {fmt(cat.seuil_alerte)}
                  </p>
                )}

                {budgetPct !== null && (
                  <div className="mt-2">
                    {estPaye ? (
                      // État : facture payée
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <CheckCircle size={13} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span className="text-xs font-semibold text-green-700 dark:text-green-300">{cat.nom} payé</span>
                      </div>
                    ) : enveloppePrel ? (
                      // État : prélevée sans paiement de facture
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <AlertTriangle size={13} className="text-orange-600 dark:text-orange-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-orange-700 dark:text-orange-300">Enveloppe prélevée — facture non payée</span>
                      </div>
                    ) : (
                      // État normal : barre de progression
                      <>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={`flex items-center gap-1 ${budgetPct <= 20 ? 'text-red-600 dark:text-red-400 font-semibold' : budgetPct <= 50 ? 'text-orange-500 dark:text-orange-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                            {budgetPct <= 20
                              ? <><XCircle size={11} /> Enveloppe presque vide</>
                              : budgetPct <= 50
                                ? <><AlertTriangle size={11} /> Enveloppe à moitié</>
                                : <><CheckCircle size={11} /> Enveloppe bien garnie</>
                            }
                          </span>
                          <span className={budgetPct <= 20 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400'}>{budgetPct}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full transition-all ${budgetPct <= 20 ? 'bg-red-500' : budgetPct <= 50 ? 'bg-orange-400' : 'bg-green-500'}`}
                            style={{ width: `${budgetPct}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{fmt(solde)} / {fmt(cat.plafond_mensuel)} disponible</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal virement ── */}
      {virModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setVirModal(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="modal-vir-title" className="glass-modal p-6 max-w-sm w-full animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 id="modal-vir-title" className="text-lg font-semibold text-gray-900 dark:text-white">Virer depuis {virModal.nom}</h3>
              <button onClick={() => setVirModal(null)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Disponible : <strong style={{ color: virModal.couleur }}>{fmt(virModal.solde)}</strong></p>
            {virError && <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{virError}</div>}
            <form onSubmit={handleVirement} className="space-y-3">
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Vers *</label>
                <select required value={virForm.to_id} onChange={e => setVirForm(f => ({ ...f, to_id: e.target.value }))} className="input-field">
                  <option value="">— Choisir —</option>
                  {autresCats.map(c => <option key={c.id} value={c.id}>{c.nom} ({fmt(c.solde)})</option>)}
                </select>
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant *</label>
                <input type="number" step="0.01" min="0.01" required max={parseFloat(virModal.solde)}
                  value={virForm.montant} onChange={e => setVirForm(f => ({ ...f, montant: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Motif</label>
                <input type="text" value={virForm.commentaire} onChange={e => setVirForm(f => ({ ...f, commentaire: e.target.value }))} className="input-field" placeholder="Rééquilibrage..." />
              </div>
              <button type="submit" disabled={virLoading} className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {virLoading ? 'Virement...' : 'Confirmer le virement'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal ajustement solde ── */}
      {adjModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setAdjModal(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="modal-adj-title" className="glass-modal p-6 max-w-sm w-full animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 id="modal-adj-title" className="text-lg font-semibold text-gray-900 dark:text-white">Corriger — {adjModal.nom}</h3>
              <button onClick={() => setAdjModal(null)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            {adjError && <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{adjError}</div>}
            <form onSubmit={handleAjustement} className="space-y-3">
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Opération</label>
                <select value={adjForm.operation} onChange={e => setAdjForm(f => ({ ...f, operation: e.target.value }))} className="input-field">
                  <option value="set">Définir exactement à</option>
                  <option value="add">Ajouter au solde actuel</option>
                </select>
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant *</label>
                <input type="number" step="0.01" required value={adjForm.montant}
                  onChange={e => setAdjForm(f => ({ ...f, montant: e.target.value }))} className="input-field" />
              </div>
              <button type="submit" disabled={adjLoading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {adjLoading ? 'Sauvegarde...' : 'Appliquer la correction'}
              </button>
            </form>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  )
}
