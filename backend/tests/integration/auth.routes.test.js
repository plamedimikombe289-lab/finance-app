// Les mocks doivent être déclarés AVANT tout require()
jest.mock('../../src/database/db', () => ({
  pool: { execute: jest.fn() },
  transaction: jest.fn(),
}))
jest.mock('../../src/services/emailService', () => ({
  createTransporter: () => null,
  envoyerVerificationEmail:      jest.fn().mockResolvedValue(true),
  envoyerResetMotDePasse:        jest.fn().mockResolvedValue(true),
  envoyerConfirmationChangement: jest.fn().mockResolvedValue(true),
  envoyerRappelDettes:           jest.fn().mockResolvedValue(true),
}))
jest.mock('../../src/database/init', () => ({
  seedDefaultCategories: jest.fn().mockResolvedValue(true),
  initDatabase:          jest.fn().mockResolvedValue(true),
}))
jest.mock('../../src/utils/envValidator', () => ({ validateEnv: jest.fn() }))
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}))
jest.mock('../../src/services/cronJobs', () => ({ startCronJobs: jest.fn() }))
jest.mock('../../src/middleware/audit', () => ({
  auditMiddleware: (req, res, next) => next(),
}))

const request    = require('supertest')
const express    = require('express')
const { pool, transaction } = require('../../src/database/db')
const errorHandler = require('../../src/middleware/errorHandler')
const { generateToken } = require('../../src/middleware/auth')

// Mini-app de test (pas de rate-limiting, pas d'initDB)
const app = express()
app.use(express.json())
app.use('/api/auth', require('../../src/routes/auth'))
app.use(errorHandler)

beforeEach(() => jest.clearAllMocks())

// ── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('400 si email manquant', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'abc' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/email/i)
  })

  test('400 si password manquant', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' })
    expect(res.status).toBe(400)
  })

  test('401 si utilisateur inexistant', async () => {
    pool.execute.mockResolvedValueOnce([[]])  // SELECT users WHERE email → vide
    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'pass' })
    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Identifiants incorrects.')
  })

  test('401 si mot de passe incorrect', async () => {
    const bcrypt = require('bcryptjs')
    const hash = await bcrypt.hash('correct', 10)
    pool.execute.mockResolvedValueOnce([[{
      id: 1, nom: 'Alice', email: 'alice@test.com', password_hash: hash,
      role: 'user', actif: 1, devise: 'CAD', onboarding_complete: 0, email_verified: 1,
    }]])
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@test.com', password: 'wrong' })
    expect(res.status).toBe(401)
  })

  test('403 si compte désactivé', async () => {
    const bcrypt = require('bcryptjs')
    const hash = await bcrypt.hash('pass', 10)
    pool.execute.mockResolvedValueOnce([[{
      id: 1, nom: 'Bob', email: 'bob@test.com', password_hash: hash,
      role: 'user', actif: 0, devise: 'CAD', onboarding_complete: 0, email_verified: 1,
    }]])
    const res = await request(app).post('/api/auth/login').send({ email: 'bob@test.com', password: 'pass' })
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/désactivé/i)
  })

  test('403 si email non vérifié (utilisateur standard)', async () => {
    const bcrypt = require('bcryptjs')
    const hash = await bcrypt.hash('pass', 10)
    pool.execute.mockResolvedValueOnce([[{
      id: 1, nom: 'Carol', email: 'carol@test.com', password_hash: hash,
      role: 'user', actif: 1, devise: 'CAD', onboarding_complete: 0, email_verified: 0,
    }]])
    const res = await request(app).post('/api/auth/login').send({ email: 'carol@test.com', password: 'pass' })
    expect(res.status).toBe(403)
    expect(res.body.email_non_verifie).toBe(true)
  })

  test('200 + token si admin avec email non vérifié (bypass)', async () => {
    const bcrypt = require('bcryptjs')
    const hash = await bcrypt.hash('adminpass', 10)
    pool.execute.mockResolvedValueOnce([[{
      id: 99, nom: 'Admin', email: 'admin@test.com', password_hash: hash,
      role: 'admin', actif: 1, devise: 'CAD', onboarding_complete: 1, email_verified: 0,
    }]])
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'adminpass' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user).not.toHaveProperty('password_hash')
  })

  test('200 + token si identifiants valides et compte vérifié', async () => {
    const bcrypt = require('bcryptjs')
    const hash = await bcrypt.hash('mypass', 10)
    pool.execute.mockResolvedValueOnce([[{
      id: 5, nom: 'Dave', email: 'dave@test.com', password_hash: hash,
      role: 'user', actif: 1, devise: 'EUR', onboarding_complete: 1, email_verified: 1,
    }]])
    const res = await request(app).post('/api/auth/login').send({ email: 'dave@test.com', password: 'mypass' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.email).toBe('dave@test.com')
    expect(res.body.user).not.toHaveProperty('password_hash')
    expect(res.body.user).not.toHaveProperty('email_verified')
  })
})

// ── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  test('400 si nom manquant', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com', password: 'abc123' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/nom/i)
  })

  test('400 si email manquant', async () => {
    const res = await request(app).post('/api/auth/register').send({ nom: 'Alice', password: 'abc123' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/email/i)
  })

  test('400 si mot de passe < 6 caractères', async () => {
    const res = await request(app).post('/api/auth/register').send({ nom: 'Alice', email: 'a@b.com', password: 'abc' })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/6 caractères/i)
  })

  test('409 si email déjà utilisé', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 1 }]])  // email déjà pris
    const res = await request(app).post('/api/auth/register').send({ nom: 'Alice', email: 'dup@test.com', password: 'abc123' })
    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/déjà utilisé/i)
  })

  test('201 + token si SMTP désactivé (compte auto-vérifié)', async () => {
    const { seedDefaultCategories } = require('../../src/database/init')
    pool.execute.mockResolvedValueOnce([[]])  // email pas pris
    pool.execute.mockResolvedValueOnce([[{ id: 10, nom: 'Eve', email: 'eve@test.com', role: 'user', actif: 1, devise: 'CAD', onboarding_complete: 0, created_at: new Date() }]])
    transaction.mockImplementation(async fn => {
      await fn({ execute: jest.fn().mockResolvedValue([[{ insertId: 10 }]]) })
    })
    const res = await request(app).post('/api/auth/register').send({ nom: 'Eve', email: 'eve@test.com', password: 'abc123' })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
  })
})

// ── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  test('401 sans token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  test('200 avec token valide', async () => {
    pool.execute.mockResolvedValueOnce([[{
      id: 1, nom: 'Alice', email: 'alice@test.com', role: 'user',
      actif: 1, devise: 'CAD', onboarding_complete: 1, email_rappels_actif: 0, created_at: new Date(),
    }]])
    const token = generateToken({ id: 1, nom: 'Alice', email: 'alice@test.com', role: 'user' })
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.email).toBe('alice@test.com')
  })
})

// ── POST /api/auth/forgot-password ──────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  test('400 si email manquant', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({})
    expect(res.status).toBe(400)
  })

  test('200 générique si email inconnu (anti-énumération)', async () => {
    pool.execute.mockResolvedValueOnce([[]])  // email inexistant
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'inconnu@test.com' })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/si cet email/i)
  })
})
