const { pool, transaction } = require('../database/db');
const { notifier } = require('../services/emailService');

// Crée la table si elle n'existe pas encore
pool.execute(`
  CREATE TABLE IF NOT EXISTS plans_remboursement (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    user_id              INT NOT NULL,
    nom                  VARCHAR(100) NOT NULL DEFAULT 'Mon plan',
    dette_ids            JSON NOT NULL,
    date_cible           DATE NOT NULL,
    budget_mensuel_custom DECIMAL(10,2) NULL,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`).catch(err => console.error('[plans_remboursement] init error:', err.message));

pool.execute(`ALTER TABLE dettes ADD COLUMN IF NOT EXISTS categorie_id INT NULL`)
  .catch(err => console.error('[dettes] alter categorie_id error:', err.message));

const listerDettes = async (req, res, next) => {
  try {
    const { actif = 1, sens } = req.query;
    const userId = req.user.id;

    const conditions = ['d.actif = ?', 'd.user_id = ?'];
    const params     = [parseInt(actif), userId];
    if (sens) { conditions.push('d.sens = ?'); params.push(sens); }

    const [dettes] = await pool.execute(`
      SELECT d.*,
        ROUND((d.montant_total - d.montant_restant) * 100.0 / d.montant_total, 1) as progression_pct,
        COALESCE((SELECT SUM(montant) FROM paiements_dettes WHERE dette_id = d.id), 0) as total_paye,
        DATEDIFF(d.date_echeance, CURDATE()) as jours_restants,
        c.nom     as compte_nom,
        c.couleur as compte_couleur,
        c.solde   as compte_solde,
        cat.nom    as categorie_nom,
        cat.couleur as categorie_couleur,
        cat.icone   as categorie_icone
      FROM dettes d
      LEFT JOIN comptes c ON c.id = d.compte_id
      LEFT JOIN categories cat ON cat.id = d.categorie_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.priorite ASC, d.date_echeance ASC, d.montant_restant DESC
    `, params);

    const total_restant = dettes.reduce((s, d) => s + parseFloat(d.montant_restant), 0);
    res.json({ dettes, total_restant: Math.round(total_restant * 100) / 100, total_dettes: dettes.length });
  } catch (err) { next(err); }
};

const listerRappels = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rappels] = await pool.execute(`
      SELECT d.*,
        DATEDIFF(d.date_echeance, CURDATE()) as jours_restants,
        ROUND((d.montant_total - d.montant_restant) * 100.0 / d.montant_total, 1) as progression_pct
      FROM dettes d
      WHERE d.actif = 1
        AND d.user_id = ?
        AND d.date_echeance IS NOT NULL
        AND DATEDIFF(d.date_echeance, CURDATE()) <= d.rappel_jours
      ORDER BY d.date_echeance ASC
    `, [userId]);
    res.json({ rappels });
  } catch (err) { next(err); }
};

const obtenirDette = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT *, DATEDIFF(date_echeance, CURDATE()) as jours_restants FROM dettes WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Dette introuvable.' });

    const [paiements] = await pool.execute(`
      SELECT p.*, r.commentaire as revenu_commentaire
      FROM paiements_dettes p
      LEFT JOIN revenus r ON r.id = p.revenu_id
      WHERE p.dette_id = ?
      ORDER BY p.date DESC
    `, [req.params.id]);

    res.json({ dette: rows[0], paiements });
  } catch (err) { next(err); }
};

