import { useState, useEffect, useCallback } from 'react'
import { dettesApi, comptesApi, categoriesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { useToast } from '../components/Toast'
import { useConfirm } from '../hooks/useConfirm'
import { C } from '../utils/colors'
import EmptyState from '../components/EmptyState'
import { SkeletonListPage } from '../components/SkeletonLoader'
import { useEscape } from '../hooks/useEscape'
import DebtPlanner from '../components/DebtPlanner'

const TYPES_DETTE = ['credit', 'amende', 'auto-ecole', 'pret', 'autre']

const prioriteLabels = {
  1: { label: 'Haute',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  2: { label: 'Moyenne', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  3: { label: 'Basse',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}


function getUrgence(dette) {
  if (!dette.date_echeance) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const echeance = new Date(dette.date_echeance)
  const diff = Math.round((echeance - today) / 86400000)
  if (diff < 0)                   return { level: 'retard', jours: Math.abs(diff), diff }
  if (diff <= (dette.rappel_jours || 7)) return { level: 'urgent', jours: diff, diff }
  return { level: 'ok', jours: diff, diff }
}

function Dot({ color }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      backgroundColor: color, flexShrink: 0, marginRight: 4,
    }} />
  )
}

function BadgeEcheance({ dette }) {
  const u = getUrgence(dette)
  if (!u) return null
  if (u.level === 'retard')
    return <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium"><Dot color={C.danger} />En retard de {u.jours}j</span>
  if (u.level === 'urgent')
    return <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-medium"><Dot color={C.warning} />Dans {u.jours}j</span>
  return <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium"><Dot color={C.success} />{new Date(dette.date_echeance).toLocaleDateString('fr-FR')}</span>
}

const FORM_INIT = { nom: '', type: 'autre', montant_total: '', montant_restant: '', paiement_minimum: '', priorite: '2', sens: 'je_dois', date_echeance: '', rappel_jours: '7', taux_interet: '', compte_id: '', categorie_id: '' }

export default function Dettes() {
  const { fmt } = useAuth()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [onglet, setOnglet] = useState('je_dois')
  const [dettes, setDettes] = useState([])
  const [totalRestant, setTotalRestant] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(FORM_INIT)
  const formDirty = showAddForm && !!(addForm.nom || addForm.montant_total)
  useUnsavedChanges(formDirty)
  const [addError, setAddError] = useState(null)
  const [addLoading, setAddLoading] = useState(false)

  const [paiementModal, setPaiementModal] = useState(null)
  const [paiementForm, setPaiementForm] = useState({ montant: '', commentaire: '', compte_remboursement_id: '', categorie_remboursement_id: '' })
  const [paiementError, setPaiementError] = useState(null)
  const [paiementLoading, setPaiementLoading] = useState(false)
  const [paiementSuccess, setPaiementSuccess] = useState(null)
  const [felicitations, setFelicitations] = useState(null)

  const [showPlanner, setShowPlanner] = useState(false)

  const [editModal, setEditModal]   = useState(null)
  const [editForm, setEditForm]     = useState({})
  const [editError, setEditError]   = useState(null)
  const [editLoading, setEditLoading] = useState(false)

  const [comptesCredit, setComptesCredit] = useState([])
  const [comptesTous, setComptesTous] = useState([])
  const [categories, setCategories] = useState([])

  const charger = useCallback(() => {
    setLoading(true)
    dettesApi.lister({ actif: showArchived ? 0 : 1, sens: onglet })
      .then(d => { setDettes(d.dettes); setTotalRestant(d.total_restant) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [showArchived, onglet])

  useEffect(() => { charger() }, [charger])

  useEffect(() => {
    comptesApi.lister()
      .then(d => {
        const all = d.comptes || []
        setComptesCredit(all.filter(c => c.type === 'credit'))
        setComptesTous(all)
      })
      .catch(() => {})
    categoriesApi.lister()
      .then(d => setCategories(d.categories || []))
      .catch(() => {})
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError(null)
    setAddLoading(true)
    try {
      await dettesApi.creer({
        nom:              addForm.nom.trim(),
        type:             addForm.type,
        montant_total:    parseFloat(addForm.montant_total),
        montant_restant:  addForm.montant_restant ? parseFloat(addForm.montant_restant) : undefined,
        paiement_minimum: addForm.paiement_minimum ? parseFloat(addForm.paiement_minimum) : 0,
        priorite:         parseInt(addForm.priorite),
        sens:             addForm.sens,
        date_echeance:    addForm.date_echeance || undefined,
        rappel_jours:     parseInt(addForm.rappel_jours) || 7,
        taux_interet:     addForm.taux_interet ? parseFloat(addForm.taux_interet) : undefined,
        compte_id:        addForm.compte_id ? parseInt(addForm.compte_id) : undefined,
        categorie_id:     addForm.categorie_id ? parseInt(addForm.categorie_id) : undefined,
      })
      setAddForm({ ...FORM_INIT, sens: onglet })
      setShowAddForm(false)
      charger()
    } catch (e) {
      setAddError(e.message || 'Erreur lors de la création.')
    } finally {
      setAddLoading(false)
    }
  }

  const handlePaiement = async (e) => {
    e.preventDefault()
    setPaiementError(null)
    setPaiementLoading(true)
    try {
      const res = await dettesApi.payer(paiementModal.id, {
        montant:     parseFloat(paiementForm.montant),
        commentaire: paiementForm.commentaire || undefined,
        ...(paiementModal.sens === 'on_me_doit' && paiementForm.compte_remboursement_id && {
          compte_remboursement_id: parseInt(paiementForm.compte_remboursement_id),
        }),
        ...(paiementModal.sens === 'on_me_doit' && paiementForm.categorie_remboursement_id && {
          categorie_remboursement_id: parseInt(paiementForm.categorie_remboursement_id),
        }),
      })
      const detteId = paiementModal.id
      setPaiementModal(null)
      charger()
      if (res.felicitations) {
        setFelicitations(paiementModal.compte_nom || paiementModal.nom)
        setTimeout(() => setFelicitations(null), 6000)
      } else if (!res.dette?.actif) {
        setPaiementSuccess(res.message || '🎉 Soldé !')
        setTimeout(() => setPaiementSuccess(null), 3000)
      }
      // Vérifier si un plan sauvegardé inclut cette dette et notifier
      dettesApi.listerPlans().then(d => {
        const plansConcernes = (d.plans || []).filter(p => p.dette_ids.includes(detteId))
        if (plansConcernes.length > 0) {
          toast.info('Votre plan de remboursement a été mis à jour automatiquement.')
        }
      }).catch(() => {})
    } catch (e) {
      setPaiementError(e.message || 'Erreur lors du paiement.')
    } finally {
      setPaiementLoading(false)
    }
  }

  const handleArchiver = async (id) => {
    if (!await confirm('Archiver cette dette ?', { confirmLabel: 'Archiver' })) return
    try { await dettesApi.supprimer(id); charger() } catch (e) { toast.error(e.message) }
  }

  const handleSupprimer = async (id, nom) => {
    if (!await confirm(`Supprimer définitivement "${nom}" et tous ses paiements ? Cette action est irréversible.`, { danger: true, confirmLabel: 'Supprimer définitivement' })) return
    try { await dettesApi.supprimerForce(id); charger() } catch (e) { toast.error(e.message) }
  }

  const handleEditOpen = (d) => {
    setEditForm({
      nom:              d.nom,
      type:             d.type,
      montant_total:    String(d.montant_total),
      montant_restant:  String(d.montant_restant),
      paiement_minimum: String(d.paiement_minimum || ''),
      priorite:         String(d.priorite),
      date_echeance:    d.date_echeance ? d.date_echeance.slice(0, 10) : '',
      rappel_jours:     String(d.rappel_jours || 7),
      taux_interet:     d.taux_interet != null ? String(d.taux_interet) : '',
      compte_id:        d.compte_id != null ? String(d.compte_id) : '',
      categorie_id:     d.categorie_id != null ? String(d.categorie_id) : '',
    })
    setEditError(null)
    setEditModal(d)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditError(null)
    setEditLoading(true)
    try {
      await dettesApi.modifier(editModal.id, {
        nom:              editForm.nom.trim(),
        type:             editForm.type,
        montant_total:    parseFloat(editForm.montant_total),
        montant_restant:  parseFloat(editForm.montant_restant),
        paiement_minimum: editForm.paiement_minimum ? parseFloat(editForm.paiement_minimum) : 0,
        priorite:         parseInt(editForm.priorite),
        date_echeance:    editForm.date_echeance || null,
        rappel_jours:     parseInt(editForm.rappel_jours) || 7,
        taux_interet:     editForm.taux_interet ? parseFloat(editForm.taux_interet) : null,
        compte_id:        editForm.compte_id ? parseInt(editForm.compte_id) : null,
        categorie_id:     editForm.categorie_id ? parseInt(editForm.categorie_id) : null,
      })
      setEditModal(null)
      charger()
    } catch (e) {
      setEditError(e.message || 'Erreur lors de la modification.')
    } finally {
      setEditLoading(false)
    }
  }

  useEscape(() => setEditModal(null),    !!editModal)
  useEscape(() => setPaiementModal(null), !!paiementModal && !editModal)
  useEscape(() => setFelicitations(null), !!felicitations && !editModal && !paiementModal)

  const estCreance = onglet === 'on_me_doit'

  return (
    <div className="space-y-6">
      {/* ── En-tête ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dettes & Créances</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPlanner(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-sm rounded-lg font-medium transition-colors border border-indigo-200 dark:border-indigo-800"
          >
            Planifier le remboursement
          </button>
          <button onClick={() => setShowArchived(s => !s)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            {showArchived ? '📋 Actifs' : '🗃️ Archivés'}
          </button>
          {!showArchived && (
            <button onClick={() => { setShowAddForm(s => !s); setAddForm({ ...FORM_INIT, sens: onglet }); setAddError(null) }}
              className="btn-primary">
              + Ajouter
            </button>
          )}
        </div>
      </div>

      {/* ── Félicitations carte remboursée ── */}
      {felicitations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" onClick={() => setFelicitations(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="modal-felicitations-title" className="glass-modal p-8 max-w-sm w-full text-center border border-yellow-200 dark:border-yellow-700 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="text-6xl mb-4">🎉</div>
            <h2 id="modal-felicitations-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Félicitations !</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-1">
              Votre carte <strong className="text-indigo-600 dark:text-indigo-400">{felicitations}</strong> est entièrement remboursée.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Votre limite de crédit est de nouveau pleinement disponible.</p>
            <button
              onClick={() => setFelicitations(null)}
              className="btn-primary"
            >
              Merci 🙌
            </button>
          </div>
        </div>
      )}

      {paiementSuccess && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400 text-sm text-center font-medium">
          {paiementSuccess}
        </div>
      )}

      {/* ── Onglets ── */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {[
          { key: 'je_dois',    label: '💳 Je dois' },
          { key: 'on_me_doit', label: '💰 On me doit' },
        ].map(o => (
          <button key={o.key} onClick={() => { setOnglet(o.key); setShowArchived(false) }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              onglet === o.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {o.label}
          </button>
        ))}
      </div>

      {/* ── Total ── */}
      {!showArchived && (
        <div className={`rounded-xl p-4 border ${estCreance
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          <p className={`text-sm ${estCreance ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {estCreance ? 'Total à recevoir' : 'Total restant dû'}
          </p>
          <p className={`text-3xl font-bold ${estCreance ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
            {fmt(totalRestant)}
          </p>
        </div>
      )}

      {/* ── Formulaire ajout ── */}
      {showAddForm && !showArchived && (
        <div className="card-primary p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            {estCreance ? 'Nouvelle créance' : 'Nouvelle dette'}
          </h2>
          {addError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {addError}
            </div>
          )}
          <form onSubmit={handleAdd} className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                {estCreance ? 'Nom du débiteur *' : 'Nom de la dette *'}
              </label>
              <input type="text" required value={addForm.nom}
                onChange={e => setAddForm(f => ({ ...f, nom: e.target.value }))}
                className="input-field" placeholder={estCreance ? 'Jean Dupont' : 'Carte de crédit Visa'} />
            </div>

            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Type</label>
              <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))} className="input-field">
                {TYPES_DETTE.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Priorité</label>
              <select value={addForm.priorite} onChange={e => setAddForm(f => ({ ...f, priorite: e.target.value }))} className="input-field">
                <option value="1">1 — Haute</option>
                <option value="2">2 — Moyenne</option>
                <option value="3">3 — Basse</option>
              </select>
            </div>

            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant total *</label>
              <input type="number" step="0.01" min="0.01" required value={addForm.montant_total}
                onChange={e => setAddForm(f => ({ ...f, montant_total: e.target.value }))}
                className="input-field" placeholder="1200.00" />
            </div>
            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant restant</label>
              <input type="number" step="0.01" min="0" value={addForm.montant_restant}
                onChange={e => setAddForm(f => ({ ...f, montant_restant: e.target.value }))}
                className="input-field" placeholder="Laisser vide = même que le total" />
            </div>

            {!estCreance && (
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Paiement minimum</label>
                <input type="number" step="0.01" min="0" value={addForm.paiement_minimum}
                  onChange={e => setAddForm(f => ({ ...f, paiement_minimum: e.target.value }))}
                  className="input-field" placeholder="50.00" />
              </div>
            )}

            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Date d'échéance</label>
              <input type="date" value={addForm.date_echeance}
                onChange={e => setAddForm(f => ({ ...f, date_echeance: e.target.value }))}
                className="input-field" />
            </div>

            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                Rappel (jours avant l'échéance)
              </label>
              <input type="number" min="1" max="90" value={addForm.rappel_jours}
                onChange={e => setAddForm(f => ({ ...f, rappel_jours: e.target.value }))}
                className="input-field" placeholder="7" />
            </div>

            <div>
              <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                Taux d'intérêt (% annuel)
                <span className="ml-1 text-xs text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input type="number" min="0" max="100" step="0.01" value={addForm.taux_interet}
                onChange={e => setAddForm(f => ({ ...f, taux_interet: e.target.value }))}
                className="input-field" placeholder="Ex: 19.99" />
            </div>

            {!estCreance && (
              <div className="md:col-span-2">
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                  💳 Compte crédit lié
                  <span className="ml-1 text-xs text-gray-400 font-normal">(laisser vide pour créer automatiquement si type = Crédit)</span>
                </label>
                <select
                  value={addForm.compte_id}
                  onChange={e => setAddForm(f => ({ ...f, compte_id: e.target.value }))}
                  className="input-field"
                >
                  <option value="">
                    {addForm.type === 'credit' ? '✨ Créer automatiquement' : '— Aucun compte lié —'}
                  </option>
                  {comptesCredit.map(c => (
                    <option key={c.id} value={c.id}>{c.nom} · Disponible : {parseFloat(c.solde).toFixed(2)}</option>
                  ))}
                </select>
                {addForm.type === 'credit' && !addForm.compte_id && addForm.montant_total && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                    ✨ Compte crédit créé automatiquement — limite {addForm.montant_total}$ · disponible {((parseFloat(addForm.montant_total) || 0) - (parseFloat(addForm.montant_restant) || parseFloat(addForm.montant_total) || 0)).toFixed(2)}$.
                  </p>
                )}
                {addForm.compte_id && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                    ℹ️ Le crédit disponible du compte sera synchronisé et mis à jour à chaque paiement.
                  </p>
                )}
              </div>
            )}

            {estCreance && (
              <>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                    Compte source
                    <span className="ml-1 text-xs text-gray-400 font-normal">(le montant prêté sera déduit)</span>
                  </label>
                  <select value={addForm.compte_id}
                    onChange={e => setAddForm(f => ({ ...f, compte_id: e.target.value }))}
                    className="input-field">
                    <option value="">— Aucun compte —</option>
                    {comptesTous.map(c => (
                      <option key={c.id} value={c.id}>{c.nom} · {parseFloat(c.solde).toFixed(2)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                    Enveloppe source
                    <span className="ml-1 text-xs text-gray-400 font-normal">(le budget sera déduit)</span>
                  </label>
                  <select value={addForm.categorie_id}
                    onChange={e => setAddForm(f => ({ ...f, categorie_id: e.target.value }))}
                    className="input-field">
                    <option value="">— Aucune enveloppe —</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icone} {cat.nom}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={addLoading}
                className="btn-primary flex-1">
                {addLoading ? 'Enregistrement...' : (estCreance ? 'Créer la créance' : 'Créer la dette')}
              </button>
              <button type="button" onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Liste ── */}
      {loading ? (
        <SkeletonListPage />
      ) : dettes.length === 0 ? (
        <EmptyState
          icon={showArchived ? 'folder' : estCreance ? 'wallet' : 'card'}
          title={showArchived ? 'Aucun enregistrement archivé.' : estCreance ? "Personne ne vous doit d'argent." : 'Aucune dette active !'}
          description={showArchived ? 'Les dettes archivées ou soldées apparaissent ici.' : estCreance ? 'Ajoutez une créance pour suivre ce que quelqu\'un vous doit.' : 'Ajoutez une dette pour suivre vos remboursements.'}
        />
      ) : (
        <div className="space-y-4">
          {dettes.map(d => {
            const p   = prioriteLabels[d.priorite] || prioriteLabels[2]
            const pct = Math.min(100, parseFloat(d.progression_pct) || 0)
            return (
              <div key={d.id} className="card-primary p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{d.nom}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.cls}`}>{p.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{d.type}</span>
                      <BadgeEcheance dette={d} />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{fmt(d.montant_restant)}</span>
                      {' '}restants / {fmt(d.montant_total)}
                      {!estCreance && d.paiement_minimum > 0 && (
                        <span className="ml-3 text-xs">Min : {fmt(d.paiement_minimum)}/mois</span>
                      )}
                      {d.taux_interet > 0 && (
                        <span className="ml-3 text-xs text-red-500 dark:text-red-400">
                          · {d.taux_interet}% /an ≈ {fmt(parseFloat(d.montant_restant) * parseFloat(d.taux_interet) / 100)}/an d'intérêts
                        </span>
                      )}
                    </p>
                    {d.compte_nom && (
                      <p className="text-xs mt-1 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.compte_couleur || '#6366f1' }} />
                        <span className="text-gray-500 dark:text-gray-400">
                          Compte lié : <span className="font-medium" style={{ color: d.compte_couleur || '#6366f1' }}>{d.compte_nom}</span>
                          {!estCreance && <>{' '}· Solde dû : <span className="font-semibold text-red-600 dark:text-red-400">{fmt(d.compte_solde)}</span></>}
                        </span>
                      </p>
                    )}
                    {d.categorie_nom && (
                      <p className="text-xs mt-0.5 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.categorie_couleur || '#6366f1' }} />
                        <span className="text-gray-500 dark:text-gray-400">
                          Enveloppe : <span className="font-medium" style={{ color: d.categorie_couleur || '#6366f1' }}>{d.categorie_icone} {d.categorie_nom}</span>
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!showArchived && (
                      <button
                        onClick={() => {
                          setPaiementModal(d)
                          setPaiementError(null)
                          setPaiementSuccess(null)
                          setPaiementForm({
                            montant: (!estCreance && d.paiement_minimum) ? String(d.paiement_minimum) : '',
                            commentaire: '',
                            compte_remboursement_id: d.compte_id ? String(d.compte_id) : '',
                            categorie_remboursement_id: d.categorie_id ? String(d.categorie_id) : '',
                          })
                        }}
                        className={`px-3 py-1.5 text-white text-xs rounded-lg font-medium transition-colors ${
                          estCreance ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {estCreance ? '✅ Encaissé' : '💰 Payer'}
                      </button>
                    )}
                    {!showArchived && (
                      <button onClick={() => handleEditOpen(d)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        ✏️ Modifier
                      </button>
                    )}
                    {!showArchived && (
                      <button onClick={() => handleArchiver(d.id)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        Archiver
                      </button>
                    )}
                    <button onClick={() => handleSupprimer(d.id, d.nom)}
                      className="px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 text-xs rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full transition-all duration-500 ${estCreance ? 'bg-green-500' : 'bg-indigo-500'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{d.progression_pct}% {estCreance ? 'récupéré' : 'remboursé'}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal modification dette ── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in" onClick={() => setEditModal(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="modal-edit-title" className="glass-modal p-6 max-w-lg w-full my-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 id="modal-edit-title" className="text-lg font-semibold text-gray-900 dark:text-white">Modifier — {editModal.nom}</h3>
              <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            {editError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {editError}
              </div>
            )}
            <form onSubmit={handleEditSubmit} className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Nom *</label>
                <input type="text" required value={editForm.nom}
                  onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))}
                  className="input-field" />
              </div>

              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Type</label>
                <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} className="input-field">
                  {TYPES_DETTE.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Priorité</label>
                <select value={editForm.priorite} onChange={e => setEditForm(f => ({ ...f, priorite: e.target.value }))} className="input-field">
                  <option value="1">1 — Haute</option>
                  <option value="2">2 — Moyenne</option>
                  <option value="3">3 — Basse</option>
                </select>
              </div>

              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant total *</label>
                <input type="number" step="0.01" min="0.01" required value={editForm.montant_total}
                  onChange={e => setEditForm(f => ({ ...f, montant_total: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant restant *</label>
                <input type="number" step="0.01" min="0" required value={editForm.montant_restant}
                  onChange={e => setEditForm(f => ({ ...f, montant_restant: e.target.value }))}
                  className="input-field" />
              </div>

              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Paiement minimum</label>
                <input type="number" step="0.01" min="0" value={editForm.paiement_minimum}
                  onChange={e => setEditForm(f => ({ ...f, paiement_minimum: e.target.value }))}
                  className="input-field" placeholder="0.00" />
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Taux d'intérêt (% /an)</label>
                <input type="number" step="0.01" min="0" max="100" value={editForm.taux_interet}
                  onChange={e => setEditForm(f => ({ ...f, taux_interet: e.target.value }))}
                  className="input-field" placeholder="Ex : 19.99" />
              </div>

              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Date d'échéance</label>
                <input type="date" value={editForm.date_echeance}
                  onChange={e => setEditForm(f => ({ ...f, date_echeance: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Rappel (jours avant)</label>
                <input type="number" min="1" max="90" value={editForm.rappel_jours}
                  onChange={e => setEditForm(f => ({ ...f, rappel_jours: e.target.value }))}
                  className="input-field" />
              </div>

              {editModal?.sens === 'je_dois' && (
                <div className="md:col-span-2">
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">💳 Compte crédit lié</label>
                  <select value={editForm.compte_id} onChange={e => setEditForm(f => ({ ...f, compte_id: e.target.value }))} className="input-field">
                    <option value="">— Aucun compte lié —</option>
                    {comptesCredit.map(c => (
                      <option key={c.id} value={c.id}>{c.nom} · Disponible : {parseFloat(c.solde).toFixed(2)}</option>
                    ))}
                  </select>
                </div>
              )}
              {editModal?.sens === 'on_me_doit' && (
                <>
                  <div>
                    <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Compte source</label>
                    <select value={editForm.compte_id} onChange={e => setEditForm(f => ({ ...f, compte_id: e.target.value }))} className="input-field">
                      <option value="">— Aucun compte —</option>
                      {comptesTous.map(c => (
                        <option key={c.id} value={c.id}>{c.nom} · {parseFloat(c.solde).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Enveloppe source</label>
                    <select value={editForm.categorie_id} onChange={e => setEditForm(f => ({ ...f, categorie_id: e.target.value }))} className="input-field">
                      <option value="">— Aucune enveloppe —</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icone} {cat.nom}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="md:col-span-2 flex gap-3 pt-1">
                <button type="submit" disabled={editLoading}
                  className="btn-primary flex-1">
                  {editLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
                <button type="button" onClick={() => setEditModal(null)}
                  className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal paiement / encaissement ── */}
      {paiementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setPaiementModal(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="modal-paiement-title" className="glass-modal p-6 max-w-md w-full animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 id="modal-paiement-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                {paiementModal.sens === 'on_me_doit' ? 'Enregistrer un encaissement' : 'Enregistrer un paiement'}
              </h3>
              <button onClick={() => setPaiementModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              <strong className="text-gray-700 dark:text-gray-300">{paiementModal.nom}</strong>
              {' '}· Restant : <strong className={paiementModal.sens === 'on_me_doit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {fmt(paiementModal.montant_restant)}
              </strong>
            </p>
            {paiementModal.compte_nom && (
              <div className="mb-4 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs text-indigo-700 dark:text-indigo-300">
                💳 Ce paiement réduira aussi le solde de <strong>{paiementModal.compte_nom}</strong> (actuellement <strong>{fmt(paiementModal.compte_solde)}</strong>).
              </div>
            )}
            {paiementSuccess && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm text-center">
                {paiementSuccess}
              </div>
            )}
            {paiementError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {paiementError}
              </div>
            )}
            <form onSubmit={handlePaiement} className="space-y-4">
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant *</label>
                <input type="number" step="0.01" min="0.01" required
                  max={parseFloat(paiementModal.montant_restant)}
                  value={paiementForm.montant}
                  onChange={e => setPaiementForm(f => ({ ...f, montant: e.target.value }))}
                  className="input-field" />
              </div>
              <div>
                <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Commentaire</label>
                <input type="text" value={paiementForm.commentaire}
                  onChange={e => setPaiementForm(f => ({ ...f, commentaire: e.target.value }))}
                  className="input-field" placeholder={paiementModal.sens === 'on_me_doit' ? 'Virement reçu...' : 'Paiement mensuel...'} />
              </div>
              {paiementModal.sens === 'on_me_doit' && (
                <>
                  <div>
                    <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                      Compte de réception
                      <span className="ml-1 text-xs text-gray-400 font-normal">(le remboursement sera crédité ici)</span>
                    </label>
                    <select value={paiementForm.compte_remboursement_id}
                      onChange={e => setPaiementForm(f => ({ ...f, compte_remboursement_id: e.target.value }))}
                      className="input-field">
                      <option value="">— Aucun compte —</option>
                      {comptesTous.map(c => (
                        <option key={c.id} value={c.id}>{c.nom} · {parseFloat(c.solde).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                      Enveloppe de réception
                      <span className="ml-1 text-xs text-gray-400 font-normal">(le budget sera recrédité ici)</span>
                    </label>
                    <select value={paiementForm.categorie_remboursement_id}
                      onChange={e => setPaiementForm(f => ({ ...f, categorie_remboursement_id: e.target.value }))}
                      className="input-field">
                      <option value="">— Aucune enveloppe —</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icone} {cat.nom}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <button type="submit" disabled={paiementLoading}
                className={`w-full py-2.5 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors ${
                  paiementModal.sens === 'on_me_doit' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}>
                {paiementLoading ? 'Enregistrement...' : (paiementModal.sens === 'on_me_doit' ? 'Confirmer l\'encaissement' : 'Confirmer le paiement')}
              </button>
            </form>
          </div>
        </div>
      )}
      {ConfirmDialog}
      {showPlanner && <DebtPlanner onClose={() => setShowPlanner(false)} />}
    </div>
  )
}







