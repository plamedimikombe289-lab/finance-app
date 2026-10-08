const bcrypt = require('bcryptjs');
const { pool, transaction } = require('../database/db');
const { repartirRevenu, annulerRepartition } = require('../services/repartitionService');
const { generateToken } = require('../middleware/auth');

// ── Statistiques globales ──────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const [[userStats]]  = await pool.execute(`
      SELECT COUNT(*) as total,
        SUM(actif = 1)       as actifs,
        SUM(role = 'admin')  as admins,
        SUM(role = 'user')   as users
      FROM users
    `);
    const [[revStats]]   = await pool.execute(`
      SELECT COALESCE(SUM(montant),0) as total_revenus, COUNT(*) as nb_revenus FROM revenus
    `);
    const [[detteStats]] = await pool.execute(`
      SELECT COALESCE(SUM(montant_restant),0) as total_dettes, COUNT(*) as nb_dettes
      FROM dettes WHERE actif = 1
    `);
    const [[depStats]]   = await pool.execute(`
      SELECT COALESCE(SUM(montant),0) as total_depenses_mois
      FROM depenses WHERE DATE_FORMAT(date,'%Y-%m') = DATE_FORMAT(NOW(),'%Y-%m')
    `);
    res.json({ users: userStats, revenus: revStats, dettes: detteStats, depenses: depStats });
  } catch (err) { next(err); }
};

// ── Liste des utilisateurs ─────────────────────────────────────────────────
const listUsers = async (req, res, next) => {
  try {
    const [users] = await pool.execute(`
      SELECT u.id, u.nom, u.email, u.role, u.actif, u.email_verified, u.created_at,
        COUNT(DISTINCT r.id)                               as nb_revenus,
        COUNT(DISTINCT d.id)                               as nb_dettes,
        COALESCE(SUM(DISTINCT COALESCE(sc.solde,0)),0)     as total_soldes
      FROM users u
      LEFT JOIN revenus   r  ON r.user_id  = u.id
      LEFT JOIN dettes    d  ON d.user_id  = u.id AND d.actif = 1
      LEFT JOIN categories c ON c.user_id  = u.id AND c.actif = 1
      LEFT JOIN soldes_categories sc ON sc.categorie_id = c.id
      GROUP BY u.id ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (err) { next(err); }
};

// ── Détail d'un utilisateur ────────────────────────────────────────────────
const getUserData = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const [[user]] = await pool.execute(
      'SELECT id, nom, email, role, actif, created_at FROM users WHERE id = ?', [userId]
    );
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    const [categories] = await pool.execute(`
      SELECT c.*, COALESCE(s.solde, 0) as solde FROM categories c
      LEFT JOIN soldes_categories s ON s.categorie_id = c.id
      WHERE c.user_id = ? AND c.actif = 1 ORDER BY c.ordre
    `, [userId]);

    const [revenus] = await pool.execute(
      'SELECT * FROM revenus WHERE user_id = ? ORDER BY date DESC LIMIT 30', [userId]
    );

    const [dettes] = await pool.execute(`
      SELECT *, ROUND((montant_total-montant_restant)*100.0/montant_total,1) as progression_pct
      FROM dettes WHERE user_id = ? ORDER BY priorite, montant_restant DESC
    `, [userId]);

    const [depenses] = await pool.execute(`
      SELECT d.*, c.nom as categorie_nom FROM depenses d
      LEFT JOIN categories c ON c.id = d.categorie_id
      WHERE d.user_id = ? ORDER BY d.date DESC LIMIT 30
    `, [userId]);

    const totalSoldes = categories.reduce((s, c) => s + parseFloat(c.solde), 0);
    const totalDettes = dettes.filter(d => d.actif).reduce((s, d) => s + parseFloat(d.montant_restant), 0);

    res.json({
      user,
      categories,
      revenus,
      dettes,
      depenses,
      resume: {
        total_soldes:  Math.round(totalSoldes * 100) / 100,
        total_dettes:  Math.round(totalDettes * 100) / 100,
        nb_revenus:    revenus.length,
        nb_dettes_actives: dettes.filter(d => d.actif).length,
      }
    });
  } catch (err) { next(err); }
};

// ── Modifier un utilisateur ────────────────────────────────────────────────
const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const [[existing]] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (!existing) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    const { nom, email, role, actif, new_password } = req.body;
    if (role && !['admin','user'].includes(role))
      return res.status(400).json({ message: 'Rôle invalide.' });

    let passwordSet = '';
    const params = [];
    if (new_password && new_password.length >= 6) {
      const hash = await bcrypt.hash(new_password, 10);
      passwordSet = ', password_hash = ?';
      params.push(hash);
    }

    await pool.execute(`
      UPDATE users SET
        nom    = COALESCE(?, nom),
        email  = COALESCE(?, email),
        role   = COALESCE(?, role),
        actif  = COALESCE(?, actif)
        ${passwordSet}
      WHERE id = ?
    `, [nom?.trim()||null, email?.toLowerCase()||null, role||null,
        actif != null ? parseInt(actif) : null, ...params, userId]);

    const [[rows]] = await pool.execute('SELECT id, nom, email, role, actif FROM users WHERE id = ?', [userId]);
    res.json(rows);
  } catch (err) { next(err); }
};

