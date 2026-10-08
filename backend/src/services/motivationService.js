const { pool } = require('../database/db')

/**
 * Génère des messages de motivation personnalisés pour un utilisateur,
 * basés sur la progression vers ses objectifs et la maîtrise de ses budgets.
 *
 * @param {number} userId
 * @returns {Promise<Array<{type, titre, message, categorie, progress}>>}
 */
async function genererMotivations(userId) {
  const [cats] = await pool.execute(`
    SELECT c.id, c.nom, c.type, c.valeur, c.objectif, c.seuil_alerte, c.plafond_mensuel,
           COALESCE(s.solde, 0) AS solde,
           COALESCE(dm.depenses_mois, 0) AS depenses_mois
    FROM categories c
    LEFT JOIN soldes_categories s ON s.categorie_id = c.id
    LEFT JOIN (
      SELECT categorie_id, SUM(montant) AS depenses_mois
      FROM depenses
      WHERE MONTH(date) = MONTH(CURDATE())
        AND YEAR(date) = YEAR(CURDATE())
        AND deleted_at IS NULL
      GROUP BY categorie_id
    ) dm ON dm.categorie_id = c.id
    WHERE c.actif = 1 AND c.user_id = ?
    ORDER BY c.ordre ASC
  `, [userId])

  const messages = []

  for (const cat of cats) {
    const solde        = parseFloat(cat.solde)
    const depensesMois = parseFloat(cat.depenses_mois)
    const objectif     = cat.objectif        != null ? parseFloat(cat.objectif)        : null
    const seuil        = cat.seuil_alerte    != null ? parseFloat(cat.seuil_alerte)    : null
    const plafond      = cat.plafond_mensuel != null ? parseFloat(cat.plafond_mensuel) : null

    // ── Progression vers l'objectif ──────────────────────────────────────────
    if (objectif != null && objectif > 0) {
      const progress = Math.min(solde / objectif, 1.5)
      const pct = Math.round(Math.min(progress, 1) * 100)

      if (solde >= objectif) {
        messages.push({
          type: 'success',
          titre: 'Objectif atteint',
          message: `Félicitations ! Tu as atteint ton objectif pour "${cat.nom}". Pense à en fixer un nouveau !`,
          categorie: cat.nom,
          progress: 1,
        })
      } else if (progress >= 0.9) {
        messages.push({
          type: 'success',
          titre: 'Presque là',
          message: `Tu es à ${pct}% de ton objectif "${cat.nom}". Plus que ${_fmt(objectif - solde)} à accumuler — continue !`,
          categorie: cat.nom,
          progress,
        })
      } else if (progress >= 0.5) {
        messages.push({
          type: 'info',
          titre: 'Bonne progression',
          message: `${pct}% atteint sur "${cat.nom}". Tu es sur la bonne voie, garde le rythme !`,
          categorie: cat.nom,
          progress,
        })
      } else if (progress > 0) {
        messages.push({
          type: 'info',
          titre: 'Objectif en cours',
          message: `"${cat.nom}" : ${pct}% vers ton objectif de ${_fmt(objectif)}. Chaque dépôt compte !`,
          categorie: cat.nom,
          progress,
        })
      } else {
        messages.push({
          type: 'info',
          titre: 'Lance-toi',
          message: `Tu as fixé un objectif de ${_fmt(objectif)} pour "${cat.nom}". Le meilleur moment pour commencer, c'est maintenant.`,
          categorie: cat.nom,
          progress: 0,
        })
      }
    }

    // ── Santé de l'enveloppe vs plafond mensuel ──────────────────────────────
    if (plafond != null && plafond > 0) {
      const remainingRatio = Math.max(0, solde) / plafond
      const pct            = Math.round(Math.min(remainingRatio, 1) * 100)
      const soldeFmt       = _fmt(Math.max(0, solde))
      const plafondFmt     = _fmt(plafond)

      if (solde <= 0) {
        messages.push({
          type: 'danger',
          titre: 'Enveloppe épuisée',
          message: `L'enveloppe "${cat.nom}" est vide ou en déficit. Pense à la réapprovisionner ou à réduire tes dépenses.`,
          categorie: cat.nom,
          progress: 0,
        })
      } else if (remainingRatio < 0.2) {
        messages.push({
          type: 'warning',
          titre: 'Enveloppe presque vide',
          message: `Il ne reste que ${soldeFmt} dans "${cat.nom}" (${pct}% du plafond de ${plafondFmt}). Surveille tes dépenses de près.`,
          categorie: cat.nom,
          progress: remainingRatio,
        })
      } else if (remainingRatio >= 1) {
        messages.push({
          type: 'success',
          titre: 'Enveloppe complète',
          message: `"${cat.nom}" a atteint son plafond avec ${soldeFmt} disponible. Excellent travail !`,
          categorie: cat.nom,
          progress: 1,
        })
      } else if (remainingRatio >= 0.6) {
        messages.push({
          type: 'success',
          titre: 'Enveloppe bien garnie',
          message: `"${cat.nom}" dispose de ${soldeFmt} (${pct}% du plafond de ${plafondFmt}). Tu es dans la bonne voie !`,
          categorie: cat.nom,
          progress: remainingRatio,
        })
      }
    }

    // ── Seuil d'alerte (solde trop bas) ─────────────────────────────────────
    if (seuil != null && solde < seuil) {
      messages.push({
        type: 'warning',
        titre: "Seuil d'alerte",
        message: `Le solde de "${cat.nom}" (${_fmt(solde)}) est sous ton seuil d'alerte de ${_fmt(seuil)}. Pense à approvisionner cette catégorie.`,
        categorie: cat.nom,
        progress: seuil > 0 ? solde / seuil : 0,
      })
    }
  }

  // ── Message d'invitation si aucune donnée configurée ─────────────────────
  if (messages.length === 0) {
    messages.push({
      type: 'info',
      titre: 'Configurer mes objectifs',
      message: 'Ajoute des objectifs et des plafonds mensuels à tes catégories pour recevoir des conseils personnalisés ici.',
      categorie: null,
      progress: null,
    })
  }

  // Trier : danger → warning → success → info
  const order = { danger: 0, warning: 1, success: 2, info: 3 }
  messages.sort((a, b) => (order[a.type] ?? 4) - (order[b.type] ?? 4))

  return messages.slice(0, 8)
}

function _fmt(val) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(val)
}

module.exports = { genererMotivations }
