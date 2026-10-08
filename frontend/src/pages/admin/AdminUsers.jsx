import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../hooks/useConfirm'
import { SkeletonListPage } from '../../components/SkeletonLoader'
import Modal from '../../components/Modal'

const roleCls = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  user:  'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400',
}

export default function AdminUsers() {
  const { user: me, fmt } = useAuth()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState(null)
  const [search, setSearch] = useState('')


  const charger = () => {
    setLoading(true)
    adminApi.listUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { charger() }, [])

  const openEdit = (u) => {
    setEditModal(u)
    setEditForm({ nom: u.nom, email: u.email, role: u.role, actif: u.actif, new_password: '' })
    setEditError(null)
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    setEditError(null)
    setEditLoading(true)
    try {
      await adminApi.updateUser(editModal.id, {
        nom:          editForm.nom,
        email:        editForm.email,
        role:         editForm.role,
        actif:        parseInt(editForm.actif),
        new_password: editForm.new_password || undefined,
      })
      setEditModal(null)
      charger()
    } catch (e) {
      setEditError(e.message || 'Erreur')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeactivate = async (u) => {
    if (!await confirm(`Désactiver le compte de ${u.nom} ?`, { danger: true, confirmLabel: 'Désactiver' })) return
    try { await adminApi.deleteUser(u.id); charger() } catch (e) { toast.error(e.message) }
  }

  const handleVerify = async (u) => {
    if (!await confirm(`Vérifier manuellement le compte de ${u.nom} ?`, { confirmLabel: 'Vérifier' })) return
    try {
      await adminApi.verifyUser(u.id)
      toast.success(`Compte de ${u.nom} vérifié.`)
      charger()
    } catch (e) { toast.error(e.message) }
  }

  const filtered = users.filter(u =>
    u.nom.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Utilisateurs</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">{users.length} compte(s)</span>
      </div>

      <input
        type="text" placeholder="Rechercher par nom ou email..."
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {loading ? (
        <SkeletonListPage />
      ) : (
        <div className="card-primary overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilisateur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rôle</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenus</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Soldes</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Inscrit le</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{u.nom}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleCls[u.role]}`}>
                      {u.role === 'admin' ? '👑 Admin' : '👤 User'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{u.nb_revenus}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                    {fmt(u.total_soldes || 0)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        u.actif
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
                      {!u.email_verified && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Non vérifié
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link to={`/admin/users/${u.id}`}
                        className="px-2 py-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-colors">
                        Détails
                      </Link>
                      <button onClick={() => openEdit(u)}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        Modifier
                      </button>
                      {!u.email_verified && (
                        <button onClick={() => handleVerify(u)}
                          className="px-2 py-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 transition-colors">
                          Vérifier
                        </button>
                      )}
                      {u.id !== me?.id && u.actif ? (
                        <button onClick={() => handleDeactivate(u)}
                          className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors">
                          Désactiver
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editModal} onClose={() => setEditModal(null)} label={editModal ? `Modifier ${editModal.nom}` : 'Modifier'}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Modifier {editModal?.nom}</h3>
            <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
          {editModal && (
            <>
              {editError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {editError}
                </div>
              )}
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Nom</label>
                  <input type="text" value={editForm.nom} onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Rôle</label>
                    <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="input-field">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">Statut</label>
                    <select value={editForm.actif} onChange={e => setEditForm(f => ({ ...f, actif: e.target.value }))} className="input-field">
                      <option value={1}>Actif</option>
                      <option value={0}>Inactif</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-label text-gray-500 dark:text-gray-400 mb-1.5">
                    Nouveau mot de passe <span className="text-gray-400">(laisser vide pour ne pas changer)</span>
                  </label>
                  <input type="password" value={editForm.new_password}
                    onChange={e => setEditForm(f => ({ ...f, new_password: e.target.value }))}
                    className="input-field" placeholder="••••••••" />
                </div>
                <button type="submit" disabled={editLoading} className="btn-primary w-full">
                  {editLoading ? 'Enregistrement...' : 'Sauvegarder'}
                </button>
              </form>
            </>
          )}
        </div>
      </Modal>
      {ConfirmDialog}
    </div>
  )
}






