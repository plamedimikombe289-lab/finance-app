const { pool } = require('../database/db');
const logger   = require('../utils/logger');

const METHOD_ACTION = {
  POST:   'create',
  PUT:    'update',
  PATCH:  'update',
  DELETE: 'delete',
};

// Maps route path prefixes to table names
const PATH_TABLE = {
  '/api/revenus':    'revenus',
  '/api/depenses':   'depenses',
  '/api/dettes':     'dettes',
  '/api/categories': 'categories',
  '/api/comptes':    'comptes',
  '/api/auth':       'users',
};

function resolveTable(path) {
  for (const prefix of Object.keys(PATH_TABLE)) {
    if (path.startsWith(prefix)) return PATH_TABLE[prefix];
  }
  return null;
}

// Write audit log asynchronously (never blocks the response)
async function writeAudit({ userId, action, tableName, recordId, payload, ip }) {
  try {
    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, table_name, record_id, payload, ip) VALUES (?, ?, ?, ?, ?, ?)',
      [userId || null, action, tableName || null, recordId || null,
       payload ? JSON.stringify(payload) : null, ip || null]
    );
  } catch (err) {
    logger.error(`[AUDIT] Failed to write audit log: ${err.message}`);
  }
}

function auditMiddleware(req, res, next) {
  const action = METHOD_ACTION[req.method];
  if (!action) return next(); // skip GET / HEAD / OPTIONS

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    // Only log mutating requests that succeed (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const tableName = resolveTable(req.path);
      const recordId  = body?.id || req.params?.id || null;
      const userId    = req.user?.id || null;
      const ip        = req.ip || req.headers['x-forwarded-for'] || null;

      // Don't log sensitive fields
      const safeBody = req.body ? { ...req.body } : {};
      delete safeBody.password;
      delete safeBody.password_hash;
      delete safeBody.token;

      writeAudit({
        userId,
        action: `${action}_${tableName || 'unknown'}`,
        tableName,
        recordId: parseInt(recordId) || null,
        payload: Object.keys(safeBody).length > 0 ? safeBody : null,
        ip,
      });
    }
    return originalJson(body);
  };

  next();
}

module.exports = { auditMiddleware, writeAudit };