const creerDette = async (req, res, next) => {
  try {
    const {
      nom, type = 'autre', montant_total, montant_restant,
      paiement_minimum = 0, priorite = 2,
      sens = 'je_dois', date_echeance = null, rappel_jours = 7, taux_interet = null,
      compte_id = null, categorie_id = null,
    } = req.body;
    const userId = req.user.id;

    if (!nom?.trim())                                              return res.status(400).json({ message: 'Le nom est obligatoire.' });
    if (!montant_total || isNaN(montant_total) || montant_total <= 0) return res.status(400).json({ message: 'Montant total invalide.' });
    if (!['je_dois','on_me_doit'].includes(sens))                  return res.status(400).json({ message: 'Sens invalide.' });

    const restant     = montant_restant !== undefined ? parseFloat(montant_restant) : parseFloat(montant_total);
    let compteId      = compte_id ? parseInt(compte_id) : null;
    const categorieId = categorie_id ? parseInt(categorie_id) : null;
    if (restant < 0 || restant > parseFloat(montant_total)) return res.status(400).json({ message: 'Montant restant invalide.' });
    if (![1,2,3].includes(parseInt(priorite)))              return res.status(400).json({ message: 'Priorité invalide (1=haute, 2=moyenne, 3=basse).' });

    let insertId;
    await transaction(async (conn) => {
      const limite      = parseFloat(montant_total);
      const creditDispo = Math.round((limite - restant) * 100) / 100;

      if (sens === 'je_dois') {
        if (type === 'credit' && !compteId) {
          const [cr] = await conn.execute(
            'INSERT INTO comptes (user_id, nom, type, solde, limite, couleur) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, nom.trim(), 'credit', creditDispo, limite, '#ef4444']
          );
          compteId = cr.insertId;
        } else if (compteId) {
          await conn.execute(
            'UPDATE comptes SET solde = ?, limite = ? WHERE id = ? AND user_id = ?',
            [creditDispo, limite, compteId, userId]
          );
        }
      } else if (sens === 'on_me_doit') {
        // Déduire le montant prêté du compte source
        if (compteId) {
          await conn.execute(
            'UPDATE comptes SET solde = solde - ? WHERE id = ? AND user_id = ?',
            [restant, compteId, userId]
          );
        }
        // Déduire le montant prêté de l'enveloppe source
        if (categorieId) {
          await conn.execute(
            'INSERT INTO soldes_categories (categorie_id, solde) VALUES (?, ?) ON DUPLICATE KEY UPDATE solde = solde + VALUES(solde), updated_at = NOW()',
            [categorieId, -restant]
          );
        }
      }

      const [result] = await conn.execute(
        'INSERT INTO dettes (user_id, nom, type, montant_total, montant_restant, paiement_minimum, priorite, sens, date_echeance, rappel_jours, taux_interet, compte_id, categorie_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, nom.trim(), type, limite, restant, parseFloat(paiement_minimum), parseInt(priorite), sens, date_echeance || null, parseInt(rappel_jours), taux_interet != null ? parseFloat(taux_interet) : null, compteId, categorieId]
      );
      insertId = result.insertId;
    });

    const [rows] = await pool.execute('SELECT *, DATEDIFF(date_echeance, CURDATE()) as jours_restants FROM dettes WHERE id = ?', [insertId]);
    notifier(pool, req.user.id, 'dette_ajoutee');
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const modifierDette = async (req, res, next) => {
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM dettes WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing[0]) return res.status(404).json({ message: 'Dette introuvable.' });

    const { nom, type, montant_total, montant_restant, paiement_minimum, priorite, sens, date_echeance, rappel_jours, taux_interet, compte_id, categorie_id } = req.body;
    if (priorite !== undefined && ![1,2,3].includes(parseInt(priorite)))
      return res.status(400).json({ message: 'Priorité invalide.' });
    if (sens !== undefined && !['je_dois','on_me_doit'].includes(sens))
      return res.status(400).json({ message: 'Sens invalide.' });

    await pool.execute(`
      UPDATE dettes SET
        nom              = COALESCE(?, nom),
        type             = COALESCE(?, type),
        montant_total    = COALESCE(?, montant_total),
        montant_restant  = COALESCE(?, montant_restant),
        paiement_minimum = COALESCE(?, paiement_minimum),
        priorite         = COALESCE(?, priorite),
        sens             = COALESCE(?, sens),
        date_echeance    = COALESCE(?, date_echeance),
        rappel_jours     = COALESCE(?, rappel_jours),
        taux_interet     = COALESCE(?, taux_interet),
        compte_id        = COALESCE(?, compte_id),
        categorie_id     = COALESCE(?, categorie_id)
      WHERE id = ?
    `, [
      nom?.trim()||null, type||null,
      montant_total    != null ? parseFloat(montant_total)    : null,
      montant_restant  != null ? parseFloat(montant_restant)  : null,
      paiement_minimum != null ? parseFloat(paiement_minimum) : null,
      priorite         != null ? parseInt(priorite)           : null,
      sens             || null,
      date_echeance    || null,
      rappel_jours     != null ? parseInt(rappel_jours)       : null,
      taux_interet     != null ? parseFloat(taux_interet)     : null,
      compte_id        != null ? parseInt(compte_id)          : null,
      categorie_id     != null ? parseInt(categorie_id)       : null,
      req.params.id
    ]);

    const [rows] = await pool.execute('SELECT *, DATEDIFF(date_echeance, CURDATE()) as jours_restants FROM dettes WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const enregistrerPaiement = async (req, res, next) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM dettes WHERE id = ? AND actif = 1 AND user_id = ?',
      [req.params.id, req.user.id]
    );
    const dette = existing[0];
    if (!dette) return res.status(404).json({ message: 'Dette introuvable.' });

    const { montant, commentaire, revenu_id, date, compte_remboursement_id, categorie_remboursement_id } = req.body;
    if (!montant || isNaN(montant) || parseFloat(montant) <= 0)
      return res.status(400).json({ message: 'Montant invalide.' });
    if (parseFloat(montant) > parseFloat(dette.montant_restant))
      return res.status(400).json({ message: `Montant supérieur au restant (${dette.montant_restant}).` });

    await transaction(async (conn) => {
      await conn.execute(
        'INSERT INTO paiements_dettes (dette_id, montant, commentaire, revenu_id, date) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, parseFloat(montant), commentaire||null, revenu_id||null, date||new Date()]
      );
      const nouveauRestant = Math.round((parseFloat(dette.montant_restant) - parseFloat(montant)) * 100) / 100;
      await conn.execute(
        'UPDATE dettes SET montant_restant = ?, actif = ? WHERE id = ?',
        [nouveauRestant, nouveauRestant > 0 ? 1 : 0, req.params.id]
      );

      if (dette.sens === 'on_me_doit') {
        // Créance remboursée : l'argent revient dans le compte et l'enveloppe choisis
        const compteRembId = compte_remboursement_id ? parseInt(compte_remboursement_id) : dette.compte_id;
        const catRembId    = categorie_remboursement_id ? parseInt(categorie_remboursement_id) : dette.categorie_id;
        if (compteRembId) {
          await conn.execute(
            'UPDATE comptes SET solde = solde + ? WHERE id = ? AND user_id = ?',
            [parseFloat(montant), compteRembId, req.user.id]
          );
        }
        if (catRembId) {
          await conn.execute(
            'INSERT INTO soldes_categories (categorie_id, solde) VALUES (?, ?) ON DUPLICATE KEY UPDATE solde = solde + VALUES(solde), updated_at = NOW()',
            [catRembId, parseFloat(montant)]
          );
        }
      } else {
        // Dette (ex: carte crédit) — augmente le crédit disponible
        if (dette.compte_id) {
          await conn.execute(
            'UPDATE comptes SET solde = LEAST(limite, solde + ?) WHERE id = ?',
            [parseFloat(montant), dette.compte_id]
          );
        }
      }
    });

    // Vérifier si la carte crédit est entièrement remboursée
    let felicitations = false;
    if (dette.sens === 'je_dois' && dette.compte_id) {
      const [cr] = await pool.execute(
        'SELECT solde, limite FROM comptes WHERE id = ?', [dette.compte_id]
      );
      if (cr[0]?.limite !== null && parseFloat(cr[0].solde) >= parseFloat(cr[0].limite)) {
        felicitations = true;
      }
    }

    // Marque les plans sauvegardés contenant cette dette comme mis à jour
    await pool.execute(
      `UPDATE plans_remboursement SET updated_at = NOW()
       WHERE user_id = ? AND JSON_CONTAINS(dette_ids, CAST(? AS JSON))`,
      [req.user.id, req.params.id]
    ).catch(() => {}); // table peut ne pas encore exister au premier démarrage

    const [rows] = await pool.execute('SELECT * FROM dettes WHERE id = ?', [req.params.id]);
    const updated = rows[0];
    const label = dette.sens === 'on_me_doit' ? '🎉 Créance soldée !' : '🎉 Dette soldée !';
    notifier(pool, req.user.id, 'paiement_dette');
    res.status(201).json({
      message:       updated.actif ? 'Paiement enregistré.' : label,
      felicitations,
      dette:         updated
    });
  } catch (err) { next(err); }
};

