const { pool } = require('../database/db');

/**
 * Distribue un revenu entre les catégories actives de l'utilisateur.
 *
 * Algorithme :
 *  1. Catégories fixes (type='fixe') : allouées en ordre, jusqu'à épuisement du solde.
 *     Un `plafond_mensuel` limite l'allocation cumulée sur le mois calendaire.
 *  2. Catégories pourcentage (type='pourcentage') : calculées sur le solde restant après fixes.
 *  3. Le montant non-réparti est retourné mais pas inséré en base.
 *
 * @param {number} revenuId - ID du revenu à répartir
 * @param {number} montant  - Montant brut à distribuer (en devise utilisateur)
 * @param {number} userId   - ID de l'utilisateur propriétaire des catégories
 * @param {import('mysql2/promise').Connection|null} conn - Connexion transactionnelle optionnelle
 * @returns {Promise<{montant_total: number, non_reparti: number, lignes: Array}>}
 */
async function repartirRevenu(revenuId, montant, userId, conn = null) {
  const db = conn || pool;

  const [cats] = await db.execute(`
    SELECT id, nom, type, valeur, plafond_mensuel
    FROM categories
    WHERE actif = 1 AND user_id = ?
    ORDER BY FIELD(type,'fixe','pourcentage'), ordre ASC
  `, [userId]);

  const fixes        = cats.filter(c => c.type === 'fixe');
  const pourcentages = cats.filter(c => c.type === 'pourcentage');

  let montantRestant = montant;
  const lignes = [];

  for (const cat of fixes) {
    let alloue;

    if (cat.plafond_mensuel != null) {
      // Espace disponible = plafond - solde actuel de l'enveloppe
      const [soldeRows] = await db.execute(
        'SELECT COALESCE(solde, 0) AS solde FROM soldes_categories WHERE categorie_id = ?',
        [cat.id]
      );
      const soldeActuel = parseFloat(soldeRows[0]?.solde ?? 0);
      const remaining   = arrondir(parseFloat(cat.plafond_mensuel) - soldeActuel);

      if (remaining <= 0) {
        alloue = 0; // enveloppe déjà pleine → on saute
      } else {
        alloue = arrondir(Math.min(parseFloat(cat.valeur), montantRestant, remaining));
      }
    } else {
      alloue = arrondir(Math.min(parseFloat(cat.valeur), montantRestant));
    }

    lignes.push({ categorie_id: cat.id, nom: cat.nom, montant: alloue });
    montantRestant = arrondir(montantRestant - alloue);
    if (montantRestant <= 0) break;
  }

  const basePourcentage = montantRestant;

  for (const cat of pourcentages) {
    const alloue = arrondir(basePourcentage * parseFloat(cat.valeur) / 100);
    lignes.push({ categorie_id: cat.id, nom: cat.nom, montant: alloue, taux: cat.valeur });
    montantRestant = arrondir(montantRestant - alloue);
  }

  const nonReparti = arrondir(Math.max(0, montantRestant));

  for (const ligne of lignes) {
    if (ligne.montant <= 0) continue;
    await db.execute(
      'INSERT INTO repartitions (revenu_id, categorie_id, montant) VALUES (?, ?, ?)',
      [revenuId, ligne.categorie_id, ligne.montant]
    );
    await db.execute(`
      INSERT INTO soldes_categories (categorie_id, solde, est_paye)
      VALUES (?, ?, 0)
      ON DUPLICATE KEY UPDATE solde = solde + VALUES(solde), est_paye = 0, updated_at = NOW()
    `, [ligne.categorie_id, ligne.montant]);
  }

  return { montant_total: montant, non_reparti: nonReparti, lignes };
}

/**
 * Annule la répartition d'un revenu : soustrait les montants des soldes de catégories
 * et supprime les lignes de répartition associées.
 *
 * @param {number} revenuId - ID du revenu dont la répartition est à annuler
 * @param {import('mysql2/promise').Connection|null} conn - Connexion transactionnelle optionnelle
 */
async function annulerRepartition(revenuId, conn = null) {
  const db = conn || pool;

  const [lignes] = await db.execute(
    'SELECT categorie_id, montant FROM repartitions WHERE revenu_id = ?',
    [revenuId]
  );

  for (const l of lignes) {
    await db.execute(`
      UPDATE soldes_categories
      SET solde = GREATEST(0, solde - ?), updated_at = NOW()
      WHERE categorie_id = ?
    `, [l.montant, l.categorie_id]);
  }

  await db.execute('DELETE FROM repartitions WHERE revenu_id = ?', [revenuId]);
}

function arrondir(val) {
  return Math.round(val * 100) / 100;
}

module.exports = { repartirRevenu, annulerRepartition };
