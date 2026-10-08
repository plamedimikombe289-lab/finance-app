const { pool } = require('../database/db');

// Validation sécurisée de pagination
function safePagination(page, limite, maxLimite = 100) {
  const lim  = Math.min(Math.max(parseInt(limite) || 10, 1), maxLimite);
  const pg   = Math.max(parseInt(page) || 1, 1);
  return { lim, offset: (pg - 1) * lim, pg };
}

const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [categories] = await pool.execute(`
      SELECT c.id, c.nom, c.type, c.valeur, c.couleur, c.icone, c.seuil_alerte, c.objectif,
             COALESCE(s.solde, 0) as solde
      FROM categories c
      LEFT JOIN soldes_categories s ON s.categorie_id = c.id
      WHERE c.actif = 1 AND c.user_id = ? ORDER BY c.ordre
    `, [userId]);

    const [dettes] = await pool.execute(`
      SELECT id, nom, type, montant_total, montant_restant, paiement_minimum, priorite,
        ROUND((montant_total - montant_restant) * 100.0 / montant_total, 1) as progression_pct
      FROM dettes WHERE actif = 1 AND user_id = ?
      ORDER BY priorite ASC, montant_restant DESC
    `, [userId]);

    const [revMois] = await pool.execute(`
      SELECT COALESCE(SUM(montant),0) as total, COUNT(*) as nb FROM revenus
      WHERE user_id = ? AND deleted_at IS NULL
        AND DATE_FORMAT(date,'%Y-%m') = DATE_FORMAT(NOW(),'%Y-%m')
    `, [userId]);

    const [depMois] = await pool.execute(`
      SELECT COALESCE(SUM(montant),0) as total, COUNT(*) as nb FROM depenses
      WHERE user_id = ? AND deleted_at IS NULL
        AND DATE_FORMAT(date,'%Y-%m') = DATE_FORMAT(NOW(),'%Y-%m')
    `, [userId]);

    const [derniersRevenus] = await pool.execute(
      'SELECT id, montant, commentaire, type, date FROM revenus WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC LIMIT 5',
      [userId]
    );

    const [dernieresDepenses] = await pool.execute(`
      SELECT d.id, d.montant, d.commentaire, d.date, c.nom as categorie, c.couleur
      FROM depenses d LEFT JOIN categories c ON c.id = d.categorie_id
      WHERE d.user_id = ? AND d.deleted_at IS NULL
      ORDER BY d.date DESC LIMIT 5
    `, [userId]);

    const [nonRepartiRows] = await pool.execute(`
      SELECT r.id, r.montant, r.commentaire,
        ROUND(r.montant - COALESCE(SUM(rp.montant), 0), 2) as non_reparti
      FROM revenus r
      LEFT JOIN repartitions rp ON rp.revenu_id = r.id
      WHERE r.user_id = ? AND r.deleted_at IS NULL
      GROUP BY r.id
      HAVING non_reparti > 0.01
      ORDER BY r.date DESC
      LIMIT 1
    `, [userId]);

    res.json({
      resume: {
        total_soldes:  Math.round(categories.reduce((s,c)=>s+parseFloat(c.solde),0)*100)/100,
        total_dettes:  Math.round(dettes.reduce((s,d)=>s+parseFloat(d.montant_restant),0)*100)/100,
        revenus_mois:  Math.round(parseFloat(revMois[0].total)*100)/100,
        depenses_mois: Math.round(parseFloat(depMois[0].total)*100)/100,
        nb_dettes:     dettes.length
      },
      categories,
      dettes,
      derniers_revenus:   derniersRevenus,
      dernieres_depenses: dernieresDepenses,
      non_reparti_recent: nonRepartiRows[0] || null,
    });
  } catch (err) { next(err); }
};

