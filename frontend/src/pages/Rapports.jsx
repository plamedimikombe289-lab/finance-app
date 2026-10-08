import { useState, useEffect } from 'react'
import { rapportsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { C } from '../utils/colors'
import { SkeletonDashboard } from '../components/SkeletonLoader'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function formatMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return `${MONTHS_FR[parseInt(mo) - 1]} ${y.slice(2)}`
}

function getTooltipStyle() {
  const dark = document.documentElement.classList.contains('dark')
  return {
    contentStyle: {
      backgroundColor: dark ? '#1f2937' : '#ffffff',
      border:          dark ? '1px solid #374151' : '1px solid #e5e7eb',
      borderRadius: '10px',
      color:           dark ? '#f9fafb' : '#111827',
      fontSize: '12px',
      boxShadow: dark
        ? '0 8px 24px rgba(0,0,0,0.4)'
        : '0 4px 16px rgba(0,0,0,0.10)',
    },
    itemStyle:  { color: dark ? '#d1d5db' : '#374151' },
    labelStyle: { color: dark ? '#9ca3af' : '#6b7280', fontWeight: 600 },
  }
}

function BudgetBar({ label, icone, couleur, recu, depense, fmt }) {
  const pct = recu > 0 ? Math.min(100, Math.round((depense / recu) * 100)) : 0
  const over = depense > recu
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-base flex-shrink-0">{icone}</span>
          <span className="truncate font-medium text-gray-700 dark:text-gray-300" style={{ color: couleur }}>{label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs whitespace-nowrap flex-shrink-0">
          <span className="text-gray-500 dark:text-gray-400">Reçu : <span className="font-medium text-green-600 dark:text-green-400">{fmt(recu)}</span></span>
          <span className={over ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}>
            Dépensé : <span className="font-medium">{fmt(depense)}</span>
            {over && ' ⚠️'}
          </span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className={`text-xs ${over ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
        {over
          ? `Dépassement de ${fmt(depense - recu)}`
          : `${fmt(recu - depense)} restant (${pct}% utilisé)`
        }
      </p>
    </div>
  )
}

export default function Rapports() {
  const { fmt } = useAuth()
  const [evolution, setEvolution] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [budget, setBudget] = useState(null)
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mois, setMois] = useState(6)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      rapportsApi.evolution({ mois }),
      rapportsApi.dashboard(),
      rapportsApi.budgetMensuel(),
      rapportsApi.scoresHistoriques().catch(() => ({ scores: [] })),
    ])
      .then(([evo, dash, bud, sc]) => {
        setEvolution(evo); setDashboard(dash); setBudget(bud)
        setScores(sc.scores || [])
      })
      .catch(e => setError(e.message || 'Erreur de chargement.'))
      .finally(() => setLoading(false))
  }, [mois])

  if (loading) return <SkeletonDashboard />
  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-500">
      Erreur : {error}
    </div>
  )

  const allMonths = [...new Set([
    ...evolution.revenus.map(r => r.mois),
    ...evolution.depenses.map(d => d.mois),
    ...evolution.paiements_dettes.map(p => p.mois),
  ])].sort()

  const chartData = allMonths.map(m => ({
    mois: formatMonth(m),
    revenus: parseFloat(evolution.revenus.find(r => r.mois === m)?.total || 0),
    depenses: parseFloat(evolution.depenses.find(d => d.mois === m)?.total || 0),
    paiements: parseFloat(evolution.paiements_dettes.find(p => p.mois === m)?.total || 0),
  }))

  const catData = dashboard.categories
    .filter(c => parseFloat(c.solde) > 0)
    .map(c => ({ name: c.nom, value: parseFloat(c.solde), color: c.couleur, icone: c.icone }))

  const { resume } = dashboard

  const budgetItems = (budget?.budget || []).filter(b => parseFloat(b.recu_mois) > 0 || parseFloat(b.depense_mois) > 0)

  const currentMonthFR = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rapports</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={mois}
            onChange={e => setMois(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={3}>3 mois</option>
            <option value={6}>6 mois</option>
            <option value={12}>12 mois</option>
          </select>
          <button
            onClick={() => window.print()}
            className="btn-primary no-print"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-primary p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Solde total</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{fmt(resume.total_soldes)}</p>
        </div>
        <div className="card-primary p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dettes restantes</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{fmt(resume.total_dettes)}</p>
        </div>
        <div className="card-primary p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Revenus (mois)</p>
          <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{fmt(resume.revenus_mois)}</p>
        </div>
        <div className="card-primary p-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dépenses (mois)</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{fmt(resume.depenses_mois)}</p>
        </div>
      </div>

      {/* Budget planifié vs réel */}
      <div className="card-primary p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Budget du mois en cours</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">{currentMonthFR} — reçu via répartition vs dépensé par catégorie</p>
        </div>
        {budgetItems.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Aucune donnée pour ce mois.</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Ajoutez un revenu et enregistrez des dépenses pour voir votre budget.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {budgetItems.map(b => (
              <BudgetBar
                key={b.id}
                label={b.nom}
                icone={b.icone}
                couleur={b.couleur}
                recu={parseFloat(b.recu_mois || 0)}
                depense={parseFloat(b.depense_mois || 0)}
                fmt={fmt}
              />
            ))}
          </div>
        )}
      </div>

      <div className="card-primary p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Revenus vs Dépenses — {mois} derniers mois
        </h2>
        {chartData.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">Aucune donnée disponible.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.neutral} opacity={0.3} />
              <XAxis dataKey="mois" tick={{ fontSize: 12, fill: C.neutral }} />
              <YAxis tick={{ fontSize: 12, fill: C.neutral }} tickFormatter={v => fmt(v)} />
              <Tooltip {...getTooltipStyle()} formatter={v => [fmt(v)]} />
              <Legend />
              <Bar dataKey="revenus" name="Revenus" fill={C.brand} radius={[4, 4, 0, 0]} />
              <Bar dataKey="depenses" name="Dépenses" fill={C.orange} radius={[4, 4, 0, 0]} />
              <Bar dataKey="paiements" name="Paiements dettes" fill={C.danger} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card-primary p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Tendance — Revenus vs Dépenses</h2>
        {chartData.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">Aucune donnée disponible.</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.neutral} opacity={0.3} />
              <XAxis dataKey="mois" tick={{ fontSize: 12, fill: C.neutral }} />
              <YAxis tick={{ fontSize: 12, fill: C.neutral }} tickFormatter={v => fmt(v)} />
              <Tooltip {...getTooltipStyle()} formatter={v => [fmt(v)]} />
              <Legend />
              <Line type="monotone" dataKey="revenus" name="Revenus" stroke={C.brand} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="depenses" name="Dépenses" stroke={C.orange} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {scores.length > 1 && (
        <div className="card-primary p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Évolution du score de santé financière</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={scores.map(s => ({ mois: formatMonth(s.mois), score: s.score }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.neutral} opacity={0.3} />
              <XAxis dataKey="mois" tick={{ fontSize: 12, fill: C.neutral }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: C.neutral }} tickFormatter={v => `${v}`} />
              <Tooltip {...getTooltipStyle()} formatter={v => [`${v} / 100`, 'Score']} />
              <Line type="monotone" dataKey="score" name="Score" stroke={C.brand} strokeWidth={2.5} dot={{ r: 4, fill: C.brand }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥ 80 Excellent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> ≥ 60 Correct</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> ≥ 40 À surveiller</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt; 40 Préoccupant</span>
          </div>
        </div>
      )}

      {/* ── Projections financières ── */}
      {(() => {
        const moisDispo = chartData.length
        if (moisDispo < 2) return null

        const revMoy  = chartData.reduce((s, m) => s + m.revenus,  0) / moisDispo
        const depMoy  = chartData.reduce((s, m) => s + m.depenses, 0) / moisDispo
        const paiMoy  = chartData.reduce((s, m) => s + m.paiements, 0) / moisDispo
        const nette   = revMoy - depMoy - paiMoy
        const taux    = revMoy > 0 ? Math.round((nette / revMoy) * 100) : 0

        const dettesActives = (dashboard.dettes || []).filter(d => d.actif && parseFloat(d.montant_restant) > 0)
        const catObjectifs  = (dashboard.categories || []).filter(c => c.objectif > 0 && parseFloat(c.solde) < parseFloat(c.objectif))

        return (
          <div className="card-primary p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Projections financières</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Basé sur la moyenne des {moisDispo} derniers mois</p>
            </div>

            {/* Résumé épargne */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 text-center">
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Revenu moyen/mois</p>
                <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{fmt(revMoy)}</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 text-center">
                <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">Dépenses moy/mois</p>
                <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{fmt(depMoy + paiMoy)}</p>
              </div>
              <div className={`p-4 rounded-xl border text-center ${nette >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'}`}>
                <p className={`text-xs mb-1 ${nette >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Épargne nette/mois</p>
                <p className={`text-xl font-bold ${nette >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{fmt(nette)}</p>
                <p className={`text-xs mt-0.5 ${nette >= 0 ? 'text-green-500' : 'text-red-500'}`}>Taux : {taux}%</p>
              </div>
            </div>

            {/* Projections remboursement dettes */}
            {dettesActives.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Temps estimé pour solder les dettes</h3>
                <div className="space-y-3">
                  {dettesActives.map(d => {
                    const restant = parseFloat(d.montant_restant)
                    const minMens = parseFloat(d.paiement_minimum) || 0
                    const pct     = parseFloat(d.progression_pct) || 0
                    let estimation = null
                    if (paiMoy > 0 && restant > 0) {
                      const moisEstimes = Math.ceil(restant / (minMens > 0 ? minMens : paiMoy / Math.max(1, dettesActives.length)))
                      const dateEstimee = new Date()
                      dateEstimee.setMonth(dateEstimee.getMonth() + moisEstimes)
                      estimation = { mois: moisEstimes, date: dateEstimee.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
                    }
                    return (
                      <div key={d.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.nom}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{fmt(restant)} restants · {pct}% remboursé</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {estimation ? (
                            <>
                              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{estimation.mois} mois</p>
                              <p className="text-xs text-gray-400">{estimation.date}</p>
                            </>
                          ) : (
                            <p className="text-xs text-gray-400">Données insuffisantes</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Projections objectifs épargne */}
            {catObjectifs.length > 0 && nette > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Temps estimé pour atteindre vos objectifs</h3>
                <div className="space-y-3">
                  {catObjectifs.map(c => {
                    const manquant   = parseFloat(c.objectif) - parseFloat(c.solde)
                    const moisEstimes = Math.ceil(manquant / nette)
                    const dateEstimee = new Date()
                    dateEstimee.setMonth(dateEstimee.getMonth() + moisEstimes)
                    const objPct = Math.round(parseFloat(c.solde) / parseFloat(c.objectif) * 100)
                    return (
                      <div key={c.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span>{c.icone}</span>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.nom}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold" style={{ color: c.couleur }}>{moisEstimes} mois</p>
                            <p className="text-xs text-gray-400">{dateEstimee.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${objPct}%`, backgroundColor: c.couleur }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{fmt(parseFloat(c.solde))} / {fmt(parseFloat(c.objectif))} ({objPct}%)</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {nette <= 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                ⚠️ Votre épargne nette est négative ou nulle — les projections ne peuvent pas être calculées. Réduisez vos dépenses ou augmentez vos revenus.
              </div>
            )}
          </div>
        )
      })()}

      {catData.length > 0 && (
        <div className="card-primary p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Répartition des soldes disponibles</h2>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div style={{ width: 220, height: 220, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                    dataKey="value" paddingAngle={3}>
                    {catData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...getTooltipStyle()} formatter={v => [fmt(v)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {catData.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-base">{c.icone}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{c.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    {fmt(c.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

