import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, CreditCard, FolderKanban,
  ShoppingCart, BarChart2, FileText, Landmark, Download,
  Trash2, Settings, Users, ChevronRight, Sparkles,
} from './Icons'

const LABELS = {
  dashboard:        { label: 'Tableau de bord', Icon: LayoutDashboard },
  revenus:          { label: 'Revenus',          Icon: TrendingUp },
  dettes:           { label: 'Dettes',           Icon: CreditCard },
  categories:       { label: 'Catégories',       Icon: FolderKanban },
  depenses:         { label: 'Dépenses',         Icon: ShoppingCart },
  rapports:         { label: 'Rapports',         Icon: BarChart2 },
  'rapport-fiscal': { label: 'Rapport fiscal',   Icon: FileText },
  comptes:          { label: 'Comptes',          Icon: Landmark },
  export:           { label: 'Export données',   Icon: Download },
  corbeille:        { label: 'Corbeille',        Icon: Trash2 },
  'conseiller-ia':  { label: 'San Prince IA',    Icon: Sparkles },
  parametres:       { label: 'Paramètres',       Icon: Settings },
  admin:            { label: 'Administration',   Icon: Settings },
  users:            { label: 'Utilisateurs',     Icon: Users },
}

export default function Breadcrumb() {
  const location = useLocation()
  const parts = location.pathname.replace(/^\//, '').split('/').filter(Boolean)

  if (parts.length === 0) return null

  const crumbs = []
  let accumulated = ''

  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]
    accumulated += '/' + seg
    const meta = LABELS[seg]
    crumbs.push({
      path:    accumulated,
      label:   meta?.label ?? `#${seg}`,
      Icon:    meta?.Icon ?? null,
      isLast:  i === parts.length - 1,
    })
  }

  if (crumbs.length <= 1) return null

  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
          )}
          {crumb.isLast ? (
            <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200 font-medium">
              {crumb.Icon && <crumb.Icon size={14} className="opacity-70" />}
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {crumb.Icon && <crumb.Icon size={14} className="opacity-60" />}
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