const getBudgetMensuel = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [budget] = await pool.execute(`
      SELECT
        c.id, c.nom, c.couleur, c.icone, c.type, c.valeur, c.objectif,
        COALESCE(s.solde, 0) as solde,
        COALESCE(r.recu_mois, 0)    as recu_mois,
        COALESCE(d.depense_mois, 0) as depense_mois
      FROM categories c
      LEFT JOIN soldes_categories s ON s.categorie_id = c.id
      LEFT JOIN (
        SELECT rp.categorie_id, ROUND(SUM(rp.montant), 2) as recu_mois
        FROM repartitions rp
        JOIN revenus rev ON rev.id = rp.revenu_id
        WHERE rev.user_id = ? AND rev.deleted_at IS NULL
          AND DATE_FORMAT(rev.date,'%Y-%m') = DATE_FORMAT(NOW(),'%Y-%m')
        GROUP BY rp.categorie_id
      ) r ON r.categorie_id = c.id
      LEFT JOIN (
        SELECT dep.categorie_id, ROUND(SUM(dep.montant), 2) as depense_mois
        FROM depenses dep
        WHERE dep.user_id = ? AND dep.deleted_at IS NULL
          AND DATE_FORMAT(dep.date,'%Y-%m') = DATE_FORMAT(NOW(),'%Y-%m')
        GROUP BY dep.categorie_id
      ) d ON d.categorie_id = c.id
      WHERE c.actif = 1 AND c.user_id = ?
      ORDER BY c.ordre ASC
    `, [userId, userId, userId]);

    res.json({ budget, mois: new Date().toISOString().slice(0, 7) });
  } catch (err) { next(err); }
};

