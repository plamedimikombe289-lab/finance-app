jest.mock('../../src/database/db', () => ({
  pool: { execute: jest.fn() },
  transaction: jest.fn(),
}))

const { pool } = require('../../src/database/db')
const { repartirRevenu, annulerRepartition } = require('../../src/services/repartitionService')

const DATE_ROW = [[{ date: '2024-05-01' }]]

function mockCats(cats) {
  pool.execute
    .mockResolvedValueOnce(DATE_ROW)   // SELECT date FROM revenus
    .mockResolvedValueOnce([cats])     // SELECT categories
    .mockResolvedValue([[]])           // INSERT repartitions + soldes (default)
}

function mockCatsAvecCap(cats, dejaAlloue = 0) {
  pool.execute.mockResolvedValueOnce(DATE_ROW)
  pool.execute.mockResolvedValueOnce([cats])
  // For each fixe cat with plafond, mock the cap check
  cats.filter(c => c.type === 'fixe' && c.plafond_mensuel != null).forEach(() => {
    pool.execute.mockResolvedValueOnce([[{ total_mois: dejaAlloue }]])
  })
  pool.execute.mockResolvedValue([[]])
}

beforeEach(() => jest.clearAllMocks())

// ── Catégories fixes ────────────────────────────────────────────────────────

describe('catégories fixes', () => {
  test('alloue le montant fixe si revenu suffisant', async () => {
    const cats = [{ id: 1, nom: 'Loyer', type: 'fixe', valeur: '500.00', plafond_mensuel: null }]
    mockCats(cats)
    const { lignes, non_reparti } = await repartirRevenu(1, 1000, 1)
    expect(lignes[0].montant).toBe(500)
    expect(non_reparti).toBe(500)
  })

  test("alloue au maximum le revenu disponible si inférieur à la valeur fixe", async () => {
    const cats = [{ id: 1, nom: 'Loyer', type: 'fixe', valeur: '800.00', plafond_mensuel: null }]
    mockCats(cats)
    const { lignes, non_reparti } = await repartirRevenu(1, 300, 1)
    expect(lignes[0].montant).toBe(300)
    expect(non_reparti).toBe(0)
  })

  test('plusieurs catégories fixes consommées dans l\'ordre', async () => {
    const cats = [
      { id: 1, nom: 'Loyer',     type: 'fixe', valeur: '500.00', plafond_mensuel: null },
      { id: 2, nom: 'Épargne',   type: 'fixe', valeur: '200.00', plafond_mensuel: null },
      { id: 3, nom: 'Transport', type: 'fixe', valeur: '100.00', plafond_mensuel: null },
    ]
    mockCats(cats)
    const { lignes, non_reparti } = await repartirRevenu(1, 1000, 1)
    expect(lignes[0].montant).toBe(500)
    expect(lignes[1].montant).toBe(200)
    expect(lignes[2].montant).toBe(100)
    expect(non_reparti).toBe(200)
  })

  test('stoppe les allocations quand le revenu est épuisé', async () => {
    const cats = [
      { id: 1, nom: 'Loyer',   type: 'fixe', valeur: '600.00', plafond_mensuel: null },
      { id: 2, nom: 'Épargne', type: 'fixe', valeur: '600.00', plafond_mensuel: null },
    ]
    mockCats(cats)
    const { lignes, non_reparti } = await repartirRevenu(1, 600, 1)
    // La boucle s'arrête dès montantRestant <= 0, donc seule la 1ère cat est dans lignes
    expect(lignes[0].montant).toBe(600)
    expect(lignes.length).toBe(1)
    expect(non_reparti).toBe(0)
  })
})

// ── Plafond mensuel ─────────────────────────────────────────────────────────

describe('plafond mensuel', () => {
  test('respecte le plafond mensuel si déjà partiellement alloué', async () => {
    const cats = [{ id: 1, nom: 'Loyer', type: 'fixe', valeur: '500.00', plafond_mensuel: '600.00' }]
    mockCatsAvecCap(cats, 400) // 400 déjà alloués ce mois → reste 200
    const { lignes } = await repartirRevenu(1, 1000, 1)
    expect(lignes[0].montant).toBe(200)
  })

  test('alloue 0 si plafond mensuel déjà atteint', async () => {
    const cats = [{ id: 1, nom: 'Loyer', type: 'fixe', valeur: '500.00', plafond_mensuel: '500.00' }]
    mockCatsAvecCap(cats, 500) // plafond exactement atteint
    const { lignes, non_reparti } = await repartirRevenu(1, 1000, 1)
    expect(lignes[0].montant).toBe(0)
    expect(non_reparti).toBe(1000)
  })
})

