const { listerCategories, creerCategorie, supprimerCategorie } = require('../../src/controllers/categoriesController')

// ── Mock DB ──────────────────────────────────────────────────────────────────
jest.mock('../../src/database/db', () => ({
  pool: { execute: jest.fn() },
  transaction: jest.fn(),
}))

const { pool, transaction } = require('../../src/database/db')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json   = jest.fn().mockReturnValue(res)
  return res
}

function mockReq(body = {}, params = {}, user = { id: 1 }) {
  return { body, params, user }
}

// ── listerCategories ─────────────────────────────────────────────────────────
describe('listerCategories', () => {
  beforeEach(() => jest.clearAllMocks())

  test('retourne les catégories et le total des soldes', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 1, nom: 'Loyer', type: 'fixe', solde: '500', depenses_mois: '0' },
      { id: 2, nom: 'Épargne', type: 'pourcentage', solde: '200', depenses_mois: '50' },
    ]])
    const req = mockReq({}, {}, { id: 1 })
    const res = mockRes()
    await listerCategories(req, res, jest.fn())
    expect(res.json).toHaveBeenCalledWith({
      categories: expect.any(Array),
      total_soldes: 700,
    })
  })

  test('retourne total_soldes = 0 si aucune catégorie', async () => {
    pool.execute.mockResolvedValueOnce([[]])
    const req = mockReq()
    const res = mockRes()
    await listerCategories(req, res, jest.fn())
    expect(res.json).toHaveBeenCalledWith({ categories: [], total_soldes: 0 })
  })

  test('appelle next(err) si la DB lève une exception', async () => {
    pool.execute.mockRejectedValueOnce(new Error('DB error'))
    const next = jest.fn()
    await listerCategories(mockReq(), mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})

// ── creerCategorie ───────────────────────────────────────────────────────────
describe('creerCategorie', () => {
  beforeEach(() => jest.clearAllMocks())

  test('retourne 400 si nom manquant', async () => {
    const res = mockRes()
    await creerCategorie(mockReq({ type: 'fixe', valeur: 100 }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('nom') }))
  })

  test('retourne 400 si type invalide', async () => {
    const res = mockRes()
    await creerCategorie(mockReq({ nom: 'Test', type: 'mauvais', valeur: 10 }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('retourne 400 si valeur négative', async () => {
    const res = mockRes()
    await creerCategorie(mockReq({ nom: 'Test', type: 'fixe', valeur: -5 }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('retourne 400 si pourcentage > 100', async () => {
    const res = mockRes()
    await creerCategorie(mockReq({ nom: 'Test', type: 'pourcentage', valeur: 150 }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('insère et retourne la catégorie créée', async () => {
    const newCat = { id: 10, nom: 'Loyer', type: 'fixe', valeur: 800 }
    pool.execute
      .mockResolvedValueOnce([{ insertId: 10 }])  // INSERT
      .mockResolvedValueOnce([[newCat]])            // SELECT
    const res = mockRes()
    await creerCategorie(mockReq({ nom: 'Loyer', type: 'fixe', valeur: 800 }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(newCat)
  })
})

// ── supprimerCategorie ───────────────────────────────────────────────────────
describe('supprimerCategorie', () => {
  beforeEach(() => jest.clearAllMocks())

  test('retourne 404 si catégorie introuvable', async () => {
    pool.execute.mockResolvedValueOnce([[]])  // SELECT returns nothing
    const res = mockRes()
    await supprimerCategorie(mockReq({}, { id: 99 }), res, jest.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('désactive la catégorie et retourne un message', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 5 }]])  // SELECT finds it
      .mockResolvedValueOnce([{}])            // UPDATE
    const res = mockRes()
    await supprimerCategorie(mockReq({}, { id: 5 }), res, jest.fn())
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }))
    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining('actif = 0'),
      expect.any(Array)
    )
  })
})