const getHistorique = async (req, res, next) => {
  try {
    const { page = 1, limite = 10, mois } = req.query;
    const userId = req.user.id;
    const { lim, offset, pg } = safePagination(page, limite, 50);

    const conditions = ['r.user_id = ?', 'r.deleted_at IS NULL'];
    const params     = [userId];
    if (mois) { conditions.push(`DATE_FORMAT(r.date,'%Y-%m') = ?`); params.push(mois); }
    const where = 'WHERE ' + conditions.join(' AND ');

    const [revenus] = await pool.execute(
      `SELECT r.id, r.montant, r.commentaire, r.type, r.date FROM revenus r ${where}
       ORDER BY r.date DESC LIMIT ? OFFSET ?`,
      [...params, lim, offset]
    );

    // Résoudre les répartitions en une seule requête (évite N+1)
    let enrichis = revenus.map(r => ({ ...r, repartitions: [] }));
    if (revenus.length > 0) {
      const ids = revenus.map(r => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const [allReps] = await pool.execute(`
        SELECT rp.revenu_id, rp.montant, c.nom as categorie, c.couleur, c.icone
        FROM repartitions rp
        JOIN categories c ON c.id = rp.categorie_id
        WHERE rp.revenu_id IN (${placeholders})
        ORDER BY rp.revenu_id, c.ordre
      `, ids);

      const repMap = {};
      for (const rep of allReps) {
        if (!repMap[rep.revenu_id]) repMap[rep.revenu_id] = [];
        repMap[rep.revenu_id].push(rep);
      }
      enrichis = revenus.map(r => ({ ...r, repartitions: repMap[r.id] || [] }));
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as n FROM revenus r ${where}`,
      params
    );
    res.json({ revenus: enrichis, total: countRows[0].n, page: pg });
  } catch (err) { next(err); }
};

const getRapportRevenu = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM revenus WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Revenu introuvable.' });

    const [repartitions] = await pool.execute(`
      SELECT rp.montant, rp.date,
        c.nom as categorie, c.type as categorie_type, c.valeur as categorie_valeur, c.couleur, c.icone
      FROM repartitions rp JOIN categories c ON c.id = rp.categorie_id
      WHERE rp.revenu_id = ? ORDER BY c.ordre
    `, [req.params.id]);

    const totalReparti = repartitions.reduce((s,r)=>s+parseFloat(r.montant),0);
    res.json({
      revenu: rows[0],
      repartitions,
      total_reparti: Math.round(totalReparti*100)/100,
      non_reparti:   Math.round((parseFloat(rows[0].montant)-totalReparti)*100)/100
    });
  } catch (err) { next(err); }
};

const getEvolution = async (req, res, next) => {
  try {
    const { mois = 6 } = req.query;
    const userId = req.user.id;
    const lim = Math.min(Math.max(parseInt(mois) || 6, 1), 24);

    const [revenus] = await pool.execute(`
      SELECT DATE_FORMAT(date,'%Y-%m') as mois, ROUND(SUM(montant),2) as total
      FROM revenus WHERE user_id = ? AND deleted_at IS NULL
      GROUP BY DATE_FORMAT(date,'%Y-%m') ORDER BY mois DESC LIMIT ?
    `, [userId, lim]);

    const [depenses] = await pool.execute(`
      SELECT DATE_FORMAT(date,'%Y-%m') as mois, ROUND(SUM(montant),2) as total
      FROM depenses WHERE user_id = ? AND deleted_at IS NULL
      GROUP BY DATE_FORMAT(date,'%Y-%m') ORDER BY mois DESC LIMIT ?
    `, [userId, lim]);

    const [paiements] = await pool.execute(`
      SELECT DATE_FORMAT(pd.date,'%Y-%m') as mois, ROUND(SUM(pd.montant),2) as total
      FROM paiements_dettes pd
      JOIN dettes d ON d.id = pd.dette_id
      WHERE d.user_id = ?
      GROUP BY DATE_FORMAT(pd.date,'%Y-%m') ORDER BY mois DESC LIMIT ?
    `, [userId, lim]);

    res.json({
      revenus:          revenus.reverse(),
      depenses:         depenses.reverse(),
      paiements_dettes: paiements.reverse()
    });
  } catch (err) { next(err); }
};

const getRapportFiscal = async (req, res, next) => {
  try {
    const annee = Math.max(2000, Math.min(2100, parseInt(req.query.annee) || new Date().getFullYear()));
    const userId = req.user.id;
    const debut  = `${annee}-01-01 00:00:00`;
    const fin    = `${annee}-12-31 23:59:59`;

    const [revenus] = await pool.execute(`
      SELECT id, montant, commentaire, type, source, date
      FROM revenus WHERE user_id = ? AND deleted_at IS NULL AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `, [userId, debut, fin]);

    const [depenses] = await pool.execute(`
      SELECT d.id, d.montant, d.commentaire, d.date,
             d.is_deductible, d.deductible_pct, d.categorie_fiscale,
             d.fichier_nom, d.fichier_stocke,
             c.nom as categorie_nom, c.icone as categorie_icone
      FROM depenses d LEFT JOIN categories c ON c.id = d.categorie_id
      WHERE d.user_id = ? AND d.deleted_at IS NULL AND d.date BETWEEN ? AND ?
      ORDER BY d.date ASC
    `, [userId, debut, fin]);

    const totalRevenus  = revenus.reduce((s, r) => s + parseFloat(r.montant), 0);
    const totalDepenses = depenses.reduce((s, d) => s + parseFloat(d.montant), 0);

    const depensesDeductibles = depenses.filter(d => d.is_deductible);
    const totalDeductible = depensesDeductibles.reduce((s, d) =>
      s + parseFloat(d.montant) * parseFloat(d.deductible_pct ?? 100) / 100, 0);

    const revenuParType = {};
    for (const r of revenus) {
      if (!revenuParType[r.type]) revenuParType[r.type] = { total: 0, nb: 0 };
      revenuParType[r.type].total += parseFloat(r.montant);
      revenuParType[r.type].nb++;
    }

    const deductibleParCat = {};
    for (const d of depensesDeductibles) {
      const cat = d.categorie_fiscale || 'autre_deductible';
      if (!deductibleParCat[cat]) deductibleParCat[cat] = { total: 0, montant_brut: 0, nb: 0 };
      deductibleParCat[cat].total       += parseFloat(d.montant) * parseFloat(d.deductible_pct ?? 100) / 100;
      deductibleParCat[cat].montant_brut += parseFloat(d.montant);
      deductibleParCat[cat].nb++;
    }

    res.json({
      annee,
      resume: {
        total_revenus:           Math.round(totalRevenus    * 100) / 100,
        total_depenses:          Math.round(totalDepenses   * 100) / 100,
        total_deductible:        Math.round(totalDeductible * 100) / 100,
        revenu_imposable_estime: Math.round((totalRevenus - totalDeductible) * 100) / 100,
        nb_revenus:     revenus.length,
        nb_depenses:    depenses.length,
        nb_deductibles: depensesDeductibles.length,
        nb_avec_recus:  depenses.filter(d => d.fichier_stocke).length,
      },
      revenus,
      revenus_par_type:         revenuParType,
      depenses,
      depenses_deductibles:     depensesDeductibles,
      deductible_par_categorie: deductibleParCat,
    });
  } catch (err) { next(err); }
};

const getValeurNette = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [actifsNonLiquidesRows] = await pool.execute(
      "SELECT COALESCE(SUM(valeur), 0) as total FROM actifs WHERE user_id = ? AND actif = 1 AND type != 'compte_bancaire'",
      [userId]
    );
    const [dettesRows] = await pool.execute(
      "SELECT COALESCE(SUM(montant_restant), 0) as total FROM dettes WHERE user_id = ? AND actif = 1 AND sens = 'je_dois'",
      [userId]
    );
    const [comptesRows] = await pool.execute(
      'SELECT COALESCE(SUM(solde), 0) as total, COUNT(*) as nb FROM comptes WHERE user_id = ? AND actif = 1',
      [userId]
    );
    const [soldesRows] = await pool.execute(`
      SELECT COALESCE(SUM(s.solde), 0) as total
      FROM soldes_categories s JOIN categories c ON c.id = s.categorie_id
      WHERE c.user_id = ? AND c.actif = 1
    `, [userId]);
    const [depMoyRows] = await pool.execute(`
      SELECT COALESCE(SUM(montant), 0) / 3 as avg_mois
      FROM depenses WHERE user_id = ? AND deleted_at IS NULL AND date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
    `, [userId]);
    const [actifs] = await pool.execute(
      'SELECT * FROM actifs WHERE user_id = ? AND actif = 1 ORDER BY type, valeur DESC',
      [userId]
    );
    const [comptes] = await pool.execute(
      'SELECT * FROM comptes WHERE user_id = ? AND actif = 1 ORDER BY type, nom',
      [userId]
    );

    const totalActifsNonLiquides = parseFloat(actifsNonLiquidesRows[0].total);
    const totalDettes   = parseFloat(dettesRows[0].total);
    const totalComptes  = parseFloat(comptesRows[0].total);
    const nbComptes     = parseInt(comptesRows[0].nb);
    const totalSoldes   = parseFloat(soldesRows[0].total);
    const avgMensuel    = parseFloat(depMoyRows[0].avg_mois);

    const liquide     = nbComptes > 0 ? totalComptes : totalSoldes;
    const valeurNette = liquide + totalActifsNonLiquides - totalDettes;
    const moisCouverts = avgMensuel > 0 ? Math.round((liquide / avgMensuel) * 10) / 10 : null;

    res.json({
      total_actifs:      Math.round((totalActifsNonLiquides + liquide) * 100) / 100,
      total_actifs_non_liquides: Math.round(totalActifsNonLiquides * 100) / 100,
      total_comptes:     Math.round(totalComptes * 100) / 100,
      total_dettes:      Math.round(totalDettes  * 100) / 100,
      total_soldes:      Math.round(totalSoldes  * 100) / 100,
      valeur_nette:      Math.round(valeurNette  * 100) / 100,
      mois_couverts:     moisCouverts,
      avg_depenses_mois: Math.round(avgMensuel   * 100) / 100,
      actifs,
      comptes,
    });
  } catch (err) { next(err); }
};

const sauvegarderScore = async (req, res, next) => {
  try {
    const score = parseInt(req.body.score);
    if (isNaN(score) || score < 0 || score > 100)
      return res.status(400).json({ message: 'Score invalide.' });
    const mois = new Date().toISOString().slice(0, 7);
    await pool.execute(
      `INSERT INTO scores_historiques (user_id, score, mois) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE score = VALUES(score)`,
      [req.user.id, score, mois]
    );
    res.json({ ok: true, mois });
  } catch (err) { next(err); }
};

const getScoresHistoriques = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT score, mois FROM scores_historiques WHERE user_id = ? ORDER BY mois ASC LIMIT 24',
      [req.user.id]
    );
    res.json({ scores: rows });
  } catch (err) { next(err); }
};

module.exports = { getDashboard, getBudgetMensuel, getHistorique, getRapportRevenu, getEvolution, getRapportFiscal, getValeurNette, sauvegarderScore, getScoresHistoriques };
