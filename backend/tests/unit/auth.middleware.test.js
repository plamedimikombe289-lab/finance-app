const { auth, admin, generateToken } = require('../../src/middleware/auth')

describe('middleware auth', () => {
  let req, res, next

  beforeEach(() => {
    req = { headers: {} }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    next = jest.fn()
  })

  test('rejette une requête sans header Authorization', () => {
    auth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentification requise.' })
    expect(next).not.toHaveBeenCalled()
  })

  test('rejette un header sans préfixe Bearer', () => {
    req.headers.authorization = 'Basic abc123'
    auth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('rejette un token JWT invalide', () => {
    req.headers.authorization = 'Bearer token.invalide.ici'
    auth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: 'Token invalide ou expiré.' })
    expect(next).not.toHaveBeenCalled()
  })

  test('accepte un JWT valide et injecte req.user', () => {
    const payload = { id: 42, nom: 'Alice', email: 'alice@test.com', role: 'user' }
    const token = generateToken(payload)
    req.headers.authorization = `Bearer ${token}`

    auth(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user).toMatchObject({ id: 42, nom: 'Alice', role: 'user' })
    expect(res.status).not.toHaveBeenCalled()
  })

  test('rejette un JWT expiré', () => {
    const jwt = require('jsonwebtoken')
    const secret = process.env.JWT_SECRET
    const token = jwt.sign({ id: 1 }, secret, { expiresIn: '0ms' })
    req.headers.authorization = `Bearer ${token}`

    auth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('middleware admin', () => {
  let res, next

  beforeEach(() => {
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    next = jest.fn()
  })

  test('autorise un utilisateur admin', () => {
    admin({ user: { role: 'admin' } }, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  test('refuse un utilisateur non-admin', () => {
    admin({ user: { role: 'user' } }, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ message: 'Accès réservé aux administrateurs.' })
    expect(next).not.toHaveBeenCalled()
  })

  test('refuse une requête sans user attaché', () => {
    admin({ user: undefined }, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('generateToken', () => {
  test('génère un token JWT décodable', () => {
    const jwt = require('jsonwebtoken')
    const payload = { id: 1, role: 'user', email: 'x@x.com', nom: 'X' }
    const token = generateToken(payload)
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    expect(decoded.id).toBe(1)
    expect(decoded.role).toBe('user')
  })

  test('le token expire selon JWT_EXPIRES_IN', () => {
    const jwt = require('jsonwebtoken')
    const token = generateToken({ id: 1 })
    const decoded = jwt.decode(token)
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })
})
