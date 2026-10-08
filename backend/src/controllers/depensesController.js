const { pool, transaction } = require('../database/db');
const path = require('path');
const fs   = require('fs');
const jwt  = require('jsonwebtoken');
const { notifier } = require('../services/emailService');

pool.execute(`ALTER TABLE soldes_categories ADD COLUMN IF NOT EXISTS est_paye TINYINT(1) NOT NULL DEFAULT 0`)
  .catch(err => console.error('[soldes_categories] alter est_paye error:', err.message));

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/depenses');
const SECRET     = process.env.JWT_SECRET || 'finance_jwt_secret_change_in_production_2024';

function deleteFile(filename) {
  if (!filename) return;
  try { fs.unlinkSync(path.join(UPLOAD_DIR, filename)); } catch {}
}

const listerDepenses = async (req, res, next) => {
  try {
    const { page = 1, limite = 20, categorie_id, q, date_debut, date_fin, montant_min, montant_max } = req.query;
    const userId = req.user.id;
    const lim    = Math.min(Math.max(parseInt(limite) || 20, 1), 100);
    const pg     = Math.max(parseInt(page) || 1, 1);
    const offset = (pg - 1) * lim;

    const conditions = ['d.user_id = ?', 'd.deleted_at IS NULL'];
    const params     = [userId];
    if (categorie_id)  { conditions.push('d.categorie_id = ?');        params.push(parseInt(categorie_id)); }
    if (q?.trim())     { conditions.push('d.commentaire LIKE ?');       params.push(`%${q.trim()}%`); }
    if (date_debut)    { conditions.push('DATE(d.date) >= ?');          params.push(date_debut); }
    if (date_fin)      { conditions.push('DATE(d.date) <= ?');          params.push(date_fin); }
    if (montant_min)   { conditions.push('d.montant >= ?');             params.push(parseFloat(montant_min)); }
    if (montant_max)   { conditions.push('d.montant <= ?');             params.push(parseFloat(montant_max)); }
    const where = 'WHERE ' + conditions.join(' AND ');

    const [depenses] = await pool.execute(`
      SELECT d.id, d.montant, d.commentaire, d.date, d.fichier_nom, d.fichier_stocke,
             d.is_deductible, d.deductible_pct, d.categorie_fiscale, d.compte_id,
             c.nom as categorie_nom, c.couleur, c.icone
      FROM depenses d
      LEFT JOIN categories c ON c.id = d.categorie_id
      ${where}
      ORDER BY d.date DESC
      LIMIT ? OFFSET ?
    `, [...params, lim, offset]);

    const [countRows]  = await pool.execute(`SELECT COUNT(*) as n FROM depenses d ${where}`, params);
    const [montantRow] = await pool.execute(`SELECT COALESCE(SUM(montant),0) as s FROM depenses d ${where}`, params);

    res.json({
      depenses,
      total:         countRows[0].n,
      total_montant: Math.round(parseFloat(montantRow[0].s) * 100) / 100,
      page:          pg
    });
  } catch (err) { next(err); }
};

const creerDepense = async (req, res, next) => {
  const fichierStocke = req.file?.filename    || null;
  const fichierNom    = req.file?.originalname || null;

  try {
    const { categorie_id, montant, commentaire, date, compte_id,
            is_deductible, deductible_pct, categorie_fiscale, type_retrait } = req.body;
    const userId = req.user.id;

    if (!montant || isNaN(montant) || parseFloat(montant) <= 0) {
      deleteFile(fichierStocke);
      return res.status(400).json({ message: 'Montant invalide (doit être > 0).' });
    }
    if (!commentaire?.trim()) {
      deleteFile(fichierStocke);
      return res.status(400).json({ message: 'Le commentaire est obligatoire.' });
    }

    const compteId    = compte_id ? parseInt(compte_id) : null;
    const deductible  = is_deductible ? 1 : 0;
    const pctDed      = deductible_pct != null ? parseFloat(deductible_pct) : 100;
    const catFiscale  = categorie_fiscale?.trim() || null;

    let insertId;

    if (categorie_id) {
      const [catRows] = await pool.execute(
        'SELECT * FROM categories WHERE id = ? AND actif = 1 AND user_id = ?',
        [categorie_id, userId]
      );
      if (!catRows[0]) {
        deleteFile(fichierStocke);
        return res.status(404).json({ message: 'Catégorie introuvable.' });
      }

      const [soldeRows] = await pool.execute(
        'SELECT COALESCE(solde, 0) as solde FROM soldes_categories WHERE categorie_id = ?',
        [categorie_id]
      );
      const soldeActuel = parseFloat(soldeRows[0]?.solde || 0);

      if (parseFloat(montant) > soldeActuel) {
        deleteFile(fichierStocke);
        return res.status(400).json({ message: `Solde insuffisant dans "${catRows[0].nom}". Disponible : ${soldeActuel}.` });
      }

      await transaction(async (conn) => {
        const [r] = await conn.execute(
          `INSERT INTO depenses
            (user_id, categorie_id, montant, commentaire, date, fichier_nom, fichier_stocke,
             is_deductible, deductible_pct, categorie_fiscale, compte_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, categorie_id, parseFloat(montant), commentaire.trim(), date || new Date(),
           fichierNom, fichierStocke, deductible, pctDed, catFiscale, compteId]
        );
        insertId = r.insertId;
        await conn.execute(
          'UPDATE soldes_categories SET solde = solde - ?, updated_at = NOW() WHERE categorie_id = ?',
          [parseFloat(montant), categorie_id]
        );
        // Marquer l'enveloppe comme "facture payée" si demandé explicitement
        if (type_retrait === 'paiement_facture' && catRows[0].plafond_mensuel != null) {
          await conn.execute(
            'UPDATE soldes_categories SET est_paye = 1 WHERE categorie_id = ?',
            [categorie_id]
          );
        }
        if (compteId) {
          await conn.execute(
            'UPDATE comptes SET solde = solde - ? WHERE id = ? AND user_id = ?',
            [parseFloat(montant), compteId, userId]
          );
        }
      });
    } else {
      await transaction(async (conn) => {
        const [r] = await conn.execute(
          `INSERT INTO depenses
            (user_id, categorie_id, montant, commentaire, date, fichier_nom, fichier_stocke,
             is_deductible, deductible_pct, categorie_fiscale, compte_id)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, parseFloat(montant), commentaire.trim(), date || new Date(),
           fichierNom, fichierStocke, deductible, pctDed, catFiscale, compteId]
        );
        insertId = r.insertId;
        if (compteId) {
          await conn.execute(
            'UPDATE comptes SET solde = solde - ? WHERE id = ? AND user_id = ?',
            [parseFloat(montant), compteId, userId]
          );
        }
      });
    }

    const [rows] = await pool.execute(
      'SELECT d.*, c.nom as categorie_nom, c.couleur, c.icone FROM depenses d LEFT JOIN categories c ON c.id = d.categorie_id WHERE d.id = ?',
      [insertId]
    );
    notifier(pool, userId, 'depense_ajoutee');
    res.status(201).json(rows[0]);
  } catch (err) {
    deleteFile(fichierStocke);
    next(err);
  }
};

