const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'finance_jwt_secret_change_in_production_2024';

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ message: 'Authentification requise.' });

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Token invalide ou expiré.' });
  }
}

function admin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
  next();
}

function generateToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

module.exports = { auth, admin, generateToken };
