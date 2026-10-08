import { useState, useEffect } from 'react'
import { motivationsApi } from '../api'
import { Link } from 'react-router-dom'
import { Target } from './Icons'

const TYPE_CONFIG = {
  success: {
    bar:    'bg-green-500',
    badge:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    bg:     'bg-green-50/60 dark:bg-green-900/10',
  },
  warning: {
    bar:    'bg-amber-400',
    badge:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    bg:     'bg-amber-50/60 dark:bg-amber-900/10',
  },
  danger: {
    bar:    'bg-red-500',
    badge:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    bg:     'bg-red-50/60 dark:bg-red-900/10',
  },
  info: {
    bar:    'bg-indigo-400',
    badge:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    bg:     'bg-indigo-50/60 dark:bg-indigo-900/10',
  },
}

function MotivationCard({ item }) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.info
  const showBar = item.progress != null && item.progress >= 0

  return (
    <div className={`rounded-xl border p-4 ${cfg.border} ${cfg.bg} flex flex-col gap-2.5`}>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.titre}</p>
          {item.categorie && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.badge}`}>
              {item.categorie}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{item.message}</p>
      </div>

      {showBar && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-700 ${cfg.bar}`}
            style={{ width: `${Math.min(100, Math.round(item.progress * 100))}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function MotivationsWidget() {
  const [motivations, setMotivations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  useEffect(() => {
    motivationsApi.lister()
      .then(data => setMotivations(data.motivations ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="card-primary p-5">
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) return null

  const hasData = motivations.length > 0 && !(motivations.length === 1 && motivations[0].progress === null)

  return (
    <div className="card-primary p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-indigo-500 dark:text-indigo-400">
            <Target size={16} strokeWidth={2} />
          </span>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Conseils personnalisés</h2>
        </div>
        {hasData && (
          <Link
            to="/categories"
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium"
          >
            Gérer mes objectifs →
          </Link>
        )}
      </div>

      {motivations.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          Ajoute des objectifs à tes catégories pour voir des conseils ici.
        </p>
      ) : (
        <div className="space-y-3">
          {motivations.map((item, i) => (
            <MotivationCard key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
