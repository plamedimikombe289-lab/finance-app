const { pool, transaction } = require('../database/db');

const listerCategories = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [categories] = await pool.execute(`
      SELECT c.*, COALESCE(s.solde, 0) as solde, COALESCE(s.est_paye, 0) as est_paye,
             COALESCE(dm.depenses_mois, 0) as depenses_mois
      FROM categories c
      LEFT JOIN soldes_categories s ON s.categorie_id = c.id
      LEFT JOIN (
        SELECT categorie_id, SUM(montant) as depenses_mois
        FROM depenses
        WHERE MONTH(date) = MONTH(CURDATE())
          AND YEAR(date) = YEAR(CURDATE())
          AND deleted_at IS NULL
        GROUP BY categorie_id
      ) dm ON dm.categorie_id = c.id
      WHERE c.actif = 1 AND c.user_id = ?
      ORDER BY c.ordre ASC
    `, [userId]);
    const totalSoldes = categories.reduce((sum, c) => sum + parseFloat(c.solde), 0);
    res.json({ categories, total_soldes: Math.round(totalSoldes * 100) / 100 });
  } catch (err) { next(err); }
};

const creerCategorie = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { nom, type, valeur, couleur = '#6366f1', icone = '💰', ordre = 0, seuil_alerte = null, objectif = null, plafond_mensuel = null } = req.body;

    if (!nom?.trim())                              return res.status(400).json({ message: 'Le nom est obligatoire.' });
    if (!['pourcentage','fixe'].includes(type))    return res.status(400).json({ message: 'Type invalide (pourcentage | fixe).' });
    if (valeur === undefined || isNaN(valeur) || valeur < 0) return res.status(400).json({ message: 'Valeur invalide (>= 0).' });
    if (type === 'pourcentage' && parseFloat(valeur) > 100)  return res.status(400).json({ message: 'Pourcentage max 100.' });

    const [result] = await pool.execute(
      'INSERT INTO categories (user_id, nom, type, valeur, couleur, icone, ordre, seuil_alerte, objectif, plafond_mensuel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, nom.trim(), type, parseFloat(valeur), couleur, icone, parseInt(ordre),
       seuil_alerte     != null ? parseFloat(seuil_alerte)     : null,
       objectif         != null ? parseFloat(objectif)         : null,
       plafond_mensuel  != null ? parseFloat(plafond_mensuel)  : null]
    );
    const [rows] = await pool.execute('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const modifierCategorie = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [existing] = await pool.execute(
      'SELECT * FROM categories WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    if (!existing[0]) return res.status(404).json({ message: 'Catégorie introuvable.' });

    const { nom, type, valeur, couleur, icone, ordre, seuil_alerte, objectif, plafond_mensuel } = req.body;
    const cat = existing[0];

    if (type && !['pourcentage','fixe'].includes(type)) return res.status(400).json({ message: 'Type invalide.' });
    if (valeur !== undefined && parseFloat(valeur) < 0) return res.status(400).json({ message: 'Valeur invalide.' });
    if ((type || cat.type) === 'pourcentage' && valeur > 100) return res.status(400).json({ message: 'Pourcentage max 100.' });

    await pool.execute(`
      UPDATE categories SET
        nom             = COALESCE(?, nom),
        type            = COALESCE(?, type),
        valeur          = COALESCE(?, valeur),
        couleur         = COALESCE(?, couleur),
        icone           = COALESCE(?, icone),
        ordre           = COALESCE(?, ordre),
        seuil_alerte    = ?,
        objectif        = ?,
        plafond_mensuel = ?
      WHERE id = ?
    `, [
      nom?.trim()||null, type||null,
      valeur  != null ? parseFloat(valeur)  : null,
      couleur || null, icone || null,
      ordre   != null ? parseInt(ordre)     : null,
      seuil_alerte    !== undefined ? (seuil_alerte    != null ? parseFloat(seuil_alerte)    : null) : cat.seuil_alerte,
      objectif        !== undefined ? (objectif        != null ? parseFloat(objectif)        : null) : cat.objectif,
      plafond_mensuel !== undefined ? (plafond_mensuel != null ? parseFloat(plafond_mensuel) : null) : cat.plafond_mensuel,
      req.params.id
    ]);

    const [rows] = await pool.execute('SELECT *, COALESCE((SELECT solde FROM soldes_categories WHERE categorie_id = categories.id), 0) as solde FROM categories WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const supprimerCategorie = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM categories WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Catégorie introuvable.' });
    await pool.execute('UPDATE categories SET actif = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Catégorie désactivée.' });
  } catch (err) { next(err); }
};