// ── Catégories pourcentage ──────────────────────────────────────────────────

describe('catégories pourcentage', () => {
  test('répartit 100% du reste entre catégories pourcentage', async () => {
    const cats = [
      { id: 1, nom: 'Alimentation', type: 'pourcentage', valeur: '60.00', plafond_mensuel: null },
      { id: 2, nom: 'Loisirs',      type: 'pourcentage', valeur: '40.00', plafond_mensuel: null },
    ]
    mockCats(cats)
    const { lignes, non_reparti } = await repartirRevenu(1, 1000, 1)
    expect(lignes[0].montant).toBe(600)
    expect(lignes[1].montant).toBe(400)
    expect(non_reparti).toBe(0)
  })

  test('pourcentages appliqués sur le reste après les fixes', async () => {
    const cats = [
      { id: 1, nom: 'Loyer',        type: 'fixe',        valeur: '400.00', plafond_mensuel: null },
      { id: 2, nom: 'Alimentation', type: 'pourcentage', valeur: '50.00',  plafond_mensuel: null },
      { id: 3, nom: 'Épargne',      type: 'pourcentage', valeur: '50.00',  plafond_mensuel: null },
    ]
    mockCats(cats)
    const { lignes } = await repartirRevenu(1, 1000, 1)
    expect(lignes[0].montant).toBe(400)  // fixe
    expect(lignes[1].montant).toBe(300)  // 50% de 600
    expect(lignes[2].montant).toBe(300)  // 50% de 600
  })

  test('non_reparti si pourcentages < 100%', async () => {
    const cats = [
      { id: 1, nom: 'Alimentation', type: 'pourcentage', valeur: '70.00', plafond_mensuel: null },
    ]
    mockCats(cats)
    const { lignes, non_reparti } = await repartirRevenu(1, 1000, 1)
    expect(lignes[0].montant).toBe(700)
    expect(non_reparti).toBe(300)
  })
})

// ── Arrondis ─────────────────────────────────────────────────────────────────

describe('arrondis', () => {
  test('évite les erreurs de flottants sur les pourcentages', async () => {
    const cats = [
      { id: 1, nom: 'Cat A', type: 'pourcentage', valeur: '33.33', plafond_mensuel: null },
      { id: 2, nom: 'Cat B', type: 'pourcentage', valeur: '33.33', plafond_mensuel: null },
      { id: 3, nom: 'Cat C', type: 'pourcentage', valeur: '33.34', plafond_mensuel: null },
    ]
    mockCats(cats)
    const { montant_total, non_reparti } = await repartirRevenu(1, 100, 1)
    expect(montant_total).toBe(100)
    // Tolérance de 1 centime due aux arrondis
    expect(non_reparti).toBeLessThanOrEqual(0.01)
  })
})

// ── annulerRepartition ───────────────────────────────────────────────────────

describe('annulerRepartition', () => {
  test('supprime les repartitions et décrémente les soldes', async () => {
    pool.execute
      .mockResolvedValueOnce([[                        // SELECT repartitions
        { categorie_id: 1, montant: 300 },
        { categorie_id: 2, montant: 200 },
      ]])
      .mockResolvedValueOnce([[]])                     // UPDATE soldes cat 1
      .mockResolvedValueOnce([[]])                     // UPDATE soldes cat 2
      .mockResolvedValueOnce([[]])                     // DELETE repartitions

    await annulerRepartition(99)

    const calls = pool.execute.mock.calls
    expect(calls[0][0]).toMatch(/SELECT.*repartitions/i)
    expect(calls[1][0]).toMatch(/UPDATE soldes_categories/i)
    expect(calls[3][0]).toMatch(/DELETE.*repartitions/i)
  })

  test('ne fait rien si aucune repartition existante', async () => {
    pool.execute
      .mockResolvedValueOnce([[]])  // SELECT repartitions = vide
      .mockResolvedValueOnce([[]])  // DELETE

    await annulerRepartition(99)

    // Seulement 2 appels : SELECT + DELETE, pas d'UPDATE soldes
    expect(pool.execute).toHaveBeenCalledTimes(2)
  })
})
