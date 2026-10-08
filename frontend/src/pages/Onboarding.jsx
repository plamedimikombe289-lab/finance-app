import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { categoriesApi, revenusApi } from '../api'

const STEPS = [
  { id: 1, label: 'Bienvenue' },
  { id: 2, label: 'Vos enveloppes' },
  { id: 3, label: 'Premier revenu' },
]

const TYPES = ['salaire', 'freelance', 'prime', 'autre']

export default function Onboarding() {
  const { user, completeOnboarding } = useAuth()
  const [step, setStep] = useState(1)
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ montant: '', commentaire: '', type: 'salaire' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    categoriesApi.lister()
      .then(d => setCategories(d.categories || []))
      .catch(() => {})
  }, [])

  const handleFinish = async (skipRevenu = false) => {
    if (!skipRevenu) {
      if (!form.commentaire.trim()) return setError('Le commentaire est obligatoire.')
      if (!form.montant || parseFloat(form.montant) <= 0) return setError('Montant invalide.')
      setSubmitting(true)
      setError(null)
      try {
        await revenusApi.creer({
          montant: parseFloat(form.montant),
          commentaire: form.commentaire.trim(),
          type: form.type,
        })
      } catch (e) {
        setError(e.message || "Erreur lors de l'ajout du revenu.")
        setSubmitting(false)
        return
      }
    }
    try {
      await completeOnboarding()
      setDone(true)
    } catch {
      setDone(true)
    }
  }

  if (done) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 pt-8 pb-6 text-white">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                  step > s.id ? 'bg-white/40 text-white' :
                  step === s.id ? 'bg-white text-indigo-700' :
                  'bg-white/20 text-white/60'
                }`}>
                  {step > s.id ? '✓' : s.id}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-12 sm:w-20 mx-2 transition-colors ${step > s.id ? 'bg-white/60' : 'bg-white/20'}`} />
                )}
              </div>
            ))}
          </div>
          <h2 className="text-xl font-bold">{STEPS[step - 1].label}</h2>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="text-5xl mb-3">💼</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Bienvenue{user?.prenom ? `, ${user.prenom}` : ''} !
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Cette application vous aide à gérer votre argent avec la méthode des <strong className="text-indigo-600 dark:text-indigo-400">enveloppes budgétaires</strong>.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                  <span className="text-2xl flex-shrink-0">💰</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Ajoutez vos revenus</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Chaque revenu est automatiquement distribué entre vos catégories selon vos règles.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                  <span className="text-2xl flex-shrink-0">📂</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Des enveloppes pour chaque poste</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Logement, alimentation, épargne… chaque catégorie a son propre solde disponible.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <span className="text-2xl flex-shrink-0">📊</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Suivez vos dépenses</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Chaque dépense réduit le solde de la catégorie concernée. Fini les surprises en fin de mois.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Voici vos catégories par défaut. Vous pourrez les personnaliser librement dans l'onglet <strong>Catégories</strong>.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <span className="text-xl flex-shrink-0">{c.icone}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate" style={{ color: c.couleur }}>{c.nom}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {c.type_repartition === 'fixe'
                          ? `Fixe : ${c.montant_fixe ?? 0}`
                          : `${c.pourcentage ?? 0}% du reste`}
                      </p>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="col-span-2 text-center text-sm text-gray-400 py-4">Chargement des catégories...</p>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                💡 Astuce : Les catégories « fixe » sont servies en premier. Le reste est réparti proportionnellement entre les catégories « % ».
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ajoutez votre premier revenu pour que l'application distribue automatiquement les fonds entre vos catégories.
              </p>
              {error && (
                <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-xs">
                  {error}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Montant *</label>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={form.montant}
                    onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="1500.00"
                  />
                </div>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Description *</label>
                  <input
                    type="text"
                    value={form.commentaire}
                    onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Salaire de mai..."
                  />
                </div>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex items-center justify-between gap-3">
          {step === 3 && (
            <button
              onClick={() => handleFinish(true)}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2 transition-colors"
            >
              Passer cette étape
            </button>
          )}
          {step < 3 && <div />}

          <div className="flex items-center gap-3 ml-auto">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Retour
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="btn-primary"
              >
                Suivant →
              </button>
            ) : (
              <button
                onClick={() => handleFinish(false)}
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? 'Enregistrement...' : '🚀 Commencer !'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
