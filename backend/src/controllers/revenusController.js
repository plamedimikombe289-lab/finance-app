const { pool, transaction } = require('../database/db');
const { repartirRevenu, annulerRepartition } = require('../services/repartitionService');
const { notifier } = require('../services/emailService');

const listerRevenus = async (req, res, next) => {
  try {
    const { page = 1, limite = 20, type, q, date_debut, date_fin, montant_min, montant_max } = req.query;
    const userId = req.user.id;
    const lim    = Math.min(Math.max(parseInt(limite) || 20, 1), 100);
    const pg     = Math.max(parseInt(page) || 1, 1);
    const offset = (pg - 1) * lim;

    const conditions = ['user_id = ?', 'deleted_at IS NULL'];
    const params     = [userId];
    if (type)       { conditions.push('type = ?');              params.push(type); }
    if (q?.trim())  { conditions.push('commentaire LIKE ?');    params.push(`%${q.trim()}%`); }
    if (date_debut) { conditions.push('DATE(date) >= ?');       params.push(date_debut); }
    if (date_fin)   { conditions.push('DATE(date) <= ?');       params.push(date_fin); }
    if (montant_min){ conditions.push('montant >= ?');          params.push(parseFloat(montant_min)); }
    if (montant_max){ conditions.push('montant <= ?');          params.push(parseFloat(montant_max)); }
    const where = 'WHERE ' + conditions.join(' AND ');

    const [revenus] = await pool.execute(
      `SELECT id, montant, commentaire, type, source, date FROM revenus ${where} ORDER BY date DESC LIMIT ? OFFSET ?`,
      [...params, lim, offset]
    );
    const [countRows] = await pool.execute(`SELECT COUNT(*) as n FROM revenus ${where}`, params);

    res.json({ revenus, total: countRows[0].n, page: pg });
  } catch (err) { next(err); }
};

const creerRevenu = async (req, res, next) => {
  try {
    const { montant, commentaire, type = 'salaire', source, date, compte_id } = req.body;
    const userId = req.user.id;

    if (!montant || isNaN(montant) || parseFloat(montant) <= 0)
      return res.status(400).json({ message: 'Montant invalide (doit être > 0).' });
    if (!commentaire?.trim())
      return res.status(400).json({ message: 'Le commentaire est obligatoire.' });

    const compteId = compte_id ? parseInt(compte_id) : null;

    let revenuId;
    await transaction(async (conn) => {
      const [result] = await conn.execute(
        'INSERT INTO revenus (user_id, montant, commentaire, type, source, date, compte_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, parseFloat(montant), commentaire.trim(), type, source?.trim() || null, date || new Date(), compteId]
      );
      revenuId = result.insertId;
      await repartirRevenu(revenuId, parseFloat(montant), userId, conn);
      if (compteId) {
        await conn.execute(
          'UPDATE comptes SET solde = solde + ? WHERE id = ? AND user_id = ?',
          [parseFloat(montant), compteId, userId]
        );
      }
    });

    const [rows] = await pool.execute('SELECT * FROM revenus WHERE id = ?', [revenuId]);
    notifier(pool, userId, 'revenu_ajoute');
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const obtenirRevenu = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM revenus WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Revenu introuvable.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const supprimerRevenu = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM revenus WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Revenu introuvable.' });
    await pool.execute('UPDATE revenus SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ message: 'Revenu déplacé dans la corbeille.' });
  } catch (err) { next(err); }
};

const restaurerRevenu = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM revenus WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Revenu introuvable dans la corbeille.' });
    await pool.execute('UPDATE revenus SET deleted_at = NULL WHERE id = ?', [req.params.id]);
    res.json({ message: 'Revenu restauré.' });
  } catch (err) { next(err); }
};

const supprimerRevenuDefinitif = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM revenus WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Revenu introuvable dans la corbeille.' });

    const userId = req.user.id;
    await transaction(async (conn) => {
      if (rows[0].compte_id) {
        await conn.execute(
          'UPDATE comptes SET solde = solde - ? WHERE id = ?',
          [rows[0].montant, rows[0].compte_id]
        );
      }
      await annulerRepartition(req.params.id, conn);
      await conn.execute('DELETE FROM revenus WHERE id = ?', [req.params.id]);
    });
    notifier(pool, userId, 'revenu_supprime');
    res.json({ message: 'Revenu supprimé définitivement.' });
  } catch (err) { next(err); }
};

const redistribuerTout = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [revenus] = await pool.execute(
      'SELECT id, montant FROM revenus WHERE user_id = ? AND deleted_at IS NULL ORDER BY date ASC',
      [userId]
    );
    if (revenus.length === 0)
      return res.json({ message: 'Aucun revenu à redistribuer.', nb: 0 });

    await transaction(async (conn) => {
      for (const r of revenus) {
        await annulerRepartition(r.id, conn);
        await conn.execute('DELETE FROM repartitions WHERE revenu_id = ?', [r.id]);
        await repartirRevenu(r.id, parseFloat(r.montant), userId, conn);
      }
    });

    res.json({ message: `${revenus.length} revenu(s) redistribué(s) avec les catégories actuelles.`, nb: revenus.length });
  } catch (err) { next(err); }
};

module.exports = { listerRevenus, creerRevenu, obtenirRevenu, supprimerRevenu, restaurerRevenu, supprimerRevenuDefinitif, redistribuerTout };
