const { pool, transaction } = require('../database/db')

const TYPES_VALIDES = ['cheque', 'epargne', 'credit', 'autre']

const listerComptes = async (req, res, next) => {
  try {
    const [comptes] = await pool.execute(
      'SELECT * FROM comptes WHERE user_id = ? AND actif = 1 ORDER BY type, nom',
      [req.user.id]
    )
    const total = comptes.reduce((s, c) => s + parseFloat(c.solde), 0)
    res.json({ comptes, total: Math.round(total * 100) / 100 })
  } catch (err) { next(err) }
}

const creerCompte = async (req, res, next) => {
  try {
    const { nom, type = 'cheque', solde_initial = 0, couleur = '#6366f1' } = req.body
    if (!nom?.trim())
      return res.status(400).json({ message: 'Le nom du compte est requis.' })
    if (!TYPES_VALIDES.includes(type))
      return res.status(400).json({ message: 'Type invalide.' })

    const [result] = await pool.execute(
      'INSERT INTO comptes (user_id, nom, type, solde, couleur) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, nom.trim(), type, parseFloat(solde_initial) || 0, couleur]
    )
    const [rows] = await pool.execute('SELECT * FROM comptes WHERE id = ?', [result.insertId])
    res.status(201).json({ compte: rows[0] })
  } catch (err) { next(err) }
}

const modifierCompte = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM comptes WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ message: 'Compte introuvable.' })

    const { nom, type, couleur } = req.body
    await pool.execute(
      `UPDATE comptes SET
        nom     = COALESCE(?, nom),
        type    = COALESCE(?, type),
        couleur = COALESCE(?, couleur)
       WHERE id = ?`,
      [nom || null, (type && TYPES_VALIDES.includes(type)) ? type : null, couleur || null, req.params.id]
    )
    const [updated] = await pool.execute('SELECT * FROM comptes WHERE id = ?', [req.params.id])
    res.json({ compte: updated[0] })
  } catch (err) { next(err) }
}

const supprimerCompte = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM comptes WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ message: 'Compte introuvable.' })
    await pool.execute('UPDATE comptes SET actif = 0 WHERE id = ?', [req.params.id])
    res.json({ message: 'Compte archivé.' })
  } catch (err) { next(err) }
}

const ajusterSolde = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM comptes WHERE id = ? AND user_id = ? AND actif = 1',
      [req.params.id, req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ message: 'Compte introuvable.' })

    const { nouveau_solde } = req.body
    if (nouveau_solde === undefined || nouveau_solde === null || isNaN(nouveau_solde))
      return res.status(400).json({ message: 'Nouveau solde invalide.' })

    const ancienSolde  = parseFloat(rows[0].solde)
    const nouveauSolde = Math.round(parseFloat(nouveau_solde) * 100) / 100
    const difference   = Math.round((nouveauSolde - ancienSolde) * 100) / 100

    await pool.execute('UPDATE comptes SET solde = ? WHERE id = ?', [nouveauSolde, req.params.id])

    const [updated] = await pool.execute('SELECT * FROM comptes WHERE id = ?', [req.params.id])
    res.json({
      message:       `Solde ajusté (${difference >= 0 ? '+' : ''}${difference}).`,
      compte:        updated[0],
      ancien_solde:  ancienSolde,
      nouveau_solde: nouveauSolde,
      difference,
    })
  } catch (err) { next(err) }
}

const virementComptes = async (req, res, next) => {
  try {
    const { from_compte_id, to_compte_id, montant, commentaire } = req.body
    const userId = req.user.id

    if (!from_compte_id || !to_compte_id)
      return res.status(400).json({ message: 'Comptes source et destination requis.' })
    if (parseInt(from_compte_id) === parseInt(to_compte_id))
      return res.status(400).json({ message: 'Les deux comptes doivent être différents.' })
    if (!montant || isNaN(montant) || parseFloat(montant) <= 0)
      return res.status(400).json({ message: 'Montant invalide.' })

    const [[from], [to]] = await Promise.all([
      pool.execute('SELECT * FROM comptes WHERE id = ? AND user_id = ? AND actif = 1', [from_compte_id, userId]),
      pool.execute('SELECT * FROM comptes WHERE id = ? AND user_id = ? AND actif = 1', [to_compte_id, userId]),
    ])
    if (!from[0]) return res.status(404).json({ message: 'Compte source introuvable.' })
    if (!to[0])   return res.status(404).json({ message: 'Compte destination introuvable.' })

    const montantF = parseFloat(montant)
    if (parseFloat(from[0].solde) < montantF)
      return res.status(400).json({ message: `Solde insuffisant dans "${from[0].nom}". Disponible : ${from[0].solde}.` })

    await transaction(async (conn) => {
      await conn.execute('UPDATE comptes SET solde = solde - ? WHERE id = ?', [montantF, from_compte_id])
      await conn.execute('UPDATE comptes SET solde = solde + ? WHERE id = ?', [montantF, to_compte_id])
      await conn.execute(
        'INSERT INTO virements_comptes (user_id, from_compte_id, to_compte_id, montant, commentaire) VALUES (?, ?, ?, ?, ?)',
        [userId, parseInt(from_compte_id), parseInt(to_compte_id), montantF, commentaire?.trim() || null]
      )
    })

    const [[fromUpdated], [toUpdated]] = await Promise.all([
      pool.execute('SELECT * FROM comptes WHERE id = ?', [from_compte_id]),
      pool.execute('SELECT * FROM comptes WHERE id = ?', [to_compte_id]),
    ])
    res.status(201).json({
      message: 'Virement effectué.',
      from:    fromUpdated[0],
      to:      toUpdated[0],
    })
  } catch (err) { next(err) }
}

const listerVirements = async (req, res, next) => {
  try {
    const [virements] = await pool.execute(`
      SELECT v.*,
        f.nom as from_nom, f.couleur as from_couleur,
        t.nom as to_nom,   t.couleur as to_couleur
      FROM virements_comptes v
      JOIN comptes f ON f.id = v.from_compte_id
      JOIN comptes t ON t.id = v.to_compte_id
      WHERE v.user_id = ?
      ORDER BY v.date DESC
      LIMIT 50
    `, [req.user.id])
    res.json({ virements })
  } catch (err) { next(err) }
}

module.exports = { listerComptes, creerCompte, modifierCompte, supprimerCompte, ajusterSolde, virementComptes, listerVirements }
