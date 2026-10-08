import { useState } from 'react'
import { revenusApi, depensesApi, categoriesApi, comptesApi, dettesApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function toCSV(rows) {
  return rows.map(row =>
    row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\r\n')
}

const today = () => new Date().toISOString().slice(0, 10)

export default function Export() {
  const { fmt } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(null)

  const run = async (key, fn) => {
    setLoading(key)
    try { await fn() } catch (e) { toast.error(e.message || 'Erreur.') }
    finally { setLoading(null) }
  }

  const exportJSON = () => run('json', async () => {
    const [rev, dep, cat, cpt, det] = await Promise.all([
      revenusApi.lister({ page: 1, limite: 9999 }),
      depensesApi.lister({ page: 1, limite: 9999 }),
      categoriesApi.lister(),
      comptesApi.lister(),
      dettesApi.lister({ actif: 1 }),
    ])
    const data = {
      exported_at: new Date().toISOString(),
      revenus:     rev.revenus,
      depenses:    dep.depenses,
      categories:  cat.categories,
      comptes:     cpt.comptes,
      dettes:      det.dettes,
    }
    downloadFile(JSON.stringify(data, null, 2), `finance-export-${today()}.json`, 'application/json')
    toast.success('Export JSON téléchargé.')
  })

  const exportRevenusCSV = () => run('revenus', async () => {
    const all = await revenusApi.lister({ page: 1, limite: 9999 })
    const rows = [
      ['Date', 'Commentaire', 'Type', 'Source', 'Montant'],
      ...(all.revenus || []).map(r => [
        new Date(r.date).toLocaleDateString('fr-FR'),
        r.commentaire, r.type, r.source || '',
        parseFloat(r.montant).toFixed(2),
      ])
    ]
    downloadFile('﻿' + toCSV(rows), `revenus-${today()}.csv`, 'text/csv;charset=utf-8')
    toast.success('Export Revenus téléchargé.')
  })

  const exportDepensesCSV = () => run('depenses', async () => {
    const all = await depensesApi.lister({ page: 1, limite: 9999 })
    const rows = [
      ['Date', 'Commentaire', 'Catégorie', 'Montant', 'Déductible', '% Déductible', 'Catégorie fiscale'],
      ...(all.depenses || []).map(d => [
        new Date(d.date).toLocaleDateString('fr-FR'),
        d.commentaire, d.categorie_nom || '',
        parseFloat(d.montant).toFixed(2),
        d.is_deductible ? 'Oui' : 'Non',
        d.deductible_pct || '',
        d.categorie_fiscale || '',
      ])
    ]
    downloadFile('﻿' + toCSV(rows), `depenses-${today()}.csv`, 'text/csv;charset=utf-8')
    toast.success('Export Dépenses téléchargé.')
  })

  const exportDettesCSV = () => run('dettes', async () => {
    const all = await dettesApi.lister({ actif: 1 })
    const rows = [
      ['Nom', 'Type', 'Sens', 'Montant total', 'Montant restant', 'Paiement min', 'Priorité', 'Taux intérêt', 'Échéance'],
      ...(all.dettes || []).map(d => [
        d.nom, d.type, d.sens,
        parseFloat(d.montant_total).toFixed(2),
        parseFloat(d.montant_restant).toFixed(2),
        d.paiement_minimum || 0,
        d.priorite,
        d.taux_interet || '',
        d.date_echeance ? new Date(d.date_echeance).toLocaleDateString('fr-FR') : '',
      ])
    ]
    downloadFile('﻿' + toCSV(rows), `dettes-${today()}.csv`, 'text/csv;charset=utf-8')
    toast.success('Export Dettes téléchargé.')
  })

  const exportComptesCSV = () => run('comptes', async () => {
    const all = await comptesApi.lister()
    const rows = [
      ['Nom', 'Type', 'Solde', 'Limite', 'Couleur', 'Créé le'],
      ...(all.comptes || []).map(c => [
        c.nom, c.type,
        parseFloat(c.solde).toFixed(2),
        c.limite ? parseFloat(c.limite).toFixed(2) : '',
        c.couleur,
        new Date(c.created_at).toLocaleDateString('fr-FR'),
      ])
    ]
    downloadFile('﻿' + toCSV(rows), `comptes-${today()}.csv`, 'text/csv;charset=utf-8')
    toast.success('Export Comptes téléchargé.')
  })

  const cards = [
    {
      key: 'revenus', icon: '💰', title: 'Revenus', format: 'CSV',
      desc: 'Historique complet : date, commentaire, type, source, montant',
      color: 'green', fn: exportRevenusCSV,
    },
    {
      key: 'depenses', icon: '🛒', title: 'Dépenses', format: 'CSV',
      desc: 'Historique complet avec catégories et informations fiscales',
      color: 'orange', fn: exportDepensesCSV,
    },
    {
      key: 'dettes', icon: '💳', title: 'Dettes', format: 'CSV',
      desc: 'Liste des dettes actives : montants, priorités, échéances',
      color: 'red', fn: exportDettesCSV,
    },
    {
      key: 'comptes', icon: '🏦', title: 'Comptes bancaires', format: 'CSV',
      desc: 'Liste des comptes avec soldes et limites',
      color: 'indigo', fn: exportComptesCSV,
    },
  ]

  const colorMap = {
    green:  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400',
    red:    'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400',
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Export des données</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Téléchargez vos données financières en CSV ou en JSON pour les archiver, les importer dans Excel, ou les partager avec un comptable.
        </p>
      </div>

      {/* Export complet JSON */}
      <div className="card-primary p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📦</span>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Export complet</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium">JSON</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Toutes vos données en un seul fichier : revenus, dépenses, catégories, comptes et dettes.
              Idéal pour une sauvegarde complète.
            </p>
          </div>
          <button
            onClick={exportJSON}
            disabled={loading === 'json'}
            className="btn-primary flex-shrink-0"
          >
            {loading === 'json' ? (
              <><span className="animate-spin">⏳</span> Export...</>
            ) : (
              <>⬇ Télécharger</>
            )}
          </button>
        </div>
      </div>

      {/* Exports individuels CSV */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Exports individuels (CSV)</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {cards.map(c => (
            <div key={c.key} className={`rounded-xl p-5 border ${colorMap[c.color]}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{c.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{c.title}</p>
                    <span className="text-xs opacity-70">{c.format}</span>
                  </div>
                </div>
                <button
                  onClick={c.fn}
                  disabled={loading === c.key}
                  className="flex-shrink-0 px-3 py-1.5 bg-white dark:bg-gray-800 border border-current rounded-lg text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-40 flex items-center gap-1"
                >
                  {loading === c.key ? '⏳' : '⬇'} {loading === c.key ? '...' : 'CSV'}
                </button>
              </div>
              <p className="text-xs opacity-80">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p className="font-medium text-gray-600 dark:text-gray-300">ℹ️ Notes</p>
        <p>• Les fichiers CSV s'ouvrent directement dans Excel, LibreOffice ou Google Sheets.</p>
        <p>• L'encodage UTF-8 avec BOM garantit l'affichage correct des accents.</p>
        <p>• Le JSON complet peut être utilisé comme sauvegarde ou pour migrer vers une autre application.</p>
      </div>
    </div>
  )
}

