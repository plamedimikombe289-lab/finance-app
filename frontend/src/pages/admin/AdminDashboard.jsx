import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { SkeletonDashboard } from '../../components/SkeletonLoader'

function StatCard({ label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
    green:  'text-green-600  dark:text-green-400  bg-green-50  dark:bg-green-900/20',
    red:    'text-red-600    dark:text-red-400    bg-red-50    dark:bg-red-900/20',
    amber:  'text-amber-600  dark:text-amber-400  bg-amber-50  dark:bg-amber-900/20',
  }
  return (
    <div className="card-primary p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <p className={`text-3xl font-bold ${colors[color].split(' ')[0]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboard() {
  const { fmt } = useAuth()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([adminApi.getStats(), adminApi.listUsers()])
      .then(([s, u]) => { setStats(s); setUsers(u) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonDashboard />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Administration</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Vue globale de la plateforme</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Utilisateurs actifs" value={stats.users.actifs}
            sub={`${stats.users.total} total`} color="indigo" />
          <StatCard label="Revenus cumulés"
            value={`${parseFloat(stats.revenus.total_revenus).toFixed(0)} €`}
            sub={`${stats.revenus.nb_revenus} entrées`} color="green" />
          <StatCard label="Dettes restantes"
            value={`${parseFloat(stats.dettes.total_dettes).toFixed(0)} €`}
            sub={`${stats.dettes.nb_dettes} dettes actives`} color="red" />
          <StatCard label="Dépenses ce mois"
            value={`${parseFloat(stats.depenses.total_depenses_mois).toFixed(0)} €`}
            color="amber" />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Comptes utilisateurs</h2>
          <Link to="/admin/users" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="card-primary overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Utilisateur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rôle</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Revenus</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Soldes</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.slice(0, 8).map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{u.nom}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      u.role === 'admin'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {u.role === 'admin' ? '👑 Admin' : '👤 User'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{u.nb_revenus}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                    {fmt(u.total_soldes || 0)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.actif
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/users/${u.id}`}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                      Détails
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
