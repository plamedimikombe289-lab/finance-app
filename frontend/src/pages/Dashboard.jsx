import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { rapportsApi, dettesApi, iaApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { SkeletonDashboard } from '../components/SkeletonLoader'
import { Shield, Lightbulb, Bell, AlertTriangle, TrendingUp, CreditCard, Download, BarChart2 } from '../components/Icons'
import { C, scoreColor, urgenceColor } from '../utils/colors'
import MotivationsWidget from '../components/MotivationsWidget'
import CategoryIcon from '../components/CategoryIcon'

const MESSAGES_MOTIVATION = [
  "Chaque petit dépôt compte. L'épargne, c'est l'habitude avant d'être le montant.",
  "Un budget n'est pas une prison — c'est un plan pour vivre librement.",
  "Payer ses dettes, c'est s'acheter de la liberté pour demain.",
  "La richesse, c'est dépenser moins que ce qu'on gagne — jour après jour.",
  "Chaque dollar épargné aujourd'hui est un futur problème de moins.",
  "Le meilleur moment pour commencer à épargner était hier. Le deuxième meilleur, c'est maintenant.",
  "Investir en soi est toujours rentable — compétences, santé, connaissances.",
  "Une petite réduction des dépenses superflues, multipliée par 365, ça change une vie.",
  "Vos finances suivent vos habitudes, pas vos intentions.",
  "Éviter une dépense inutile, c'est déjà gagner de l'argent.",
  "Un fonds d'urgence, c'est la paix d'esprit. Construisez-le brique par brique.",
  "Comparez les prix, négociez les contrats, révisez vos abonnements — c'est gratuit.",
  "La discipline financière, c'est se respecter assez pour ne pas dépenser l'argent de demain.",
  "Chaque dette remboursée libère un flux de revenus pour votre avenir.",
  "Automatisez votre épargne : si vous ne la voyez pas, vous ne la dépensez pas.",
  "Fixer un objectif financier concret triple les chances de l'atteindre.",
  "Un plan financier, même imparfait, vaut mieux qu'aucun plan.",
  "Avant d'acheter, posez-vous : est-ce un besoin ou une émotion ?",
  "La patience est le super-pouvoir de l'investisseur et de l'épargnant.",
  "Vos décisions financières d'aujourd'hui construisent votre liberté de demain.",
  "Réduire une dette à la fois — la méthode boule de neige fonctionne vraiment.",
  "Distinguer actif (ce qui vous rapporte) et passif (ce qui vous coûte) change tout.",
  "Revoir son budget une fois par mois, c'est 12 chances de faire mieux chaque année.",
  "L'urgence financière est rare quand on a un coussin d'épargne.",
  "Célébrez chaque petit progrès financier — la motivation est aussi un carburant.",
  "Le coût d'opportunité : chaque achat impulsif est une épargne sacrifiée.",
  "Diversifier ses revenus rend le futur plus serein — une nouvelle idée vaut la peine.",
  "Les intérêts composés sont la huitième merveille du monde pour qui sait s'en servir.",
  "Ne comparez pas votre situation financière à celle des autres — chaque chemin est unique.",
  "Chaque non dit à une dépense inutile est un oui dit à vos objectifs.",
]

function MotivationBubble() {
  const today     = new Date().toISOString().slice(0, 10)
  const dismissed = localStorage.getItem('motivation_dismissed') === today
  const [visible,  setVisible]  = useState(!dismissed)
  const [texteIA,  setTexteIA]  = useState(null)

  const idx   = (new Date().getFullYear() * 366 + new Date().getMonth() * 31 + new Date().getDate()) % MESSAGES_MOTIVATION.length
  const texteStatique = MESSAGES_MOTIVATION[idx]

  useEffect(() => {
    if (!visible) return
    iaApi.messageJour()
      .then(data => { if (data?.message) setTexteIA(data.message) })
      .catch(() => {})
  }, [])

  const dismiss = () => {
    localStorage.setItem('motivation_dismissed', today)
    setVisible(false)
  }

  if (!visible) return null

  const texte = texteIA || texteStatique
  const estIA = !!texteIA

  return (
    <div
      className="cloud-float flex-shrink-0 select-none"
      style={{ filter: 'drop-shadow(0 8px 22px rgba(99,102,241,0.30))', width: 300 }}
    >
      <div className="relative" style={{ paddingTop: 58 }}>
        {/* Bosses — z-index 0, corps z-index 2 pour garantir le texte au-dessus */}
        <div className="cloud-bg absolute rounded-full"
          style={{ width: 62, height: 62, top: 10, left: 14, zIndex: 0 }} />
        <div className="cloud-bg absolute rounded-full"
          style={{ width: 82, height: 82, top: 0,  left: 54, zIndex: 0 }} />
        <div className="cloud-bg absolute rounded-full"
          style={{ width: 66, height: 66, top: 8,  left: 126, zIndex: 0 }} />
        <div className="cloud-bg absolute rounded-full"
          style={{ width: 52, height: 52, top: 16, left: 194, zIndex: 0 }} />

        {/* Corps — toujours au-dessus des bosses */}
        <div className="cloud-bg rounded-[28px] px-6 pt-4 pb-4"
          style={{ position: 'relative', zIndex: 2 }}>
          <button
            onClick={dismiss}
            className="absolute top-2 right-3 text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300 text-xl leading-none font-light"
            aria-label="Fermer"
          >×</button>
          <div className="pr-5">
            <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-snug">{texte}</p>
          </div>
          <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-2 text-right font-medium tracking-wide">
            {estIA ? '✨ San Prince IA' : 'Message du jour'}
          </p>
        </div>
      </div>
    </div>
  )
}

function FondsUrgenceGauge({ mois }) {
  const { color, label, bg } =
    mois === null   ? { color: 'text-gray-400', label: 'Données insuffisantes', bg: 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700' } :
    mois < 1        ? { color: 'text-red-600 dark:text-red-400',    label: 'Fonds d\'urgence insuffisant',  bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' } :
    mois < 3        ? { color: 'text-amber-600 dark:text-amber-400', label: 'Fonds d\'urgence à renforcer', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' } :
                      { color: 'text-green-600 dark:text-green-400', label: 'Fonds d\'urgence solide',      bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' }
  const pct = mois === null ? 0 : Math.min(100, (mois / 6) * 100)
  return (
    <div className={`rounded-xl p-4 border ${bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400">
          <Shield size={14} className="text-gray-400" /> Fonds d'urgence
        </span>
        <span className={`text-lg font-bold ${color}`}>{mois === null ? '—' : `${mois.toFixed(1)} mois`}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-1.5">
        <div className="h-3 rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: urgenceColor(mois, 1, 3) }} />
      </div>
      <p className={`text-xs ${color}`}>{label} · objectif 3–6 mois</p>
    </div>
  )
}

function SummaryCard({ title, parts, sub, Icon: CardIcon, colorClass, accent }) {
  return (
    <div className="card-primary p-5 overflow-hidden relative" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-label text-gray-400 dark:text-gray-500">{title}</span>
        <span className={`p-2 rounded-xl ${colorClass}`}>
          <CardIcon size={16} strokeWidth={2} />
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white leading-none">
        <Amount parts={parts} />
      </p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium">{sub}</p>}
    </div>
  )
}

const prioriteLabels = {
  1: { label: 'Haute',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  2: { label: 'Moyenne', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  3: { label: 'Basse',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

function calculerScore(resume, rappels) {
  if (!resume.revenus_mois) return null
  let score = 0
  const { revenus_mois, total_dettes, total_soldes, depenses_mois } = resume
  // Épargne (35 pts) : objectif 20% du revenu mensuel
  const tauxEpargne = total_soldes / revenus_mois
  score += Math.min(35, Math.round(tauxEpargne / 0.2 * 35))
  // Dettes (35 pts) : ratio dettes/revenu, idéal 0
  const ratioDette = Math.min(3, total_dettes / revenus_mois)
  score += Math.round((1 - ratioDette / 3) * 35)
  // Budget (30 pts) : dépenses < revenus
  const ratioDepense = Math.min(1, depenses_mois / revenus_mois)
  score += Math.round((1 - ratioDepense) * 30)
  // Pénalité retards
  score -= (rappels || []).filter(r => r.jours_restants < 0).length * 5
  return Math.max(0, Math.min(100, score))
}

function ScoreCloudBubble({ score }) {
  if (score === null) return null
  const { label, color } =
    score >= 80 ? { label: 'Excellent',    color: 'text-green-600 dark:text-green-400'  } :
    score >= 60 ? { label: 'Correct',      color: 'text-blue-600 dark:text-blue-300'    } :
    score >= 40 ? { label: 'À surveiller', color: 'text-amber-600 dark:text-amber-400'  } :
                  { label: 'Préoccupant',  color: 'text-red-600 dark:text-red-400'      }
  const stroke = scoreColor(score)
  return (
    <div
      className="cloud-float flex-shrink-0 select-none"
      style={{ filter: 'drop-shadow(0 8px 22px rgba(99,102,241,0.28))', width: 280, animationDelay: '-2.2s' }}
    >
      <div className="relative" style={{ paddingTop: 56 }}>
        {/* Bosses */}
        <div className="cloud-bg absolute rounded-full" style={{ width: 58, height: 58, top: 10, left: 12, zIndex: 0 }} />
        <div className="cloud-bg absolute rounded-full" style={{ width: 78, height: 78, top: 0,  left: 50, zIndex: 0 }} />
        <div className="cloud-bg absolute rounded-full" style={{ width: 62, height: 62, top: 8,  left: 118, zIndex: 0 }} />
        <div className="cloud-bg absolute rounded-full" style={{ width: 50, height: 50, top: 16, left: 178, zIndex: 0 }} />
        {/* Corps — toujours au-dessus des bosses */}
        <div className="cloud-bg rounded-[28px] px-5 pt-4 pb-4 flex items-center gap-4"
          style={{ position: 'relative', zIndex: 2 }}>
          {/* Arc SVG */}
          <div className="relative flex-shrink-0" style={{ width: 58, height: 58 }}>
            <svg viewBox="0 0 36 36" width="58" height="58" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={C.track} strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={stroke} strokeWidth="3"
                strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${color}`}>{score}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 leading-tight">Santé financière</p>
            <p className={`text-base font-bold leading-tight mt-1 ${color}`}>{label}</p>
            <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-1">épargne · dettes · budget</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Amount({ parts }) {
  return (
    <span className="tabular">
      {parts.integer}
      <span className="text-lg">,{parts.decimal}</span>
      {' '}
      <span className="text-base font-medium text-gray-400 dark:text-gray-500">{parts.symbol}</span>
    </span>
  )
}

export default function Dashboard() {
  const { fmt, fmtParts } = useAuth()
  const [data, setData] = useState(null)
  const [valeurNette, setValeurNette] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rappels, setRappels] = useState([])

  useEffect(() => {
    Promise.all([
      rapportsApi.dashboard(),
      dettesApi.rappels(),
      rapportsApi.valeurNette().catch(() => null),
    ])
      .then(([dash, rapp, vn]) => {
        setData(dash)
        setRappels(rapp.rappels || [])
        setValeurNette(vn)
        const s = calculerScore(dash.resume, rapp.rappels || [])
        if (s !== null) rapportsApi.sauvegarderScore(s).catch(() => {})
      })
      .catch(e => setError(e.message || 'Erreur de connexion au serveur.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonDashboard />
  if (error)   return <div className="flex items-center justify-center h-64 text-red-500">Erreur : {error}</div>

  const { resume, categories, dettes, derniers_revenus, dernieres_depenses, non_reparti_recent } = data
  const score = calculerScore(resume, rappels)
  const alertes = categories.filter(c => c.seuil_alerte != null && parseFloat(c.solde) <= parseFloat(c.seuil_alerte))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Tableau de bord</h1>

      {/* Bulles flottantes */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ScoreCloudBubble score={score} />
        <MotivationBubble />
      </div>

      {/* Valeur nette + fonds d'urgence */}
      {valeurNette && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card-primary p-4">
            <p className="text-label text-gray-400 dark:text-gray-500 mb-3">Valeur nette</p>
            <div className="space-y-1.5">
              {valeurNette.total_comptes > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Comptes bancaires</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">+{fmt(valeurNette.total_comptes)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Soldes catégories</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">+{fmt(valeurNette.total_soldes)}</span>
                </div>
              )}
              {valeurNette.total_actifs_non_liquides > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Actifs non-liquides</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">+{fmt(valeurNette.total_actifs_non_liquides)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Dettes</span>
                <span className="text-red-600 dark:text-red-400 font-medium">-{fmt(valeurNette.total_dettes)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-gray-100 dark:border-gray-700 pt-1.5 mt-1.5">
                <span className="text-gray-800 dark:text-gray-200">Valeur nette</span>
                <span className={parseFloat(valeurNette.valeur_nette) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {fmt(valeurNette.valeur_nette)}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <Link to="/comptes" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Comptes →</Link>
              <Link to="/rapport-fiscal" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Actifs →</Link>
            </div>
          </div>
          <FondsUrgenceGauge mois={valeurNette.mois_couverts} />
        </div>
      )}

      {/* Alertes solde bas */}
      {alertes.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <p className="flex items-center gap-2 font-semibold text-orange-800 dark:text-orange-300 mb-2">
            <AlertTriangle size={15} /> Soldes bas
          </p>
          <div className="flex flex-wrap gap-2">
            {alertes.map(c => (
              <Link key={c.id} to="/categories"
                className="flex items-center gap-1.5 px-3 py-1.5 card-secondary text-sm">
                <span>{c.icone}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{c.nom}</span>
                <span className="text-orange-600 dark:text-orange-400 font-semibold">{fmt(c.solde)}</span>
                <span className="text-xs text-gray-400">(seuil {fmt(c.seuil_alerte)})</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Montant non réparti */}
      {non_reparti_recent && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
              <Lightbulb size={15} /> Fonds non répartis
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              <strong>{fmt(non_reparti_recent.non_reparti)}</strong> du revenu «{non_reparti_recent.commentaire}» n'ont pas été alloués à une catégorie.
            </p>
          </div>
          <Link to="/categories" className="text-xs text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap">Gérer catégories →</Link>
        </div>
      )}

      {/* Rappels */}
      {rappels.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2">
              <Bell size={15} /> Rappels de paiement
              <span className="text-xs px-2 py-0.5 bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded-full font-bold">{rappels.length}</span>
            </h2>
            <Link to="/dettes" className="text-xs text-orange-700 dark:text-orange-400 hover:underline">Gérer</Link>
          </div>
          <div className="space-y-2">
            {rappels.map(r => {
              const estRetard = r.jours_restants < 0
              const estCreance = r.sens === 'on_me_doit'
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 card-secondary px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{estCreance ? '💰' : '💳'} {r.nom}</p>
                    <p className="text-xs text-gray-500">
                      {estRetard
                        ? <span className="text-red-600 dark:text-red-400 font-medium">En retard de {Math.abs(r.jours_restants)}j</span>
                        : <span className="text-orange-600 dark:text-orange-400">Dans {r.jours_restants}j — {new Date(r.date_echeance).toLocaleDateString('fr-FR')}</span>
                      }
                      {' · '}{estCreance ? 'À recevoir' : 'À payer'} : {fmt(r.montant_restant)}
                    </p>
                  </div>
                  {r.paiement_minimum > 0 && !estCreance && (
                    <span className="text-xs text-orange-700 dark:text-orange-300 font-semibold whitespace-nowrap">Min {fmt(r.paiement_minimum)}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cartes résumé */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Soldes disponibles" parts={fmtParts(resume.total_soldes)}  Icon={TrendingUp}  sub="Toutes catégories"      colorClass="bg-green-50 dark:bg-green-900/20 text-green-600"    accent={C.success} />
        <SummaryCard title="Total dettes"       parts={fmtParts(resume.total_dettes)}  Icon={CreditCard}  sub={`${resume.nb_dettes} active(s)`} colorClass="bg-red-50 dark:bg-red-900/20 text-red-600"        accent={C.danger}  />
        <SummaryCard title="Revenus du mois"    parts={fmtParts(resume.revenus_mois)}  Icon={BarChart2}   sub="Ce mois-ci"                      colorClass="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" accent={C.brand}   />
        <SummaryCard title="Dépenses du mois"   parts={fmtParts(resume.depenses_mois)} Icon={Download}    sub="Ce mois-ci"                      colorClass="bg-amber-50 dark:bg-amber-900/20 text-amber-600"   accent={C.warning} />
      </div>

      {/* Catégories */}
      {categories.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold tracking-tight text-gray-800 dark:text-gray-200">Catégories budgétaires</h2>
            <Link to="/categories" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Gérer</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map(cat => (
              <div key={cat.id} className="card-primary p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: cat.couleur }}>
                    <CategoryIcon icone={cat.icone} size={20} />
                  </span>
                  <span className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{cat.nom}</span>
                </div>
                <p className="text-lg font-bold" style={{ color: cat.couleur }}>{fmt(cat.solde)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {cat.type === 'pourcentage' ? `${cat.valeur}%` : `${cat.valeur} fixe`}
                </p>
                {cat.objectif > 0 && (
                  <div className="mt-1.5">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, parseFloat(cat.solde) / cat.objectif * 100)}%`, backgroundColor: cat.couleur }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivations personnalisées */}
      <MotivationsWidget />

      {/* Derniers revenus + dépenses */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold tracking-tight text-gray-800 dark:text-gray-200">Derniers revenus</h2>
            <Link to="/revenus" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Voir tout</Link>
          </div>
          <div className="space-y-2">
            {derniers_revenus.length === 0
              ? <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">Aucun revenu enregistré.</p>
              : derniers_revenus.map(r => (
                <div key={r.id} className="card-secondary px-4 py-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.commentaire}</p>
                    <p className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString('fr-FR')} · {r.type}</p>
                  </div>
                  <span className="text-green-600 dark:text-green-400 font-semibold text-sm whitespace-nowrap">+{fmt(r.montant)}</span>
                </div>
              ))
            }
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold tracking-tight text-gray-800 dark:text-gray-200">Dernières dépenses</h2>
            <Link to="/depenses" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Voir tout</Link>
          </div>
          <div className="space-y-2">
            {dernieres_depenses.length === 0
              ? <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">Aucune dépense enregistrée.</p>
              : dernieres_depenses.map(d => (
                <div key={d.id} className="card-secondary px-4 py-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.commentaire}</p>
                    <p className="text-xs text-gray-500">
                      {d.categorie ? <span style={{ color: d.couleur }}>{d.categorie}</span> : 'Sans catégorie'}
                      {' · '}{new Date(d.date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className="text-red-600 dark:text-red-400 font-semibold text-sm whitespace-nowrap">-{fmt(d.montant)}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Dettes actives */}
      {dettes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold tracking-tight text-gray-800 dark:text-gray-200">Dettes actives</h2>
            <Link to="/dettes" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Gérer</Link>
          </div>
          <div className="space-y-3">
            {dettes.slice(0, 4).map(d => {
              const p = prioriteLabels[d.priorite] || prioriteLabels[2]
              return (
                <div key={d.id} className="card-primary p-4">
                  <div className="flex justify-between items-start mb-2 gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{d.nom}</p>
                      <p className="text-xs text-gray-500">{fmt(d.montant_restant)} / {fmt(d.montant_total)}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${p.cls}`}>{p.label}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div className="bg-indigo-500 h-3 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, parseFloat(d.progression_pct))}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{d.progression_pct}% remboursé</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
