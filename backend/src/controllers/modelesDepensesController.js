const { pool } = require('../database/db')

const RECURRENCES = ['mensuel', 'bi-mensuel', 'hebdomadaire']

function prochaineDate(recurrence, depuis = new Date()) {
  const d = new Date(depuis)
  if      (recurrence === 'mensuel')       d.setMonth(d.getMonth() + 1)
  else if (recurrence === 'bi-mensuel')    d.setDate(d.getDate() + 15)
  else if (recurrence === 'hebdomadaire')  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

const listerModeles = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT m.*, c.nom as categorie_nom, c.couleur, c.icone
      FROM modeles_depenses m
      LEFT JOIN categories c ON c.id = m.categorie_id
      WHERE m.user_id = ? AND m.actif = 1
      ORDER BY m.prochaine_date ASC
    `, [req.user.id])
    res.json({ modeles: rows })
  } catch (err) { next(err) }
}

const creerModele = async (req, res, next) => {
  try {
    const {
      montant, commentaire, categorie_id, recurrence = 'mensuel',
      prochaine_date, is_deductible = false, deductible_pct = 100, categorie_fiscale
    } = req.body

    if (!montant || parseFloat(montant) <= 0)
      return res.status(400).json({ message: 'Montant invalide.' })
    if (!commentaire?.trim())
      return res.status(400).json({ message: 'Description requise.' })
    if (!RECURRENCES.includes(recurrence))
      return res.status(400).json({ message: 'Récurrence invalide.' })

    const date = prochaine_date || new Date().toISOString().slice(0, 10)

    const [result] = await pool.execute(
      `INSERT INTO modeles_depenses
       (user_id, montant, commentaire, categorie_id, recurrence, prochaine_date,
        is_deductible, deductible_pct, categorie_fiscale)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, montant, commentaire.trim(), categorie_id || null, recurrence, date,
       is_deductible ? 1 : 0, deductible_pct, categorie_fiscale || null]
    )
    const [rows] = await pool.execute(
      `SELECT m.*, c.nom as categorie_nom, c.couleur, c.icone
       FROM modeles_depenses m LEFT JOIN categories c ON c.id = m.categorie_id
       WHERE m.id = ?`,
      [result.insertId]
    )
    res.status(201).json({ modele: rows[0] })
  } catch (err) { next(err) }
}

const utiliserModele = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM modeles_depenses WHERE id = ? AND user_id = ? AND actif = 1',
      [req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ message: 'Modèle introuvable.' })
    const m = rows[0]

    const [result] = await pool.execute(
      `INSERT INTO depenses (user_id, categorie_id, montant, commentaire, date,
         is_deductible, deductible_pct, categorie_fiscale)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [req.user.id, m.categorie_id, m.montant, m.commentaire,
       m.is_deductible, m.deductible_pct, m.categorie_fiscale]
    )

    if (m.categorie_id) {
      await pool.execute(
        `INSERT INTO soldes_categories (categorie_id, solde) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE solde = solde - ?`,
        [m.categorie_id, -parseFloat(m.montant), parseFloat(m.montant)]
      )
    }

    const nouvelleDate = prochaineDate(m.recurrence)
    await pool.execute(
      'UPDATE modeles_depenses SET prochaine_date = ? WHERE id = ?',
      [nouvelleDate, req.params.id]
    )

    res.json({ message: 'Dépense enregistrée.', nouvelle_date: nouvelleDate, depense_id: result.insertId })
  } catch (err) { next(err) }
}

const supprimerModele = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM modeles_depenses WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ message: 'Modèle introuvable.' })
    await pool.execute('UPDATE modeles_depenses SET actif = 0 WHERE id = ?', [req.params.id])
    res.json({ message: 'Modèle supprimé.' })
  } catch (err) { next(err) }
}

module.exports = { listerModeles, creerModele, utiliserModele, supprimerModele }