const ajusterSolde = async (req, res, next) => {
  try {
    const { montant, operation = 'set' } = req.body;
    if (montant === undefined || isNaN(montant)) return res.status(400).json({ message: 'Montant invalide.' });

    const [rows] = await pool.execute(
      'SELECT id FROM categories WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Catégorie introuvable.' });

    const val = parseFloat(montant);
    if (operation === 'set') {
      await pool.execute(
        'INSERT INTO soldes_categories (categorie_id, solde) VALUES (?, ?) ON DUPLICATE KEY UPDATE solde = VALUES(solde), updated_at = NOW()',
        [req.params.id, val]
      );
    } else if (operation === 'add') {
      await pool.execute(
        'INSERT INTO soldes_categories (categorie_id, solde) VALUES (?, ?) ON DUPLICATE KEY UPDATE solde = solde + VALUES(solde), updated_at = NOW()',
        [req.params.id, val]
      );
    } else {
      return res.status(400).json({ message: 'Opération invalide (set | add).' });
    }

    const [soldeRows] = await pool.execute(
      'SELECT solde FROM soldes_categories WHERE categorie_id = ?', [req.params.id]
    );
    res.json({ categorie_id: parseInt(req.params.id), solde: soldeRows[0]?.solde || val });
  } catch (err) { next(err); }
};

const virerSolde = async (req, res, next) => {
  try {
    const { from_id, to_id, montant, commentaire } = req.body;
    const userId = req.user.id;
    const m = parseFloat(montant);

    if (!from_id || !to_id || !m || m <= 0) return res.status(400).json({ message: 'Données invalides.' });
    if (parseInt(from_id) === parseInt(to_id)) return res.status(400).json({ message: 'Source et destination identiques.' });

    const [cats] = await pool.execute(
      'SELECT id FROM categories WHERE id IN (?, ?) AND user_id = ? AND actif = 1',
      [from_id, to_id, userId]
    );
    if (cats.length < 2) return res.status(404).json({ message: 'Catégorie introuvable.' });

    const [soldeRow] = await pool.execute(
      'SELECT COALESCE(solde, 0) as solde FROM soldes_categories WHERE categorie_id = ?', [from_id]
    );
    const soldeActuel = parseFloat(soldeRow[0]?.solde || 0);
    if (soldeActuel < m) return res.status(400).json({ message: `Solde insuffisant (${soldeActuel.toFixed(2)}).` });

    await transaction(async (conn) => {
      await conn.execute(
        'UPDATE soldes_categories SET solde = solde - ?, updated_at = NOW() WHERE categorie_id = ?',
        [m, from_id]
      );
      await conn.execute(
        'INSERT INTO soldes_categories (categorie_id, solde) VALUES (?, ?) ON DUPLICATE KEY UPDATE solde = solde + VALUES(solde), updated_at = NOW()',
        [to_id, m]
      );
      await conn.execute(
        'INSERT INTO virements_categories (user_id, from_categorie_id, to_categorie_id, montant, commentaire) VALUES (?, ?, ?, ?, ?)',
        [userId, from_id, to_id, m, commentaire || null]
      );
    });

    res.json({ message: 'Virement effectué.' });
  } catch (err) { next(err); }
};

module.exports = { listerCategories, creerCategorie, modifierCategorie, supprimerCategorie, ajusterSolde, virerSolde };