const supprimerDepense = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM depenses WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Dépense introuvable.' });
    await pool.execute('UPDATE depenses SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ message: 'Dépense déplacée dans la corbeille.' });
  } catch (err) { next(err); }
};

const restaurerDepense = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM depenses WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Dépense introuvable dans la corbeille.' });
    await pool.execute('UPDATE depenses SET deleted_at = NULL WHERE id = ?', [req.params.id]);
    res.json({ message: 'Dépense restaurée.' });
  } catch (err) { next(err); }
};

const supprimerDepenseDefinitif = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM depenses WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Dépense introuvable dans la corbeille.' });

    await transaction(async (conn) => {
      if (rows[0].categorie_id) {
        await conn.execute(
          'UPDATE soldes_categories SET solde = solde + ?, est_paye = 0, updated_at = NOW() WHERE categorie_id = ?',
          [rows[0].montant, rows[0].categorie_id]
        );
      }
      if (rows[0].compte_id) {
        await conn.execute(
          'UPDATE comptes SET solde = solde + ? WHERE id = ?',
          [parseFloat(rows[0].montant), rows[0].compte_id]
        );
      }
      await conn.execute('DELETE FROM depenses WHERE id = ?', [req.params.id]);
    });

    deleteFile(rows[0].fichier_stocke);
    notifier(pool, req.user.id, 'depense_supprimee');
    res.json({ message: 'Dépense supprimée définitivement.' });
  } catch (err) { next(err); }
};

const getFichier = async (req, res, next) => {
  try {
    // Accept token from Authorization header OR ?token= query param (for window.open)
    let userId;
    const header = req.headers.authorization;
    const tokenStr = header?.startsWith('Bearer ') ? header.slice(7) : req.query.token;
    if (!tokenStr) return res.status(401).json({ message: 'Authentification requise.' });
    try {
      userId = jwt.verify(tokenStr, SECRET).id;
    } catch {
      return res.status(401).json({ message: 'Token invalide ou expiré.' });
    }

    const [rows] = await pool.execute(
      'SELECT fichier_nom, fichier_stocke FROM depenses WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    const dep = rows[0];
    if (!dep)                 return res.status(404).json({ message: 'Dépense introuvable.' });
    if (!dep.fichier_stocke)  return res.status(404).json({ message: 'Aucune pièce jointe pour cette dépense.' });

    const filePath = path.join(UPLOAD_DIR, dep.fichier_stocke);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Fichier introuvable sur le serveur.' });

    const safeName = dep.fichier_nom
      ? dep.fichier_nom.replace(/[^a-zA-Z0-9._\- ]/g, '_')
      : dep.fichier_stocke;

    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.sendFile(filePath);
  } catch (err) { next(err); }
};

const suggererCategorie = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ suggestion: null });
    const userId = req.user.id;
    const term = `%${q.trim()}%`;

    const [rows] = await pool.execute(`
      SELECT d.categorie_id, c.nom, c.couleur, c.icone, COUNT(*) AS freq
      FROM depenses d
      JOIN categories c ON c.id = d.categorie_id
      WHERE d.user_id = ?
        AND d.categorie_id IS NOT NULL
        AND d.commentaire LIKE ?
      GROUP BY d.categorie_id, c.nom, c.couleur, c.icone
      ORDER BY freq DESC
      LIMIT 1
    `, [userId, term]);

    res.json({ suggestion: rows[0] || null });
  } catch (err) { next(err); }
};

module.exports = { listerDepenses, creerDepense, supprimerDepense, restaurerDepense, supprimerDepenseDefinitif, getFichier, suggererCategorie };
