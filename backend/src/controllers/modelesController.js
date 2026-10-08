const { pool, transaction } = require('../database/db');
const { repartirRevenu } = require('../services/repartitionService');

const listerModeles = async (req, res, next) => {
  try {
    const [modeles] = await pool.execute(
      'SELECT * FROM modeles_revenus WHERE user_id = ? AND actif = 1 ORDER BY prochaine_date ASC',
      [req.user.id]
    );
    res.json({ modeles });
  } catch (err) { next(err); }
};

const creerModele = async (req, res, next) => {
  try {
    const { montant, commentaire, type = 'salaire', recurrence = 'mensuel', prochaine_date } = req.body;
    const userId = req.user.id;

    if (!montant || isNaN(montant) || parseFloat(montant) <= 0)
      return res.status(400).json({ message: 'Montant invalide.' });
    if (!commentaire?.trim())
      return res.status(400).json({ message: 'Le commentaire est obligatoire.' });
    if (!prochaine_date)
      return res.status(400).json({ message: 'La date de prochaine occurrence est obligatoire.' });
    if (!['mensuel','bi-mensuel','hebdomadaire'].includes(recurrence))
      return res.status(400).json({ message: 'Récurrence invalide.' });

    const [result] = await pool.execute(
      'INSERT INTO modeles_revenus (user_id, montant, commentaire, type, recurrence, prochaine_date) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, parseFloat(montant), commentaire.trim(), type, recurrence, prochaine_date]
    );
    const [rows] = await pool.execute('SELECT * FROM modeles_revenus WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const utiliserModele = async (req, res, next) => {
  try {
    const [modeles] = await pool.execute(
      'SELECT * FROM modeles_revenus WHERE id = ? AND user_id = ? AND actif = 1',
      [req.params.id, req.user.id]
    );
    const modele = modeles[0];
    if (!modele) return res.status(404).json({ message: 'Modèle introuvable.' });

    let revenuId;
    await transaction(async (conn) => {
      const [result] = await conn.execute(
        'INSERT INTO revenus (user_id, montant, commentaire, type, date) VALUES (?, ?, ?, ?, NOW())',
        [req.user.id, modele.montant, modele.commentaire, modele.type]
      );
      revenuId = result.insertId;
      await repartirRevenu(revenuId, parseFloat(modele.montant), req.user.id, conn);

      const next = new Date(modele.prochaine_date);
      if (modele.recurrence === 'mensuel')       next.setMonth(next.getMonth() + 1);
      else if (modele.recurrence === 'bi-mensuel') next.setDate(next.getDate() + 15);
      else                                          next.setDate(next.getDate() + 7);

      await conn.execute(
        'UPDATE modeles_revenus SET prochaine_date = ? WHERE id = ?',
        [next.toISOString().split('T')[0], modele.id]
      );
    });

    const [revRows] = await pool.execute('SELECT * FROM revenus WHERE id = ?', [revenuId]);
    res.status(201).json({ message: 'Revenu créé et réparti.', revenu: revRows[0] });
  } catch (err) { next(err); }
};

const supprimerModele = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM modeles_revenus WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Modèle introuvable.' });
    await pool.execute('UPDATE modeles_revenus SET actif = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Modèle supprimé.' });
  } catch (err) { next(err); }
};

module.exports = { listerModeles, creerModele, utiliserModele, supprimerModele };
