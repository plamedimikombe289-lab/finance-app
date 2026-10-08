const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT || '3306'),
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'finance_db',
  waitForConnections: true,
  connectionLimit:  10,
  // Convertit les DECIMAL en nombre JS au lieu de string
  typeCast(field, next) {
    if (field.type === 'DECIMAL' || field.type === 'NEWDECIMAL') {
      return parseFloat(field.string());
    }
    return next();
  }
});

/**
 * Exécute une fonction dans une transaction MySQL atomique.
 * fn reçoit la connexion dédiée pour faire ses requêtes.
 */
async function transaction(fn) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { pool, transaction };
