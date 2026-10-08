import { useState, useEffect } from 'react'
import { rapportsApi, actifsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { CATEGORIES_FISCALES, ACTIFS_TYPES, catFiscaleLabel, actifTypeIcon } from '../utils/fiscal'
import { useToast } from '../components/Toast'
import { useConfirm } from '../hooks/useConfirm'
import { SkeletonListPage } from '../components/SkeletonLoader'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3]


function fichierUrl(id) {
  const token = localStorage.getItem('finance_token')
  const base  = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
  return `${base}/depenses/${id}/fichier?token=${encodeURIComponent(token)}`
}

const TYPE_LABELS = { salaire: 'Salaire', freelance: 'Freelance / Contrat', prime: 'Prime / Bonus', autre: 'Autre revenu' }

function SummaryCard({ label, value, sub, color }) {
  return (
    <div className={`rounded-xl p-5 border ${color}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  )
}

const ACTIF_FORM_INIT = { nom: '', type: 'compte_bancaire', valeur: '', date_maj: new Date().toISOString().slice(0, 10) }

export default function RapportFiscal() {
  const { fmt } = useAuth()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [annee, setAnnee]     = useState(CURRENT_YEAR)
  const [data, setData]       = useState(null)
  const [bilan, setBilan]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const [actifForm, setActifForm]     = useState(ACTIF_FORM_INIT)
  const [actifError, setActifError]   = useState(null)
  const [actifSaving, setActifSaving] = useState(false)
  const [editActif, setEditActif]     = useState(null)

  const charger = () => {
    setLoading(true)
    setError(null)
    Promise.all([rapportsApi.fiscal(annee), rapportsApi.valeurNette()])
      .then(([fiscal, vn]) => { setData(fiscal); setBilan(vn) })
      .catch(e => setError(e.message || 'Erreur de chargement.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { charger() }, [annee])

  const handleSaveActif = async (e) => {
    e.preventDefault()
    setActifError(null)
    setActifSaving(true)
    try {
      if (editActif) {
        await actifsApi.modifier(editActif.id, { nom: actifForm.nom, type: actifForm.type, valeur: parseFloat(actifForm.valeur), date_maj: actifForm.date_maj })
        setEditActif(null)
      } else {
        await actifsApi.creer({ nom: actifForm.nom, type: actifForm.type, valeur: parseFloat(actifForm.valeur), date_maj: actifForm.date_maj })
      }
      setActifForm(ACTIF_FORM_INIT)
      const vn = await rapportsApi.valeurNette()
      setBilan(vn)
    } catch (err) {
      setActifError(err.message || 'Erreur')
    } finally {
      setActifSaving(false)
    }
  }

  const handleDeleteActif = async (id) => {
    if (!await confirm('Supprimer cet actif ?', { danger: true, confirmLabel: 'Supprimer' })) return
    try {
      await actifsApi.supprimer(id)
      const vn = await rapportsApi.valeurNette()
      setBilan(vn)
    } catch (err) { toast.error(err.message) }
  }

  const startEditActif = (actif) => {
    setEditActif(actif)
    setActifForm({ nom: actif.nom, type: actif.type, valeur: String(actif.valeur), date_maj: actif.date_maj?.slice(0, 10) || new Date().toISOString().slice(0, 10) })
  }

  if (loading) return <SkeletonListPage rows={6} />
  if (error)   return <div className="flex items-center justify-center h-64 text-red-500">Erreur : {error}</div>

  const { resume, revenus, revenus_par_type, depenses, depenses_deductibles, deductible_par_categorie } = data
  const depensesAvecRecu = depenses.filter(d => d.fichier_stocke)

  return (
    <div className="space-y-8 print:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rapport fiscal</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Synthèse pour la déclaration d'impôt</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => {
              const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
              const TYPE_L = { salaire: 'Salaire', freelance: 'Freelance/Contrat', prime: 'Prime/Bonus', autre: 'Autre revenu' }
              const rows = [
                [`RAPPORT FISCAL ${annee}`, `Généré le ${new Date().toLocaleDateString('fr-FR')}`],
                [],
                ['=== RÉSUMÉ ==='],
                ['Total revenus', resume.total_revenus],
                ['Total déductible', resume.total_deductible],
                ['Revenu imposable estimé', resume.revenu_imposable_estime],
                ['Reçus attachés', depensesAvecRecu.length],
                [],
                ['=== REVENUS ==='],
                ['Date', 'Type', 'Source', 'Description', 'Montant'],
                ...revenus.map(r => [
                  new Date(r.date).toLocaleDateString('fr-FR'),
                  TYPE_L[r.type] || r.type,
                  r.source || '',
                  r.commentaire,
                  r.montant,
                ]),
                [],
                ['=== DÉPENSES DÉDUCTIBLES ==='],
                ['Date', 'Description', 'Catégorie fiscale', 'Montant brut', '% Déductible', 'Montant déductible', 'Reçu'],
                ...depenses_deductibles.map(d => [
                  new Date(d.date).toLocaleDateString('fr-FR'),
                  d.commentaire,
                  d.categorie_fiscale || '',
                  d.montant,
                  d.deductible_pct,
                  (parseFloat(d.montant) * parseFloat(d.deductible_pct) / 100).toFixed(2),
                  d.fichier_stocke ? 'Oui' : 'Non',
                ]),
              ]
              const csv = rows.map(r => r.map(esc).join(',')).join('\r\n')
              const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `rapport_fiscal_${annee}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exporter CSV
          </button>
          <button
            onClick={() => window.print()}
            className="btn-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimer / PDF
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold">Rapport fiscal — Année {annee}</h1>
        <p className="text-sm text-gray-500">Généré le {new Date().toLocaleDateString('fr-FR')}</p>
      </div>

      {/* Résumé fiscal */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Revenus totaux"      value={fmt(resume.total_revenus)}           sub={`${resume.nb_revenus} entrée(s)`}           color="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200" />
        <SummaryCard label="Dépenses déductibles" value={fmt(resume.total_deductible)}         sub={`${resume.nb_deductibles} dépense(s)`}       color="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200" />
        <SummaryCard label="Revenu imposable est." value={fmt(resume.revenu_imposable_estime)} sub="Revenus − déductibles"                        color="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200" />
        <SummaryCard label="Reçus attachés"       value={depensesAvecRecu.length}              sub={`sur ${resume.nb_depenses} dépenses`}         color="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200" />
      </div>

      {/* Revenus par type/source */}
      <div className="card-primary overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Revenus {annee}</h2>
          <span className="text-sm text-green-600 dark:text-green-400 font-semibold">{fmt(resume.total_revenus)}</span>
        </div>

        {/* Par type */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-4">
          {Object.entries(revenus_par_type).map(([type, val]) => (
            <div key={type} className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">{TYPE_LABELS[type] || type} : </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{fmt(val.total)}</span>
              <span className="text-xs text-gray-400 ml-1">({val.nb})</span>
            </div>
          ))}
          {Object.keys(revenus_par_type).length === 0 && (
            <p className="text-sm text-gray-400">Aucun revenu enregistré pour {annee}.</p>
          )}
        </div>

        {/* Liste */}
        {revenus.length > 0 && (
          <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-64 overflow-y-auto print:max-h-none">
            {revenus.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-6 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.commentaire}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(r.date).toLocaleDateString('fr-FR')} · {TYPE_LABELS[r.type] || r.type}
                    {r.source && <span className="ml-2 font-medium text-indigo-600 dark:text-indigo-400">· {r.source}</span>}
                  </p>
                </div>
                <span className="text-green-600 dark:text-green-400 font-semibold text-sm whitespace-nowrap">+{fmt(r.montant)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dépenses déductibles */}
      <div className="card-primary overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Dépenses déductibles {annee}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Montants calculés selon le % de déductibilité de chaque dépense</p>
          </div>
          <span className="text-sm text-blue-600 dark:text-blue-400 font-semibold">{fmt(resume.total_deductible)}</span>
        </div>

        {/* Par catégorie fiscale */}
        {Object.keys(deductible_par_categorie).length > 0 && (
          <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 space-y-2 bg-gray-50 dark:bg-gray-700/30">
            {Object.entries(deductible_par_categorie).map(([cat, val]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">{catFiscaleLabel(cat)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{val.nb} dépense(s) · Brut {fmt(val.montant_brut)}</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">{fmt(val.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {depenses_deductibles.length === 0 ? (
          <p className="px-6 py-5 text-sm text-gray-400 text-center">
            Aucune dépense marquée comme déductible pour {annee}. <br />
            Cochez "Dépense déductible" lors de l'ajout d'une dépense.
          </p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-72 overflow-y-auto print:max-h-none">
            {depenses_deductibles.map(d => {
              const montantDed = parseFloat(d.montant) * parseFloat(d.deductible_pct ?? 100) / 100
              return (
                <div key={d.id} className="flex items-center gap-3 px-6 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.commentaire}</p>
                      {d.categorie_fiscale && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full flex-shrink-0">
                          {catFiscaleLabel(d.categorie_fiscale)}
                        </span>
                      )}
                      {d.fichier_stocke && (
                        <a href={fichierUrl(d.id)} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full hover:underline flex-shrink-0">
                          📎 Reçu
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(d.date).toLocaleDateString('fr-FR')}
                      {d.categorie_nom && <span> · {d.categorie_icone} {d.categorie_nom}</span>}
                      {parseFloat(d.deductible_pct) < 100 && <span className="ml-2">({d.deductible_pct}% déductible)</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{fmt(montantDed)}</p>
                    {parseFloat(d.deductible_pct) < 100 && (
                      <p className="text-xs text-gray-400">brut {fmt(d.montant)}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Toutes les dépenses avec reçu */}
      {depensesAvecRecu.length > 0 && (
        <div className="card-primary overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Pièces jointes disponibles</h2>
            <p className="text-xs text-gray-400 mt-0.5">{depensesAvecRecu.length} dépense(s) avec reçu ou facture joint(e)</p>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-64 overflow-y-auto print:max-h-none">
            {depensesAvecRecu.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-6 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{d.commentaire}</p>
                  <p className="text-xs text-gray-400">{new Date(d.date).toLocaleDateString('fr-FR')} · {d.fichier_nom}</p>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmt(d.montant)}</span>
                <a href={fichierUrl(d.id)} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition-colors flex-shrink-0">
                  Ouvrir
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bilan patrimonial / Valeur nette */}
      {bilan && (
        <div className="card-primary overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Bilan patrimonial</h2>
            <p className="text-xs text-gray-400 mt-0.5">Actifs − Dettes = Valeur nette</p>
          </div>
          <div className="px-6 py-4 grid grid-cols-3 gap-4 text-center border-b border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-xs text-gray-500 mb-1">Total actifs</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{fmt(bilan.total_actifs)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total dettes</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{fmt(bilan.total_dettes)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Valeur nette</p>
              <p className={`text-xl font-bold ${bilan.valeur_nette >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>
                {fmt(bilan.valeur_nette)}
              </p>
            </div>
          </div>

          {/* Liste actifs + form ajout */}
          <div className="px-6 py-4 space-y-4 print:hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mes actifs</h3>
            </div>

            {(bilan.actifs || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">Aucun actif enregistré. Ajoutez vos comptes d'épargne, investissements, etc.</p>
            ) : (
              <div className="space-y-2">
                {bilan.actifs.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                    <span className="text-xl">{actifTypeIcon(a.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{a.nom}</p>
                      <p className="text-xs text-gray-400">{ACTIFS_TYPES.find(t => t.value === a.type)?.label || a.type} · mis à jour le {new Date(a.date_maj).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <span className="font-semibold text-green-600 dark:text-green-400 text-sm">{fmt(a.valeur)}</span>
                    <button onClick={() => startEditActif(a)} className="text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-1.5">✏️</button>
                    <button onClick={() => handleDeleteActif(a.id)} className="text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-1.5">🗑</button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveActif} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div>
                <input type="text" required value={actifForm.nom}
                  onChange={e => setActifForm(f => ({ ...f, nom: e.target.value }))}
                  className="input-field" placeholder="Ex : Compte Desjardins" />
              </div>
              <div>
                <select value={actifForm.type} onChange={e => setActifForm(f => ({ ...f, type: e.target.value }))} className="input-field">
                  {ACTIFS_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <input type="number" step="0.01" min="0" required value={actifForm.valeur}
                  onChange={e => setActifForm(f => ({ ...f, valeur: e.target.value }))}
                  className="input-field" placeholder="Valeur actuelle" />
              </div>
              <div className="flex gap-2">
                <input type="date" required value={actifForm.date_maj}
                  onChange={e => setActifForm(f => ({ ...f, date_maj: e.target.value }))}
                  className="input-field" />
                <button type="submit" disabled={actifSaving}
                  className="btn-primary">
                  {editActif ? '✓' : '+'}
                </button>
                {editActif && (
                  <button type="button" onClick={() => { setEditActif(null); setActifForm(ACTIF_FORM_INIT) }}
                    className="px-3 py-2 text-gray-400 hover:text-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                    ✕
                  </button>
                )}
              </div>
              {actifError && <p className="sm:col-span-4 text-xs text-red-600 dark:text-red-400">{actifError}</p>}
            </form>
          </div>
        </div>
      )}

      {/* Note de bas de page */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-6 py-4 print:block">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          <strong>Note :</strong> Ce rapport est une synthèse indicative générée automatiquement depuis vos données.
          Le revenu imposable estimé ne tient compte que des dépenses marquées comme déductibles dans l'application.
          Consultez un professionnel en fiscalité pour valider les montants déclarés.
          Les pièces jointes (reçus, factures) sont disponibles dans la section "Pièces jointes disponibles" ci-dessus.
        </p>
      </div>
      {ConfirmDialog}
    </div>
  )
}



