import axios from 'axios'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 800

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  timeout: 10000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('finance_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  config._retryCount = config._retryCount ?? 0
  return config
})

api.interceptors.response.use(
  res => res.data,
  async err => {
    const config = err.config

    // Retry on network errors or 5xx, but not on 4xx (client errors) or if no config
    const isNetworkError = !err.response
    const isServerError  = err.response?.status >= 500
    const canRetry = config && (isNetworkError || isServerError) && config._retryCount < MAX_RETRIES

    if (canRetry) {
      config._retryCount += 1
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * config._retryCount))
      return api(config)
    }

    if (err.response?.status === 401) {
      localStorage.removeItem('finance_token')
      localStorage.removeItem('finance_user')
      window.location.href = '/login'
    }
    return Promise.reject(err.response?.data || { message: err.message })
  }
)

export const authApi = {
  login:               (data) => api.post('/auth/login', data),
  register:            (data) => api.post('/auth/register', data),
  me:                  ()     => api.get('/auth/me'),
  changePassword:      (data) => api.put('/auth/password', data),
  updateDevise:        (data) => api.put('/auth/devise', data),
  completerOnboarding: ()     => api.post('/auth/onboarding'),
  toggleEmailRappels:  (actif) => api.patch('/auth/email-rappels', { actif }),
  testerEmailRappels:  ()      => api.post('/auth/email-rappels/test'),
  forgotPassword:       (email) => api.post('/auth/forgot-password', { email }),
  resetPassword:        (data)  => api.post('/auth/reset-password', data),
  verifyEmail:          (token) => api.get('/auth/verify-email', { params: { token } }),
  resendVerification:   (email) => api.post('/auth/resend-verification', { email }),
}

export const adminApi = {
  getStats:       ()                     => api.get('/admin/stats'),
  listUsers:      ()                     => api.get('/admin/users'),
  getUserData:    (userId)               => api.get(`/admin/users/${userId}`),
  updateUser:     (userId, data)         => api.put(`/admin/users/${userId}`, data),
  deleteUser:     (userId)               => api.delete(`/admin/users/${userId}`),
  patchUserRevenu:(userId, revenuId, data) => api.patch(`/admin/users/${userId}/revenus/${revenuId}`, data),
  deleteUserRevenu:(userId, revenuId)    => api.delete(`/admin/users/${userId}/revenus/${revenuId}`),
  patchUserDette:  (userId, detteId, data) => api.patch(`/admin/users/${userId}/dettes/${detteId}`, data),
  impersonate:     (userId)               => api.post(`/admin/users/${userId}/impersonate`),
  verifyUser:      (userId)               => api.post(`/admin/users/${userId}/verify`),
}

export const revenusApi = {
  lister:           (params) => api.get('/revenus', { params }),
  obtenir:          (id)     => api.get(`/revenus/${id}`),
  creer:            (data)   => api.post('/revenus', data),
  supprimer:        (id)     => api.delete(`/revenus/${id}`),
  restaurer:        (id)     => api.post(`/revenus/${id}/restaurer`),
  supprimerDefinitif:(id)   => api.delete(`/revenus/${id}/definitif`),
  redistribuer:     ()       => api.post('/revenus/redistribuer'),
}

export const categoriesApi = {
  lister:      ()         => api.get('/categories'),
  creer:       (data)     => api.post('/categories', data),
  modifier:    (id, data) => api.put(`/categories/${id}`, data),
  supprimer:   (id)       => api.delete(`/categories/${id}`),
  ajusterSolde:(id, data) => api.patch(`/categories/${id}/solde`, data),
  virer:       (data)     => api.post('/categories/virement', data),
}

export const modelesApi = {
  lister:   ()       => api.get('/modeles'),
  creer:    (data)   => api.post('/modeles', data),
  utiliser: (id)     => api.post(`/modeles/${id}/utiliser`),
  supprimer:(id)     => api.delete(`/modeles/${id}`),
}