const supprimerDette = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM dettes WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Dette introuvable.' });
    await pool.execute('UPDATE dettes SET actif = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Archivé.' });
  } catch (err) { next(err); }
};

const supprimerDefinitivement = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM dettes WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Dette introuvable.' });
    await transaction(async (conn) => {
      await conn.execute('DELETE FROM paiements_dettes WHERE dette_id = ?', [req.params.id]);
      await conn.execute('DELETE FROM dettes WHERE id = ?', [req.params.id]);
    });
    notifier(pool, req.user.id, 'dette_supprimee');
    res.json({ message: 'Dette supprimée définitivement.' });
  } catch (err) { next(err); }
};

const planifierRemboursement = async (req, res, next) => {
  try {
    const { dette_ids, date_cible, budget_mensuel_custom } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(dette_ids) || !dette_ids.length)
      return res.status(400).json({ message: 'Sélectionnez au moins une dette.' });
    if (!date_cible)
      return res.status(400).json({ message: 'La date cible est obligatoire.' });

    const dateCible = new Date(date_cible);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (dateCible <= today)
      return res.status(400).json({ message: 'La date cible doit être dans le futur.' });

    const placeholders = dette_ids.map(() => '?').join(',');
    const [dettes] = await pool.execute(
      `SELECT id, nom, montant_restant, paiement_minimum, taux_interet, priorite
       FROM dettes WHERE id IN (${placeholders}) AND user_id = ? AND actif = 1 AND sens = 'je_dois'`,
      [...dette_ids.map(Number), userId]
    );
    if (!dettes.length)
      return res.status(404).json({ message: 'Aucune dette trouvée.' });

    // Minimums des dettes non sélectionnées (déjà engagés)
    const [toutesDettes] = await pool.execute(
      `SELECT id, paiement_minimum FROM dettes WHERE user_id = ? AND actif = 1 AND sens = 'je_dois'`,
      [userId]
    );
    const selectedIds = new Set(dette_ids.map(Number));
    const minimums_non_selectionnes = toutesDettes
      .filter(d => !selectedIds.has(d.id))
      .reduce((s, d) => s + parseFloat(d.paiement_minimum || 0), 0);

    // Revenu moyen sur les 6 derniers mois
    const [incomeRows] = await pool.execute(`
      SELECT COALESCE(AVG(montant_mensuel), 0) AS revenu_moyen
      FROM (
        SELECT SUM(montant) AS montant_mensuel
        FROM revenus
        WHERE user_id = ? AND deleted_at IS NULL AND date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY YEAR(date), MONTH(date)
      ) monthly
    `, [userId]);
    const revenu_moyen = parseFloat(incomeRows[0]?.revenu_moyen || 0);

    // Mois entre aujourd'hui et la date cible
    const mois_restants = Math.max(1,
      (dateCible.getFullYear() - today.getFullYear()) * 12 +
      (dateCible.getMonth() - today.getMonth())
    );

    const total_restant = dettes.reduce((s, d) => s + parseFloat(d.montant_restant), 0);
    const paiement_mensuel_requis = total_restant / mois_restants;

    const budget_disponible = budget_mensuel_custom != null
      ? parseFloat(budget_mensuel_custom)
      : Math.max(0, revenu_moyen - minimums_non_selectionnes);

    const faisable = paiement_mensuel_requis <= budget_disponible;

    // Répartition proportionnelle par dette
    const plan_par_dette = dettes
      .map(d => {
        const restant = parseFloat(d.montant_restant);
        const pct = total_restant > 0 ? restant / total_restant : 1 / dettes.length;
        return {
          id: d.id,
          nom: d.nom,
          montant_restant: Math.round(restant * 100) / 100,
          paiement_mensuel: Math.round(paiement_mensuel_requis * pct * 100) / 100,
          taux_interet: d.taux_interet != null ? parseFloat(d.taux_interet) : null,
          priorite: d.priorite,
          pct_du_plan: Math.round(pct * 100),
        };
      })
      .sort((a, b) => a.priorite - b.priorite);

    // Date suggérée si non faisable
    let date_suggeree = null;
    let mois_suggeres = null;
    if (!faisable && budget_disponible > 0) {
      mois_suggeres = Math.ceil(total_restant / budget_disponible);
      const ds = new Date(today);
      ds.setMonth(ds.getMonth() + mois_suggeres);
      date_suggeree = ds.toISOString().slice(0, 10);
    }

    res.json({
      faisable,
      paiement_mensuel_requis: Math.round(paiement_mensuel_requis * 100) / 100,
      budget_disponible:        Math.round(budget_disponible * 100) / 100,
      revenu_moyen:             Math.round(revenu_moyen * 100) / 100,
      minimums_non_selectionnes:Math.round(minimums_non_selectionnes * 100) / 100,
      mois_restants,
      date_cible,
      total_restant:            Math.round(total_restant * 100) / 100,
      date_suggeree,
      mois_suggeres,
      plan_par_dette,
    });
  } catch (err) { next(err); }
};

