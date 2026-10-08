const express = require('express');
const router = express.Router();
const { listerCategories, creerCategorie, modifierCategorie, supprimerCategorie, ajusterSolde, virerSolde } = require('../controllers/categoriesController');

router.get('/',              listerCategories);
router.post('/',             creerCategorie);
router.post('/virement',     virerSolde);
router.put('/:id',           modifierCategorie);
router.delete('/:id',        supprimerCategorie);
router.patch('/:id/solde',   ajusterSolde);

module.exports = router;
