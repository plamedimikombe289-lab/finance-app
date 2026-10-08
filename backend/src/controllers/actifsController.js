const { pool } = require('../database/db');

const TYPES_VALIDES = ['compte_bancaire','investissement','immobilier','vehicule','autre'];

const listerActifs = async (req, res, next) => {
  try {
    const [actifs] = await pool.execute(
      'SELECT * FROM actifs WHERE user_id = ? AND actif = 1 ORDER BY type ASC, valeur DESC',
      [req.user.id]
    );
    const total = actifs.reduce((s, a) => s + parseFloat(a.valeur), 0);
    res.json({ actifs, total_actifs: Math.round(total * 100) / 100 });
  } catch (err) { next(err); }
};

const creerActif = async (req, res, next) => {
  try {
    const { nom, type = 'autre', valeur, date_maj } = req.body;
    if (!nom?.trim())                              return res.status(400).json({ message: 'Le nom est obligatoire.' });
    if (valeur == null || isNaN(valeur) || parseFloat(valeur) < 0)
                                                   return res.status(400).json({ message: 'Valeur invalide (doit être ≥ 0).' });
    if (!TYPES_VALIDES.includes(type))             return res.status(400).json({ message: 'Type invalide.' });

    const [result] = await pool.execute(
      'INSERT INTO actifs (user_id, nom, type, valeur, date_maj) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, nom.trim(), type, parseFloat(valeur), date_maj || new Date().toISOString().slice(0, 10)]
    );
    const [rows] = await pool.execute('SELECT * FROM actifs WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const modifierActif = async (req, res, next) => {
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM actifs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing[0]) return res.status(404).json({ message: 'Actif introuvable.' });

    const { nom, type, valeur, date_maj } = req.body;
    if (type && !TYPES_VALIDES.includes(type)) return res.status(400).json({ message: 'Type invalide.' });

    await pool.execute(`
      UPDATE actifs SET
        nom      = COALESCE(?, nom),
        type     = COALESCE(?, type),
        valeur   = COALESCE(?, valeur),
        date_maj = COALESCE(?, date_maj)
      WHERE id = ?
    `, [
      nom?.trim() || null,
      type        || null,
      valeur != null ? parseFloat(valeur) : null,
      date_maj    || null,
      req.params.id,
    ]);
    const [rows] = await pool.execute('SELECT * FROM actifs WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const supprimerActif = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM actifs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Actif introuvable.' });
    await pool.execute('UPDATE actifs SET actif = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Actif supprimé.' });
  } catch (err) { next(err); }
};

module.exports = { listerActifs, creerActif, modifierActif, supprimerActif };