export const dettesApi = {
  lister:          (params)     => api.get('/dettes', { params }),
  rappels:         ()           => api.get('/dettes/rappels'),
  obtenir:         (id)         => api.get(`/dettes/${id}`),
  creer:           (data)       => api.post('/dettes', data),
  modifier:        (id, data)   => api.put(`/dettes/${id}`, data),
  payer:           (id, data)   => api.post(`/dettes/${id}/paiement`, data),
  supprimer:       (id)         => api.delete(`/dettes/${id}`),
  supprimerForce:  (id)         => api.delete(`/dettes/${id}/force`),
  planifier:       (data)       => api.post('/dettes/planifier', data),
  listerPlans:     ()           => api.get('/dettes/plans'),
  sauvegarderPlan: (data)       => api.post('/dettes/plans', data),
  mettreAJourPlan: (id, data)   => api.put(`/dettes/plans/${id}`, data),
  supprimerPlan:   (id)         => api.delete(`/dettes/plans/${id}`),
}

export const depensesApi = {
  lister:            (params) => api.get('/depenses', { params }),
  creer:             (data)   => api.post('/depenses', data),
  supprimer:         (id)     => api.delete(`/depenses/${id}`),
  restaurer:         (id)     => api.post(`/depenses/${id}/restaurer`),
  supprimerDefinitif:(id)    => api.delete(`/depenses/${id}/definitif`),
  suggestion:        (q)      => api.get('/depenses/suggestion', { params: { q } }),
}

export const corbeilleApi = {
  lister: () => api.get('/corbeille'),
}

export const rapportsApi = {
  dashboard:           ()       => api.get('/rapports/dashboard'),
  budgetMensuel:       ()       => api.get('/rapports/budget-mensuel'),
  historique:          (params) => api.get('/rapports/historique', { params }),
  revenu:              (id)     => api.get(`/rapports/revenus/${id}`),
  evolution:           (params) => api.get('/rapports/evolution', { params }),
  fiscal:              (annee)  => api.get('/rapports/fiscal', { params: { annee } }),
  valeurNette:         ()       => api.get('/rapports/valeur-nette'),
  scoresHistoriques:   ()       => api.get('/rapports/scores'),
  sauvegarderScore:    (score)  => api.post('/rapports/scores', { score }),
}

export const modelesDepensesApi = {
  lister:   ()       => api.get('/modeles-depenses'),
  creer:    (data)   => api.post('/modeles-depenses', data),
  utiliser: (id)     => api.post(`/modeles-depenses/${id}/utiliser`),
  supprimer:(id)     => api.delete(`/modeles-depenses/${id}`),
}

export const motivationsApi = {
  lister: () => api.get('/motivations'),
}

export const actifsApi = {
  lister:   ()           => api.get('/actifs'),
  creer:    (data)       => api.post('/actifs', data),
  modifier: (id, data)   => api.put(`/actifs/${id}`, data),
  supprimer:(id)         => api.delete(`/actifs/${id}`),
}

export const comptesApi = {
  lister:    ()          => api.get('/comptes'),
  creer:     (data)      => api.post('/comptes', data),
  modifier:  (id, data)  => api.put(`/comptes/${id}`, data),
  supprimer: (id)        => api.delete(`/comptes/${id}`),
  ajuster:   (id, data)  => api.post(`/comptes/${id}/ajuster`, data),
  virement:  (data)      => api.post('/comptes/virement', data),
  virements: ()          => api.get('/comptes/virements'),
}

export const iaApi = {
  statut:      ()     => api.get('/ia/statut',       { timeout: 5000,    _retryCount: 99 }),
  chat:        (data) => api.post('/ia/chat', data,  { timeout: 120_000, _retryCount: 99 }),
  messageJour: ()     => api.get('/ia/message-jour', { timeout: 90_000,  _retryCount: 99 }),
}