// ── Désactiver un utilisateur ──────────────────────────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (parseInt(userId) === req.user.id)
      return res.status(400).json({ message: 'Impossible de désactiver son propre compte.' });
    const [[rows]] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (!rows) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    await pool.execute('UPDATE users SET actif = 0 WHERE id = ?', [userId]);
    res.json({ message: 'Compte désactivé.' });
  } catch (err) { next(err); }
};

// ── Corriger un revenu (avec redistribution) ──────────────────────────────
const patchUserRevenu = async (req, res, next) => {
  try {
    const { userId, revenuId } = req.params;
    const [[revenu]] = await pool.execute(
      'SELECT * FROM revenus WHERE id = ? AND user_id = ?', [revenuId, userId]
    );
    if (!revenu) return res.status(404).json({ message: 'Revenu introuvable.' });

    const { montant, commentaire, type } = req.body;

    await transaction(async (conn) => {
      await annulerRepartition(revenuId, conn);
      await conn.execute('DELETE FROM repartitions WHERE revenu_id = ?', [revenuId]);

      await conn.execute(`
        UPDATE revenus SET
          montant     = COALESCE(?, montant),
          commentaire = COALESCE(?, commentaire),
          type        = COALESCE(?, type)
        WHERE id = ?
      `, [montant ? parseFloat(montant) : null, commentaire?.trim()||null, type||null, revenuId]);

      const newMontant = montant ? parseFloat(montant) : parseFloat(revenu.montant);
      await repartirRevenu(revenuId, newMontant, userId, conn);
    });

    const [[updated]] = await pool.execute('SELECT * FROM revenus WHERE id = ?', [revenuId]);
    res.json({ message: 'Revenu corrigé et redistribué.', revenu: updated });
  } catch (err) { next(err); }
};

// ── Supprimer un revenu d'un utilisateur ──────────────────────────────────
const deleteUserRevenu = async (req, res, next) => {
  try {
    const { userId, revenuId } = req.params;
    const [[revenu]] = await pool.execute(
      'SELECT * FROM revenus WHERE id = ? AND user_id = ?', [revenuId, userId]
    );
    if (!revenu) return res.status(404).json({ message: 'Revenu introuvable.' });

    await transaction(async (conn) => {
      await annulerRepartition(revenuId, conn);
      await conn.execute('DELETE FROM revenus WHERE id = ?', [revenuId]);
    });
    res.json({ message: 'Revenu supprimé par l\'admin.' });
  } catch (err) { next(err); }
};

// ── Corriger une dette ─────────────────────────────────────────────────────
const patchUserDette = async (req, res, next) => {
  try {
    const { userId, detteId } = req.params;
    const [[existing]] = await pool.execute(
      'SELECT id FROM dettes WHERE id = ? AND user_id = ?', [detteId, userId]
    );
    if (!existing) return res.status(404).json({ message: 'Dette introuvable.' });

    const { nom, type, montant_total, montant_restant, paiement_minimum, priorite } = req.body;

    await pool.execute(`
      UPDATE dettes SET
        nom              = COALESCE(?, nom),
        type             = COALESCE(?, type),
        montant_total    = COALESCE(?, montant_total),
        montant_restant  = COALESCE(?, montant_restant),
        paiement_minimum = COALESCE(?, paiement_minimum),
        priorite         = COALESCE(?, priorite)
      WHERE id = ?
    `, [nom?.trim()||null, type||null,
        montant_total    != null ? parseFloat(montant_total)    : null,
        montant_restant  != null ? parseFloat(montant_restant)  : null,
        paiement_minimum != null ? parseFloat(paiement_minimum) : null,
        priorite         != null ? parseInt(priorite)           : null,
        detteId]);

    const [[rows]] = await pool.execute('SELECT * FROM dettes WHERE id = ?', [detteId]);
    res.json(rows);
  } catch (err) { next(err); }
};

const impersonateUser = async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.userId);
    if (targetId === req.user.id)
      return res.status(400).json({ message: 'Impossible de vous impersonifier vous-même.' });

    const [rows] = await pool.execute(
      'SELECT id, nom, email, role, actif, devise, onboarding_complete FROM users WHERE id = ?',
      [targetId]
    );
    if (!rows[0])        return res.status(404).json({ message: 'Utilisateur introuvable.' });
    if (!rows[0].actif)  return res.status(403).json({ message: 'Compte désactivé.' });

    // Traçabilité : qui a impersonifié qui
    pool.execute(
      'INSERT INTO audit_logs (user_id, action, table_name, record_id, ip) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'admin_impersonate', 'users', rows[0].id, req.ip]
    ).catch(() => {});

    const token = generateToken({
      id:    rows[0].id,
      nom:   rows[0].nom,
      email: rows[0].email,
      role:  rows[0].role,
    });
    res.json({ user: rows[0], token });
  } catch (err) { next(err); }
};

const verifyUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.execute('SELECT id, nom, email FROM users WHERE id = ?', [userId]);
    if (!rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    await pool.execute(
      'UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [userId]
    );
    res.json({ message: 'Compte vérifié manuellement.' });
  } catch (err) { next(err); }
};

module.exports = {
  getStats, listUsers, getUserData,
  updateUser, deleteUser,
  patchUserRevenu, deleteUserRevenu,
  patchUserDette,
  impersonateUser,
  verifyUser,
};
