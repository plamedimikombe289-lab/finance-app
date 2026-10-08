const { pool } = require('../database/db');

const listerCorbeille = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Auto-purge items deleted more than 30 days ago (without balance reversal — they're just removed)
    // For depenses in trash over 30 days: restore balances then delete
    const [oldDep] = await pool.execute(
      'SELECT * FROM depenses WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
      [userId]
    );
    for (const d of oldDep) {
      if (d.categorie_id) {
        await pool.execute(
          'UPDATE soldes_categories SET solde = solde + ?, updated_at = NOW() WHERE categorie_id = ?',
          [d.montant, d.categorie_id]
        );
      }
      if (d.compte_id) {
        await pool.execute('UPDATE comptes SET solde = solde + ? WHERE id = ?', [parseFloat(d.montant), d.compte_id]);
      }
      await pool.execute('DELETE FROM depenses WHERE id = ?', [d.id]);
    }

    // For revenus in trash over 30 days: reverse repartitions then delete
    const [oldRev] = await pool.execute(
      'SELECT * FROM revenus WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)',
      [userId]
    );
    const { annulerRepartition } = require('../services/repartitionService');
    for (const r of oldRev) {
      if (r.compte_id) {
        await pool.execute('UPDATE comptes SET solde = solde - ? WHERE id = ?', [r.montant, r.compte_id]);
      }
      await annulerRepartition(r.id, null);
      await pool.execute('DELETE FROM revenus WHERE id = ?', [r.id]);
    }

    // Fetch remaining items in trash
    const [depenses] = await pool.execute(
      `SELECT d.id, 'depense' AS type, d.montant, d.commentaire, d.date, d.deleted_at,
              c.nom AS categorie_nom, c.icone, c.couleur
       FROM depenses d
       LEFT JOIN categories c ON c.id = d.categorie_id
       WHERE d.user_id = ? AND d.deleted_at IS NOT NULL
       ORDER BY d.deleted_at DESC`,
      [userId]
    );

    const [revenus] = await pool.execute(
      `SELECT id, 'revenu' AS type, montant, commentaire, date, deleted_at, type AS sous_type, source
       FROM revenus
       WHERE user_id = ? AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [userId]
    );

    res.json({
      items: [...depenses, ...revenus].sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at)),
      purges: oldDep.length + oldRev.length,
    });
  } catch (err) { next(err); }
};

module.exports = { listerCorbeille };
