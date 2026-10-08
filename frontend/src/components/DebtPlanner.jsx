import { useState, useEffect } from 'react'
import { dettesApi } from '../api'
import { useAuth } from '../context/AuthContext'

export default function DebtPlanner({ onClose }) {
  const { fmt } = useAuth()

  const [step, setStep]           = useState(0) // 0=accueil, 1=sélection, 2=date, 3=résultat
  const [dettes, setDettes]       = useState([])
  const [savedPlans, setSavedPlans] = useState([])
  const [initDone, setInitDone]   = useState(false)

  const [selected, setSelected]         = useState([])
  const [dateCible, setDateCible]       = useState('')
  const [budgetCustom, setBudgetCustom] = useState('')
  const [activePlanId, setActivePlanId] = useState(null)

  const [result, setResult]           = useState(null)
  const [forceOriginal, setForceOriginal] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)

  const [showSaveForm, setShowSaveForm] = useState(false)
  const [planNom, setPlanNom]           = useState('')
  const [saving, setSaving]             = useState(false)
  const [saveConfirm, setSaveConfirm]   = useState(false)

  useEffect(() => {
    Promise.all([
      dettesApi.lister({ sens: 'je_dois', actif: 1 }).then(d => setDettes(d.dettes)).catch(() => {}),
      dettesApi.listerPlans().then(d => setSavedPlans(d.plans || [])).catch(() => {}),
    ]).finally(() => setInitDone(true))
  }, [])

  // Passe directement à l'étape 1 si aucun plan sauvegardé
  useEffect(() => {
    if (initDone && step === 0 && savedPlans.length === 0) setStep(1)
  }, [initDone, savedPlans.length])

  const totalSelected = dettes
    .filter(d => selected.includes(d.id))
    .reduce((s, d) => s + parseFloat(d.montant_restant), 0)

  const toggle = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const calculer = async (dateOverride = null) => {
    setLoading(true); setError(null)
    try {
      const res = await dettesApi.planifier({
        dette_ids:             selected,
        date_cible:            dateOverride ?? dateCible,
        budget_mensuel_custom: budgetCustom ? parseFloat(budgetCustom) : null,
      })
      setResult(res)
      setForceOriginal(false)
      setShowSaveForm(false)
      setSaveConfirm(false)
      setStep(3)
    } catch (e) {
      setError(e.message || 'Erreur lors du calcul.')
    } finally {
      setLoading(false)
    }
  }

  const chargerPlan = async (plan) => {
    const ids = plan.dette_ids
    let date  = plan.date_cible?.slice(0, 10)
    const bgt = plan.budget_mensuel_custom ? String(plan.budget_mensuel_custom) : ''

    // Si la date est dépassée, proposer une nouvelle date = aujourd'hui + durée initiale
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (new Date(date) <= today) {
      const created  = new Date(plan.created_at)
      const moisInit = Math.max(1, Math.round((new Date(plan.date_cible) - created) / (1000 * 60 * 60 * 24 * 30)))
      const newDate  = new Date(today)
      newDate.setMonth(newDate.getMonth() + moisInit)
      date = newDate.toISOString().slice(0, 10)
    }

    setSelected(ids)
    setDateCible(date)
    setBudgetCustom(bgt)
    setActivePlanId(plan.id)
    setError(null)
    setLoading(true)
    try {
      const res = await dettesApi.planifier({
        dette_ids:             ids,
        date_cible:            date,
        budget_mensuel_custom: plan.budget_mensuel_custom || null,
      })
      setResult(res)
      setForceOriginal(false)
      setShowSaveForm(false)
      setSaveConfirm(false)
      setStep(3)
    } catch (e) {
      setError(e.message || 'Impossible de charger ce plan.')
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  const sauvegarder = async () => {
    if (!planNom.trim()) return
    setSaving(true)
    try {
      const payload = {
        nom:                   planNom.trim(),
        dette_ids:             selected,
        date_cible:            dateCible,
        budget_mensuel_custom: budgetCustom ? parseFloat(budgetCustom) : null,
      }
      if (activePlanId) {
        const data = await dettesApi.mettreAJourPlan(activePlanId, payload)
        setSavedPlans(prev => prev.map(p => p.id === activePlanId ? data.plan : p))
      } else {
        const data = await dettesApi.sauvegarderPlan(payload)
        setSavedPlans(prev => [...prev, data.plan])
        setActivePlanId(data.plan.id)
      }
      setShowSaveForm(false)
      setPlanNom('')
      setSaveConfirm(true)
      setTimeout(() => setSaveConfirm(false), 3000)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const supprimerPlan = async (id) => {
    try {
      await dettesApi.supprimerPlan(id)
      setSavedPlans(prev => prev.filter(p => p.id !== id))
      if (activePlanId === id) setActivePlanId(null)
    } catch {}
  }

  const nouveauPlan = () => {
    setSelected([]); setDateCible(''); setBudgetCustom('')
    setActivePlanId(null); setResult(null); setError(null)
    setForceOriginal(false); setShowSaveForm(false); setSaveConfirm(false)
    setStep(1)
  }

  const minDate = (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const planActif = savedPlans.find(p => p.id === activePlanId)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div
        role="dialog" aria-modal="true" aria-labelledby="planner-title"
        className="glass-modal p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 id="planner-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Planificateur de remboursement
            </h2>
            {step > 0 && (
              <div className="flex gap-1.5 mt-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-1 rounded-full transition-all duration-300 ${
                    s < step  ? 'bg-indigo-400 w-4' :
                    s === step ? 'bg-indigo-600 w-8' :
                                 'bg-gray-200 dark:bg-gray-700 w-4'
                  }`} />
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Fermer"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none">×</button>
        </div>

        {/* ── Étape 0 : Accueil / plans sauvegardés ── */}
        {step === 0 && (
          <div>
            {!initDone ? (
              <div className="space-y-2 mb-4">
                {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Plans sauvegardés
                </p>
                <div className="space-y-2 mb-5">
                  {savedPlans.map(plan => (
                    <div key={plan.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{plan.nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Objectif {new Date(plan.date_cible).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                          {' · '}{plan.dette_ids.length} dette{plan.dette_ids.length > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                          Mis à jour {new Date(plan.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => chargerPlan(plan)} disabled={loading}
                        className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors flex-shrink-0"
                      >
                        {loading ? '…' : 'Charger'}
                      </button>
                      <button
                        onClick={() => supprimerPlan(plan.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 text-xl leading-none"
                        title="Supprimer"
                      >×</button>
                    </div>
                  ))}
                </div>
                <button onClick={nouveauPlan}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
                  + Créer un nouveau plan
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Étape 1 : Sélection des dettes ── */}
        {step === 1 && (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Sélectionnez les dettes à inclure dans votre plan de remboursement.
            </p>

            {!initDone ? (
              <div className="space-y-2 mb-5">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
              </div>
            ) : dettes.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">
                Aucune dette active à rembourser.
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {dettes.map(d => (
                  <label key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selected.includes(d.id)
                      ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-600 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}>
                    <input type="checkbox" className="accent-indigo-600 w-4 h-4 flex-shrink-0"
                      checked={selected.includes(d.id)} onChange={() => toggle(d.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.nom}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Min. {fmt(d.paiement_minimum)}/mois
                        {d.taux_interet ? ` · ${d.taux_interet}% intérêt` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 flex-shrink-0">
                      {fmt(d.montant_restant)}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {selected.length > 0 && (
              <div className="flex justify-between items-center px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl mb-4 text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {selected.length} dette{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{fmt(totalSelected)}</span>
              </div>
            )}

            <div className="flex gap-3">
              {savedPlans.length > 0 && (
                <button onClick={() => setStep(0)}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors">
                  ← Plans
                </button>
              )}
              <button onClick={() => setStep(2)} disabled={selected.length === 0}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors">
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 2 : Date cible et budget ── */}
        {step === 2 && (
          <div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl mb-5 flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total à rembourser</span>
              <span className="font-bold text-gray-800 dark:text-gray-200">{fmt(totalSelected)}</span>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="text-label text-gray-600 dark:text-gray-400 mb-1.5">
                  Pour quand souhaitez-vous avoir tout remboursé ? *
                </label>
                <input type="date" min={minDate} value={dateCible}
                  onChange={e => setDateCible(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="text-label text-gray-600 dark:text-gray-400 mb-1.5">
                  Combien pouvez-vous allouer aux remboursements chaque mois ?
                  <span className="ml-1 text-xs text-gray-400 font-normal">(optionnel)</span>
                </label>
                <div className="relative">
                  <input type="number" step="1" min="1" value={budgetCustom}
                    onChange={e => setBudgetCustom(e.target.value)}
                    className="input-field pr-10" placeholder="Calculé depuis vos revenus si vide" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep(1); setError(null) }}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors">
                ← Retour
              </button>
              <button onClick={() => calculer()} disabled={!dateCible || loading}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors">
                {loading ? 'Calcul en cours…' : 'Analyser →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Résultats ── */}
        {step === 3 && result && (
          <div>
            {planActif && (
              <div className="mb-3 flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
                <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                Plan chargé : <strong>{planActif.nom}</strong>
                <span className="text-gray-400 dark:text-gray-500 ml-auto">Recalculé depuis les soldes actuels</span>
              </div>
            )}

            {/* Cas : faisable ou l'utilisateur insiste malgré tout */}
            {(result.faisable || forceOriginal) ? (
              <div>
                {forceOriginal && !result.faisable && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Ce plan dépasse votre budget estimé de {fmt(result.budget_disponible)}/mois.
                      Assurez-vous d'avoir les fonds nécessaires pour tenir ce rythme.
                    </p>
                  </div>
                )}

                <div className="mb-5 p-5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl text-center">
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium uppercase tracking-wide mb-1">
                    Paiement mensuel total
                  </p>
                  <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                    {fmt(result.paiement_mensuel_requis)}
                  </p>
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                    pendant {result.mois_restants} mois · objectif{' '}
                    {new Date(result.date_cible).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </p>
                </div>

                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Répartition par dette
                </p>
                <div className="space-y-2 mb-4">
                  {result.plan_par_dette.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.nom}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {fmt(d.montant_restant)} restant
                          {d.taux_interet ? ` · ${d.taux_interet}% intérêt` : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          {fmt(d.paiement_mensuel)}<span className="font-normal text-xs">/mois</span>
                        </p>
                        <p className="text-xs text-gray-400">{d.pct_du_plan}% du plan</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-xs text-gray-400 dark:text-gray-500 mb-4">
                  Basé sur un revenu mensuel moyen de {fmt(result.revenu_moyen)}
                  {result.minimums_non_selectionnes > 0
                    ? `, moins ${fmt(result.minimums_non_selectionnes)} de paiements minimums sur vos autres dettes.`
                    : '.'}
                  {' '}Les montants se mettent à jour automatiquement à chaque paiement enregistré.
                </div>

                {/* Section sauvegarde */}
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-2">
                  {saveConfirm && (
                    <p className="text-xs text-green-600 dark:text-green-400 text-center font-medium">
                      Plan sauvegardé avec succès.
                    </p>
                  )}
                  {!showSaveForm ? (
                    <button
                      onClick={() => { setShowSaveForm(true); setPlanNom(planActif?.nom || '') }}
                      className="w-full py-2 border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl text-sm font-medium transition-colors"
                    >
                      {activePlanId ? 'Mettre à jour le plan sauvegardé' : 'Sauvegarder ce plan'}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text" value={planNom} onChange={e => setPlanNom(e.target.value)}
                        className="input-field flex-1" placeholder="Nom du plan (ex: Plan 2026)"
                        onKeyDown={e => e.key === 'Enter' && sauvegarder()}
                        autoFocus
                      />
                      <button onClick={sauvegarder} disabled={saving || !planNom.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0">
                        {saving ? '…' : 'OK'}
                      </button>
                      <button onClick={() => setShowSaveForm(false)}
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-xl text-sm transition-colors">
                        ×
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setStep(2); setResult(null); setError(null) }}
                      className="flex-1 py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      ← Modifier
                    </button>
                    <button onClick={onClose}
                      className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors">
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Cas : non faisable */
              <div>
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                    Ce délai est difficile à tenir
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500 leading-relaxed">
                    Pour rembourser <strong>{fmt(result.total_restant)}</strong> en {result.mois_restants} mois,
                    il vous faudrait <strong>{fmt(result.paiement_mensuel_requis)}/mois</strong>.
                    Votre budget estimé disponible est de <strong>{fmt(result.budget_disponible)}/mois</strong>.
                  </p>
                </div>

                {result.date_suggeree && (
                  <div className="mb-5 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">
                      Date suggérée
                    </p>
                    <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">
                      En allouant <strong>{fmt(result.budget_disponible)}/mois</strong>, vous pouvez tout rembourser
                      d'ici <strong>{new Date(result.date_suggeree).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</strong>
                      {' '}({result.mois_suggeres} mois).
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {result.date_suggeree && (
                    <button onClick={() => { setDateCible(result.date_suggeree); calculer(result.date_suggeree) }}
                      disabled={loading}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors">
                      {loading ? 'Calcul…' : 'Voir le plan avec la date suggérée'}
                    </button>
                  )}
                  <button onClick={() => setForceOriginal(true)}
                    className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors">
                    Voir quand même le plan pour ma date d'origine
                  </button>
                  <button onClick={() => { setStep(2); setResult(null); setError(null) }}
                    className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    ← Modifier la date ou le budget
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
