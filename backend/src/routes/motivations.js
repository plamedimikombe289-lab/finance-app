/**
 * @swagger
 * tags:
 *   name: Motivations
 *   description: Messages de motivation personnalisés basés sur les objectifs et budgets
 *
 * /motivations:
 *   get:
 *     summary: Récupérer les messages de motivation personnalisés
 *     tags: [Motivations]
 *     responses:
 *       200:
 *         description: Liste de messages (max 8), triés par priorité
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 motivations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:      { type: string, enum: [success, warning, danger, info] }
 *                       icon:      { type: string }
 *                       titre:     { type: string }
 *                       message:   { type: string }
 *                       categorie: { type: string, nullable: true }
 *                       progress:  { type: number, nullable: true }
 */
const express = require('express')
const router  = express.Router()
const { genererMotivations } = require('../services/motivationService')

router.get('/', async (req, res, next) => {
  try {
    const motivations = await genererMotivations(req.user.id)
    res.json({ motivations })
  } catch (err) { next(err) }
})

module.exports = router