// mysql2 renvoie les colonnes JSON comme string — on parse avant d'envoyer
function parsePlan(plan) {
  return {
    ...plan,
    dette_ids: typeof plan.dette_ids === 'string' ? JSON.parse(plan.dette_ids) : plan.dette_ids,
  };
}

const listerPlans = async (req, res, next) => {
  try {
    const [plans] = await pool.execute(
      'SELECT * FROM plans_remboursement WHERE user_id = ? ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json({ plans: plans.map(parsePlan) });
  } catch (err) { next(err); }
};

const sauvegarderPlan = async (req, res, next) => {
  try {
    const { nom, dette_ids, date_cible, budget_mensuel_custom } = req.body;
    if (!Array.isArray(dette_ids) || !dette_ids.length)
      return res.status(400).json({ message: 'Aucune dette sélectionnée.' });
    if (!date_cible)
      return res.status(400).json({ message: 'Date cible obligatoire.' });

    const [result] = await pool.execute(
      'INSERT INTO plans_remboursement (user_id, nom, dette_ids, date_cible, budget_mensuel_custom) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, nom?.trim() || 'Mon plan', JSON.stringify(dette_ids), date_cible, budget_mensuel_custom ?? null]
    );
    const [rows] = await pool.execute('SELECT * FROM plans_remboursement WHERE id = ?', [result.insertId]);
    res.status(201).json({ plan: parsePlan(rows[0]) });
  } catch (err) { next(err); }
};

const mettreAJourPlan = async (req, res, next) => {
  try {
    const { nom, dette_ids, date_cible, budget_mensuel_custom } = req.body;
    const [existing] = await pool.execute(
      'SELECT id FROM plans_remboursement WHERE id = ? AND user_id = ?',
      [req.params.planId, req.user.id]
    );
    if (!existing[0]) return res.status(404).json({ message: 'Plan introuvable.' });

    await pool.execute(
      `UPDATE plans_remboursement SET
        nom = COALESCE(?, nom),
        dette_ids = COALESCE(?, dette_ids),
        date_cible = COALESCE(?, date_cible),
        budget_mensuel_custom = ?
       WHERE id = ?`,
      [
        nom?.trim() || null,
        dette_ids ? JSON.stringify(dette_ids) : null,
        date_cible || null,
        budget_mensuel_custom ?? null,
        req.params.planId,
      ]
    );
    const [rows] = await pool.execute('SELECT * FROM plans_remboursement WHERE id = ?', [req.params.planId]);
    res.json({ plan: parsePlan(rows[0]) });
  } catch (err) { next(err); }
};

const supprimerPlan = async (req, res, next) => {
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM plans_remboursement WHERE id = ? AND user_id = ?',
      [req.params.planId, req.user.id]
    );
    if (!existing[0]) return res.status(404).json({ message: 'Plan introuvable.' });
    await pool.execute('DELETE FROM plans_remboursement WHERE id = ?', [req.params.planId]);
    res.json({ message: 'Plan supprimé.' });
  } catch (err) { next(err); }
};

module.exports = { listerDettes, listerRappels, obtenirDette, creerDette, modifierDette, enregistrerPaiement, supprimerDette, supprimerDefinitivement, planifierRemboursement, listerPlans, sauvegarderPlan, mettreAJourPlan, supprimerPlan };
