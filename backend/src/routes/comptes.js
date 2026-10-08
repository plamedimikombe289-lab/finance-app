const express = require('express')
const router  = express.Router()
const { listerComptes, creerCompte, modifierCompte, supprimerCompte, ajusterSolde, virementComptes, listerVirements } = require('../controllers/comptesController')

router.get('/',              listerComptes)
router.post('/',             creerCompte)
router.post('/virement',     virementComptes)
router.get('/virements',     listerVirements)
router.put('/:id',           modifierCompte)
router.post('/:id/ajuster',  ajusterSolde)
router.delete('/:id',        supprimerCompte)

module.exports = router
